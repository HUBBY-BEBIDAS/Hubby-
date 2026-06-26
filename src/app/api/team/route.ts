import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

const MAX_MEMBERS_FREE = 1;  // apenas o dono
const MAX_MEMBERS_PRO  = 10;

const inviteSchema = z.object({
  email: z.string().email("E-mail inválido").toLowerCase().trim(),
});

/**
 * GET /api/team
 * Lista os membros da conta do comprador (dono + convidados).
 *
 * POST /api/team
 * Convida um novo membro por e-mail.
 * Free: sem convites adicionais (apenas o dono).
 * Pro: até 10 membros no total.
 */

export const GET = withAuth(
  async (_req: NextRequest, user) => {
    const client = await prisma.client.findUnique({
      where: { user_id: user.userId },
      select: {
        id: true,
        client_plan: true,
        client_plan_status: true,
        members: {
          orderBy: { invited_at: "asc" },
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
            invited_at: true,
            accepted_at: true,
          },
        },
      },
    });

    if (!client) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

    const isPro = client.client_plan === "pro" && client.client_plan_status === "active";
    const max = isPro ? MAX_MEMBERS_PRO : MAX_MEMBERS_FREE;

    return Response.json({
      members: client.members,
      total: client.members.length,
      max_allowed: max,
      can_invite: isPro && client.members.length < max,
    });
  },
  { roles: ["client"] }
);

export const POST = withAuth(
  async (req: NextRequest, user) => {
    const client = await prisma.client.findUnique({
      where: { user_id: user.userId },
      select: {
        id: true,
        client_plan: true,
        client_plan_status: true,
        members: { select: { id: true, role: true, user_id: true } },
      },
    });
    if (!client) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

    // Somente o owner pode convidar
    const ownerRecord = client.members.find((m) => m.user_id === user.userId && m.role === "owner");
    if (!ownerRecord) {
      return Response.json({ error: "Apenas o titular da conta pode convidar membros" }, { status: 403 });
    }

    // Plano Free: não pode convidar
    const isPro = client.client_plan === "pro" && client.client_plan_status === "active";
    if (!isPro) {
      return Response.json(
        { error: "Convite de membros disponível apenas no plano Pro.", upgrade_required: true },
        { status: 403 }
      );
    }

    // Limite de membros
    if (client.members.length >= MAX_MEMBERS_PRO) {
      return Response.json(
        { error: `Limite de ${MAX_MEMBERS_PRO} membros atingido.` },
        { status: 409 }
      );
    }

    let body: unknown;
    try { body = await req.json(); } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const parsed = inviteSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Dados inválidos", details: parsed.error.flatten().fieldErrors }, { status: 422 });
    }

    // Verifica se já foi convidado
    const existing = await prisma.clientMember.findUnique({
      where: { client_id_email: { client_id: client.id, email: parsed.data.email } },
    });
    if (existing) {
      return Response.json(
        { error: "Este e-mail já foi convidado.", member: existing },
        { status: 409 }
      );
    }

    const member = await prisma.clientMember.create({
      data: {
        client_id: client.id,
        email: parsed.data.email,
        role: "member",
        status: "pending",
      },
      select: { id: true, email: true, role: true, status: true, invited_at: true },
    });

    // TODO: enviar e-mail de convite com link de aceite (/api/team/accept?token=...)
    // Por ora retorna o registro criado para o frontend exibir o link

    return Response.json({ member }, { status: 201 });
  },
  { roles: ["client"] }
);
