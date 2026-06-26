import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

const promotionSchema = z.object({
  product_id:              z.string().uuid(),
  type:                    z.enum(["percentage", "fixed_price"]),
  discount_percentage:     z.number().min(0.1).max(99).optional(),
  promotional_price_cents: z.number().int().positive().optional(),
  starts_at:               z.string().datetime(),
  ends_at:                 z.string().datetime(),
  description:             z.string().max(300).optional(),
}).refine(
  (d) => {
    if (d.type === "percentage") return d.discount_percentage != null;
    if (d.type === "fixed_price") return d.promotional_price_cents != null;
    return false;
  },
  { message: "Informe desconto % ou preço fixo conforme o tipo escolhido" }
).refine(
  (d) => new Date(d.starts_at) < new Date(d.ends_at),
  { message: "Data de início deve ser anterior à data de fim" }
);

// ─── GET /api/distributor/promotions ─────────────────────────────────────────

export const GET = withAuth(
  async (_req: NextRequest, user) => {
    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!distributor) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

    const now = new Date();
    const promotions = await prisma.promotion.findMany({
      where: { distributor_id: distributor.id },
      include: {
        product: { select: { id: true, name: true, brand: true, packaging_type: true, packaging_volume_ml: true, price_cents: true, image_url: true } },
      },
      orderBy: [{ ends_at: "asc" }],
    });

    const enriched = promotions.map((p) => ({
      ...p,
      is_active: p.active && p.starts_at <= now && p.ends_at >= now,
      is_scheduled: p.active && p.starts_at > now,
      is_expired: p.ends_at < now,
    }));

    return Response.json({ promotions: enriched });
  },
  { roles: ["distributor_admin", "distributor_collaborator"] }
);

// ─── POST /api/distributor/promotions ────────────────────────────────────────

export const POST = withAuth(
  async (req: NextRequest, user) => {
    let body: unknown;
    try { body = await req.json(); } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const parsed = promotionSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Dados inválidos", details: parsed.error.flatten().fieldErrors }, { status: 422 });
    }

    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!distributor) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

    // Verifica que o produto pertence à distribuidora
    const product = await prisma.product.findFirst({
      where: { id: parsed.data.product_id, distributor_id: distributor.id },
    });
    if (!product) return Response.json({ error: "Produto não encontrado" }, { status: 404 });

    const promotion = await prisma.promotion.create({
      data: {
        distributor_id:          distributor.id,
        product_id:              parsed.data.product_id,
        type:                    parsed.data.type,
        discount_percentage:     parsed.data.discount_percentage ?? null,
        promotional_price_cents: parsed.data.promotional_price_cents ?? null,
        starts_at:               new Date(parsed.data.starts_at),
        ends_at:                 new Date(parsed.data.ends_at),
        description:             parsed.data.description ?? null,
        active:                  true,
      },
    });

    return Response.json({ promotion }, { status: 201 });
  },
  { roles: ["distributor_admin"] }
);
