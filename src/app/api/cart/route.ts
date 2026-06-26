import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

// ─── GET /api/cart ────────────────────────────────────────────────────────────

export const GET = withAuth(
  async (_req: NextRequest, user) => {
    const client = await prisma.client.findUnique({
      where: { user_id: user.userId },
      select: { id: true, delivery_city: true, delivery_state: true },
    });
    if (!client) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

    const city  = client.delivery_city.replace(/\s*\([^)]*\)\s*/g, "").trim();
    const state = client.delivery_state;

    const items = await prisma.cartItem.findMany({
      where: { client_id: client.id },
      include: {
        product: {
          select: {
            name: true,
            brand: true,
            category: true,
            packaging_type: true,
            packaging_volume_ml: true,
            price_cents: true,
            image_url: true,
          },
        },
        distributor: {
          select: {
            company_name: true,
            logo_key: true,
            delivery_regions: {
              where: {
                city:  { equals: city,  mode: "insensitive" },
                state: { equals: state, mode: "insensitive" },
              },
              select: { minimum_order_cents: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { added_at: "asc" },
    });

    const result = items.map((item) => ({
      id:             item.id,
      product_id:     item.product_id,
      distributor_id: item.distributor_id,
      quantity:       item.quantity,
      added_at:       item.added_at.toISOString(),
      product:        item.product,
      distributor: {
        company_name: item.distributor.company_name,
        logo_key:     item.distributor.logo_key,
      },
      minimum_order_cents: item.distributor.delivery_regions[0]?.minimum_order_cents ?? 0,
    }));

    return Response.json({ items: result });
  },
  { roles: ["client"] }
);

// ─── POST /api/cart ───────────────────────────────────────────────────────────

const addSchema = z.object({
  product_id:     z.string().uuid(),
  distributor_id: z.string().uuid(),
  quantity:       z.number().int().min(1).max(10_000).default(1),
});

export const POST = withAuth(
  async (req: NextRequest, user) => {
    let body: unknown;
    try { body = await req.json(); } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const parsed = addSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Dados inválidos", details: parsed.error.flatten().fieldErrors }, { status: 422 });
    }

    const client = await prisma.client.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!client) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

    const { product_id, distributor_id, quantity } = parsed.data;

    // Verifica que produto pertence à distribuidora
    const product = await prisma.product.findFirst({
      where: { id: product_id, distributor_id, available: true },
      select: { id: true },
    });
    if (!product) return Response.json({ error: "Produto não encontrado" }, { status: 404 });

    // Upsert: se já existir, incrementa a quantidade
    const item = await prisma.cartItem.upsert({
      where: {
        client_id_product_id_distributor_id: {
          client_id:      client.id,
          product_id,
          distributor_id,
        },
      },
      update: { quantity: { increment: quantity } },
      create: {
        client_id:      client.id,
        product_id,
        distributor_id,
        quantity,
      },
    });

    return Response.json({ item }, { status: 201 });
  },
  { roles: ["client"] }
);

// ─── DELETE /api/cart — limpa carrinho inteiro ────────────────────────────────

export const DELETE = withAuth(
  async (_req: NextRequest, user) => {
    const client = await prisma.client.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!client) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

    await prisma.cartItem.deleteMany({ where: { client_id: client.id } });

    return Response.json({ ok: true });
  },
  { roles: ["client"] }
);
