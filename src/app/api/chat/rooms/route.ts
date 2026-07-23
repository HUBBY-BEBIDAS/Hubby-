import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

// ─── GET /api/chat/rooms ──────────────────────────────────────────────────────
/**
 * Retorna todas as conversas do usuário logado (comprador ou distribuidora).
 * Inclui os dados básicos da outra parte e a última mensagem enviada.
 */
export const GET = withAuth(
  async (_req: NextRequest, user) => {
    const isClient = user.role === "client";
    const isDist   = user.role === "distributor_admin" || user.role === "distributor_collaborator";

    if (!isClient && !isDist) {
      return Response.json({ error: "Perfil não autorizado" }, { status: 403 });
    }

    let rooms = [];

    if (isClient) {
      const client = await prisma.client.findUnique({
        where: { user_id: user.userId },
        select: { id: true },
      });
      if (!client) return Response.json({ error: "Perfil de cliente não encontrado" }, { status: 404 });

      // Busca salas do cliente
      const dbRooms = await prisma.chatRoom.findMany({
        where: { client_id: client.id },
        include: {
          distributor: {
            select: {
              company_name: true,
              logo_key: true,
            },
          },
          messages: {
            orderBy: { created_at: "desc" },
            take: 1,
          },
          _count: {
            select: {
              messages: {
                where: {
                  sender_id: { not: user.userId },
                  is_read: false,
                },
              },
            },
          },
        },
        orderBy: { updated_at: "desc" },
      });

      rooms = dbRooms.map((r) => ({
        id: r.id,
        other_party_id: r.distributor_id,
        other_party_name: r.distributor.company_name,
        other_party_logo_key: r.distributor.logo_key,
        last_message: r.messages[0]?.text ?? null,
        last_message_time: r.messages[0]?.created_at ?? null,
        unread_count: r._count.messages,
        updated_at: r.updated_at,
      }));
    } else {
      // Distribuidora
      let distId: string | null = null;
      if (user.role === "distributor_admin") {
        const dist = await prisma.distributor.findUnique({
          where: { user_id: user.userId },
          select: { id: true },
        });
        distId = dist?.id ?? null;
      } else {
        const member = await prisma.distributorTeamMember.findFirst({
          where: { user_id: user.userId, status: "active" },
          select: { distributor_id: true },
        });
        distId = member?.distributor_id ?? null;
      }

      if (!distId) {
        return Response.json({ error: "Perfil de distribuidora não encontrado" }, { status: 404 });
      }

      const dbRooms = await prisma.chatRoom.findMany({
        where: { distributor_id: distId },
        include: {
          client: {
            select: {
              company_name: true,
            },
          },
          messages: {
            orderBy: { created_at: "desc" },
            take: 1,
          },
          _count: {
            select: {
              messages: {
                where: {
                  sender_id: { not: user.userId },
                  is_read: false,
                },
              },
            },
          },
        },
        orderBy: { updated_at: "desc" },
      });

      rooms = dbRooms.map((r) => ({
        id: r.id,
        other_party_id: r.client_id,
        other_party_name: r.client.company_name,
        other_party_logo_key: null,
        last_message: r.messages[0]?.text ?? null,
        last_message_time: r.messages[0]?.created_at ?? null,
        unread_count: r._count.messages,
        updated_at: r.updated_at,
      }));
    }

    return Response.json({ rooms });
  },
  { roles: ["client", "distributor_admin", "distributor_collaborator"] }
);

// ─── POST /api/chat/rooms ─────────────────────────────────────────────────────
const createRoomSchema = z.object({
  distributor_id: z.string().uuid("ID da distribuidora inválido").optional(),
  client_id: z.string().uuid("ID do cliente inválido").optional(),
});

/**
 * Cria ou retorna uma sala de chat ativa entre o comprador e a distribuidora.
 */
export const POST = withAuth(
  async (req: NextRequest, user) => {
    const isClient = user.role === "client";
    const isDist   = user.role === "distributor_admin" || user.role === "distributor_collaborator";

    if (!isClient && !isDist) {
      return Response.json({ error: "Perfil não autorizado" }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const parsed = createRoomSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const { distributor_id, client_id } = parsed.data;

    let clientId = "";
    let distributorId = "";

    if (isClient) {
      const client = await prisma.client.findUnique({
        where: { user_id: user.userId },
        select: { id: true },
      });
      if (!client) return Response.json({ error: "Perfil de cliente não encontrado" }, { status: 404 });
      clientId = client.id;
      if (!distributor_id) return Response.json({ error: "distributor_id é obrigatório para compradores" }, { status: 400 });
      distributorId = distributor_id;
    } else {
      // Distribuidora
      let distId = "";
      if (user.role === "distributor_admin") {
        const dist = await prisma.distributor.findUnique({
          where: { user_id: user.userId },
          select: { id: true },
        });
        distId = dist?.id || "";
      } else {
        const member = await prisma.distributorTeamMember.findFirst({
          where: { user_id: user.userId, status: "active" },
          select: { distributor_id: true },
        });
        distId = member?.distributor_id || "";
      }
      if (!distId) return Response.json({ error: "Perfil de distribuidora não encontrado" }, { status: 404 });
      distributorId = distId;
      if (!client_id) return Response.json({ error: "client_id é obrigatório para distribuidoras" }, { status: 400 });
      clientId = client_id;
    }

    // Tenta obter ou criar
    const room = await prisma.chatRoom.upsert({
      where: {
        client_id_distributor_id: {
          client_id: clientId,
          distributor_id: distributorId,
        },
      },
      update: {}, // no-op se já existir
      create: {
        client_id: clientId,
        distributor_id: distributorId,
      },
    });

    return Response.json({ room }, { status: 201 });
  },
  { roles: ["client", "distributor_admin", "distributor_collaborator"] }
);
