import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

/**
 * DELETE /api/team/:id
 * Remove um membro (ou cancela um convite pendente).
 * Apenas o owner pode remover membros.
 * Owner não pode remover a si mesmo.
 */
export const DELETE = withAuth(
  async (_req: NextRequest, user, context) => {
    const memberId = context?.params.id;
    if (!memberId) return Response.json({ error: "ID obrigatório" }, { status: 400 });

    const client = await prisma.client.findUnique({
      where: { user_id: user.userId },
      select: {
        id: true,
        members: { select: { id: true, role: true, user_id: true } },
      },
    });
    if (!client) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

    const callerRecord = client.members.find((m) => m.user_id === user.userId);
    if (!callerRecord || callerRecord.role !== "owner") {
      return Response.json({ error: "Apenas o titular da conta pode remover membros" }, { status: 403 });
    }

    const target = await prisma.clientMember.findFirst({
      where: { id: memberId, client_id: client.id },
    });
    if (!target) return Response.json({ error: "Membro não encontrado" }, { status: 404 });
    if (target.role === "owner") {
      return Response.json({ error: "O titular da conta não pode ser removido" }, { status: 409 });
    }

    await prisma.clientMember.delete({ where: { id: memberId } });
    return Response.json({ ok: true });
  },
  { roles: ["client"] }
);
