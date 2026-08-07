import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { validateChatMessage } from "@/lib/chat-guard";

// Helper para obter os perfis associados ao usuário logado
async function getUserProfileIds(userId: string, role: string) {
  if (role === "client") {
    const client = await prisma.client.findUnique({
      where: { user_id: userId },
      select: { id: true, company_name: true },
    });
    return { clientId: client?.id ?? null, name: client?.company_name ?? "" };
  } else {
    let distId: string | null = null;
    let name = "";
    if (role === "distributor_admin") {
      const dist = await prisma.distributor.findUnique({
        where: { user_id: userId },
        select: { id: true, company_name: true },
      });
      distId = dist?.id ?? null;
      name = dist?.company_name ?? "";
    } else {
      const member = await prisma.distributorTeamMember.findFirst({
        where: { user_id: userId, status: "active" },
        select: { distributor_id: true, distributor: { select: { company_name: true } } },
      });
      distId = member?.distributor_id ?? null;
      name = member?.distributor?.company_name ?? "";
    }
    return { distributorId: distId, name };
  }
}

// ─── GET /api/chat/rooms/:id/messages ─────────────────────────────────────────
export const GET = withAuth(
  async (_req: NextRequest, user, context) => {
    const roomId = context?.params.id;
    if (!roomId) return Response.json({ error: "ID da sala não fornecido" }, { status: 400 });

    const isClient = user.role === "client";
    const profiles = await getUserProfileIds(user.userId, user.role);

    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      return Response.json({ error: "Conversa não encontrada" }, { status: 404 });
    }

    // Valida se usuário tem acesso à sala
    if (isClient) {
      if (room.client_id !== profiles.clientId) {
        return Response.json({ error: "Acesso não autorizado" }, { status: 403 });
      }
    } else {
      if (room.distributor_id !== profiles.distributorId) {
        return Response.json({ error: "Acesso não autorizado" }, { status: 403 });
      }
    }

    // Marca mensagens não lidas enviadas pela outra parte como lidas
    await prisma.chatMessage.updateMany({
      where: {
        room_id: roomId,
        sender_id: { not: user.userId },
        is_read: false,
      },
      data: {
        is_read: true,
        read_at: new Date(),
      },
    });

    const messages = await prisma.chatMessage.findMany({
      where: { room_id: roomId },
      orderBy: { created_at: "asc" },
    });

    return Response.json({ messages });
  },
  { roles: ["client", "distributor_admin", "distributor_collaborator"] }
);

// ─── POST /api/chat/rooms/:id/messages ────────────────────────────────────────
const messageSchema = z.object({
  text: z.string().min(1, "Mensagem não pode estar vazia").max(5000, "Mensagem muito longa"),
});

export const POST = withAuth(
  async (req: NextRequest, user, context) => {
    const roomId = context?.params.id;
    if (!roomId) return Response.json({ error: "ID da sala não fornecido" }, { status: 400 });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const parsed = messageSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message || "Dados inválidos" }, { status: 422 });
    }

    // Valida se a mensagem viola os termos de privacidade de contatos
    const guardResult = validateChatMessage(parsed.data.text);
    if (!guardResult.isClean) {
      return Response.json(
        {
          error: `Mensagem bloqueada por política de segurança: ${guardResult.reason}`,
          guard_blocked: true,
          reason: guardResult.reason,
        },
        { status: 400 }
      );
    }

    const isClient = user.role === "client";
    const profiles = await getUserProfileIds(user.userId, user.role);

    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: {
        client: { select: { user_id: true, company_name: true } },
        distributor: { select: { user_id: true, company_name: true } },
      },
    });

    if (!room) {
      return Response.json({ error: "Conversa não encontrada" }, { status: 404 });
    }

    // Valida se usuário tem acesso à sala
    if (isClient) {
      if (room.client_id !== profiles.clientId) {
        return Response.json({ error: "Acesso não autorizado" }, { status: 403 });
      }
    } else {
      if (room.distributor_id !== profiles.distributorId) {
        return Response.json({ error: "Acesso não autorizado" }, { status: 403 });
      }
    }

    // Salva a mensagem no banco e atualiza o timestamp da sala em uma transação
    const [message] = await prisma.$transaction([
      prisma.chatMessage.create({
        data: {
          room_id: roomId,
          sender_id: user.userId,
          text: parsed.data.text,
        },
      }),
      prisma.chatRoom.update({
        where: { id: roomId },
        data: { updated_at: new Date() },
      }),
    ]);

    // Envia notificação para a outra parte (fire-and-forget)
    const recipientUserId = isClient ? room.distributor.user_id : room.client.user_id;
    const senderName = isClient ? room.client.company_name : room.distributor.company_name;

    createNotification({
      user_id: recipientUserId,
      type: "credential_pending", // usando um tipo genérico aceito pela lib ou genérico
      title: "Nova mensagem no chat",
      body: `${senderName}: "${parsed.data.text.length > 40 ? parsed.data.text.slice(0, 40) + "..." : parsed.data.text}"`,
      data: { room_id: roomId },
    }).catch((err) => console.error("[chat:notif] Erro ao enviar notificação de chat:", err));

    return Response.json({ message }, { status: 201 });
  },
  { roles: ["client", "distributor_admin", "distributor_collaborator"] }
);
