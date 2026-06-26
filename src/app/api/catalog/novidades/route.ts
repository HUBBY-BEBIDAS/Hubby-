import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/catalog/novidades
 *
 * Produtos adicionados pelas distribuidoras nos últimos 7 dias na região do comprador.
 * Agrupados da mesma forma que o catálogo principal (sem duplicatas por distribuidora).
 */
export const GET = withAuth(
  async (_req: NextRequest, user) => {
    const client = await prisma.client.findUnique({
      where:  { user_id: user.userId },
      select: { delivery_city: true, delivery_state: true },
    });
    if (!client) return Response.json({ products: [] });

    const city  = client.delivery_city.replace(/\s*\([^)]*\)\s*/g, "").trim();
    const state = client.delivery_state;
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const now   = new Date();

    const regions = await prisma.deliveryRegion.findMany({
      where: {
        city:  { equals: city,  mode: "insensitive" },
        state: { equals: state, mode: "insensitive" },
        distributor: { approved_by_admin: true },
      },
      select: { distributor_id: true },
    });

    if (regions.length === 0) return Response.json({ products: [] });

    const distributorIds = regions.map((r) => r.distributor_id);

    const products = await prisma.product.findMany({
      where: {
        distributor_id: { in: distributorIds },
        available: true,
        created_at: { gte: since },
      },
      select: {
        id: true,
        name: true,
        brand: true,
        category: true,
        packaging_type: true,
        packaging_volume_ml: true,
        price_cents: true,
        image_url: true,
        distributor_id: true,
        created_at: true,
        promotions: {
          where: { active: true, starts_at: { lte: now }, ends_at: { gte: now } },
          select: { type: true, discount_percentage: true, promotional_price_cents: true },
          take: 1,
        },
      },
      orderBy: { created_at: "desc" },
      take: 40,
    });

    // Agrupa — mesmo padrão do catálogo
    const map = new Map<string, {
      key: string; name: string; brand: string; category: string;
      packaging_type: string; packaging_volume_ml: number;
      min_price_cents: number; effective_price_cents: number;
      image_url: string | null; distributor_count: number;
      cheapest_product_id: string; cheapest_distributor_id: string;
      added_at: string;
    }>();

    for (const p of products) {
      const key = `${p.brand}|${p.name}|${p.category}|${p.packaging_type}|${p.packaging_volume_ml}`;
      const promo = p.promotions[0] ?? null;
      const effectiveCents = promo
        ? promo.type === "fixed_price" && promo.promotional_price_cents != null
          ? promo.promotional_price_cents
          : Math.round(p.price_cents * (1 - (promo.discount_percentage ?? 0) / 100))
        : p.price_cents;

      if (!map.has(key)) {
        map.set(key, {
          key, name: p.name, brand: p.brand, category: p.category,
          packaging_type: p.packaging_type, packaging_volume_ml: p.packaging_volume_ml,
          min_price_cents: p.price_cents, effective_price_cents: effectiveCents,
          image_url: p.image_url ?? null, distributor_count: 1,
          cheapest_product_id: p.id, cheapest_distributor_id: p.distributor_id,
          added_at: p.created_at.toISOString(),
        });
      } else {
        const entry = map.get(key)!;
        entry.distributor_count++;
        if (effectiveCents < entry.effective_price_cents) {
          entry.min_price_cents       = p.price_cents;
          entry.effective_price_cents = effectiveCents;
          entry.cheapest_product_id   = p.id;
          entry.cheapest_distributor_id = p.distributor_id;
        }
        if (!entry.image_url && p.image_url) entry.image_url = p.image_url;
      }
    }

    return Response.json({ products: [...map.values()].slice(0, 12) });
  },
  { roles: ["client"] }
);
