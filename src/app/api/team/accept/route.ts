import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/team/accept
 *
 * Aceita um convite de membro. O usuário autenticado deve ter o mesmo
 * e-mail do convite pendente.
 *
 * Body: { member_id: string }
 */
export const POST = withAuth(
  async (req: NextRequest, user) => {
    let body: unknown;
    try { body = await req.json(); } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const { member_id } = body as { member_id?: string };
    if (!member_id) return Response.json({ error: "member_id obrigatório" }, { status: 400 });

    // Verifica se o e-mail do usuário autenticado corresponde ao convite
    const userRecord = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { email: true },
    });
    if (!userRecord) return Response.json({ error: "Usuário não encontrado" }, { status: 404 });

    const invite = await prisma.clientMember.findFirst({
      where: {
        id: member_id,
        email: userRecord.email,
        status: "pending",
      },
    });

    if (!invite) {
      return Response.json({ error: "Convite não encontrado ou já aceito" }, { status: 404 });
    }

    const updated = await prisma.clientMember.update({
      where: { id: invite.id },
      data: {
        user_id: user.userId,
        status: "active",
        accepted_at: new Date(),
      },
      select: { id: true, email: true, role: true, status: true, accepted_at: true },
    });

    return Response.json({ ok: true, member: updated });
  },
  { roles: ["client"] }
);
