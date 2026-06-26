import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

const SLOT_PRICES_CENTS: Record<string, number> = {
  top_ranking:        29900, // R$299/mês por região
  category_highlight: 19900, // R$199/mês por categoria
  search_boost:        9900, // R$99/mês por produto
};

const createSchema = z.object({
  slot_type:    z.enum(["top_ranking", "category_highlight", "search_boost"]),
  product_id:   z.string().uuid().optional().nullable(),
  region_city:  z.string().min(2).trim(),
  region_state: z.string().length(2).toUpperCase(),
  starts_at:    z.string().datetime({ offset: true }),
  ends_at:      z.string().datetime({ offset: true }),
  budget_cents: z.number().int().positive(),
}).refine(
  (d) => new Date(d.starts_at) < new Date(d.ends_at),
  { message: "Data de início deve ser anterior ao fim" }
);

/**
 * GET /api/distributor/sponsored-slots
 * Lista todos os slots da distribuidora, ordenados por starts_at desc.
 */
export const GET = withAuth(
  async (_req: NextRequest, user) => {
    const distributor = await prisma.distributor.findUnique({
      where:  { user_id: user.userId },
      select: { id: true, plan: true },
    });
    if (!distributor) return Response.json({ error: "Distribuidora não encontrada" }, { status: 404 });

    const slots = await prisma.sponsoredSlot.findMany({
      where:   { distributor_id: distributor.id },
      include: { product: { select: { id: true, name: true, brand: true, category: true } } },
      orderBy: { starts_at: "desc" },
    });

    const now = new Date();
    const enriched = slots.map((s) => ({
      ...s,
      payment_status: s.active ? "ativo" : new Date(s.ends_at) < now ? "expirado" : "pendente_pagamento",
    }));

    return Response.json({ slots: enriched, price_table: SLOT_PRICES_CENTS });
  },
  { roles: ["distributor_admin"] }
);

/**
 * POST /api/distributor/sponsored-slots
 * Cria um slot de patrocínio (inativo — aguarda ativação pelo admin após pagamento).
 */
export const POST = withAuth(
  async (req: NextRequest, user) => {
    const distributor = await prisma.distributor.findUnique({
      where:  { user_id: user.userId },
      select: { id: true, delivery_regions: { select: { city: true, state: true } } },
    });
    if (!distributor) return Response.json({ error: "Distribuidora não encontrada" }, { status: 404 });

    let body: unknown;
    try { body = await req.json(); }
    catch { return Response.json({ error: "Body inválido" }, { status: 400 }); }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Dados inválidos", details: parsed.error.flatten().fieldErrors }, { status: 422 });
    }

    // Valida product_id se fornecido
    if (parsed.data.product_id) {
      const product = await prisma.product.findFirst({
        where: { id: parsed.data.product_id, distributor_id: distributor.id },
      });
      if (!product) return Response.json({ error: "Produto não encontrado" }, { status: 404 });
    }

    const slot = await prisma.sponsoredSlot.create({
      data: {
        distributor_id: distributor.id,
        product_id:     parsed.data.product_id ?? null,
        slot_type:      parsed.data.slot_type,
        region_city:    parsed.data.region_city,
        region_state:   parsed.data.region_state,
        starts_at:      new Date(parsed.data.starts_at),
        ends_at:        new Date(parsed.data.ends_at),
        budget_cents:   parsed.data.budget_cents,
        active:         false,
      },
    });

    return Response.json({ slot, message: "Slot criado. Aguardando confirmação do pagamento." }, { status: 201 });
  },
  { roles: ["distributor_admin"] }
);
