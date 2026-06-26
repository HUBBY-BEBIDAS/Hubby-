import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

// ─── PATCH /api/distributor/promotions/[id] — desativar ou atualizar ──────────

export const PATCH = withAuth(
  async (req: NextRequest, user, context) => {
    const id = context?.params.id;
    if (!id) return Response.json({ error: "ID não fornecido" }, { status: 400 });

    let body: unknown;
    try { body = await req.json(); } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!distributor) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

    const promo = await prisma.promotion.findFirst({
      where: { id, distributor_id: distributor.id },
    });
    if (!promo) return Response.json({ error: "Promoção não encontrada" }, { status: 404 });

    const data = body as Record<string, unknown>;
    const updated = await prisma.promotion.update({
      where: { id },
      data: {
        ...(data.active    !== undefined && { active:      Boolean(data.active) }),
        ...(data.ends_at   !== undefined && { ends_at:     new Date(data.ends_at as string) }),
        ...(data.description !== undefined && { description: data.description as string }),
      },
    });

    return Response.json({ promotion: updated });
  },
  { roles: ["distributor_admin"] }
);

// ─── DELETE /api/distributor/promotions/[id] ──────────────────────────────────

export const DELETE = withAuth(
  async (_req: NextRequest, user, context) => {
    const id = context?.params.id;
    if (!id) return Response.json({ error: "ID não fornecido" }, { status: 400 });

    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!distributor) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

    const promo = await prisma.promotion.findFirst({
      where: { id, distributor_id: distributor.id },
    });
    if (!promo) return Response.json({ error: "Promoção não encontrada" }, { status: 404 });

    await prisma.promotion.delete({ where: { id } });
    return Response.json({ message: "Promoção removida" });
  },
  { roles: ["distributor_admin"] }
);
