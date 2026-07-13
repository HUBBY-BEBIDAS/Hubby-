import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { calculateDeliveryEstimate, getNowBRT } from "@/lib/delivery-calculator";
import { normalizeCityName } from "@/lib/coverage";

/**
 * GET /api/catalog/product-distributors
 * ?name=Heineken&brand=Heineken&packaging_type=lata&packaging_volume_ml=350
 *
 * Retorna todas as distribuidoras da região do cliente que oferecem
 * este produto, com preço, promoção, prazo de entrega, pedido mínimo e frete.
 */
export const GET = withAuth(
  async (req: NextRequest, user) => {
    const { searchParams } = new URL(req.url);
    const name                = searchParams.get("name")?.trim() ?? "";
    const brand               = searchParams.get("brand")?.trim() ?? "";
    const packaging_type      = searchParams.get("packaging_type")?.trim() ?? "";
    const packaging_volume_ml = Number(searchParams.get("packaging_volume_ml") ?? "0");

    if (!name || !brand || !packaging_type || !packaging_volume_ml) {
      return Response.json({ error: "Parâmetros obrigatórios: name, brand, packaging_type, packaging_volume_ml" }, { status: 400 });
    }

    const client = await prisma.client.findUnique({
      where: { user_id: user.userId },
      select: { id: true, delivery_city: true, delivery_state: true },
    });
    if (!client) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

    const city  = client.delivery_city.replace(/\s*\([^)]*\)\s*/g, "").trim();
    const state = client.delivery_state;
    const now   = getNowBRT();

    // Regiões que atendem o estado do cliente
    const allStateRegions = await prisma.deliveryRegion.findMany({
      where: {
        state: { equals: state, mode: "insensitive" },
        distributor: { approved_by_admin: true },
      },
      include: {
        distributor: {
          include: {
            products: {
              where: {
                name:               { equals: name,          mode: "insensitive" },
                brand:              { equals: brand,         mode: "insensitive" },
                packaging_type:     { equals: packaging_type as never },
                packaging_volume_ml,
                available:          true,
              },
              include: {
                promotions: {
                  where: {
                    active:    true,
                    starts_at: { lte: now },
                    ends_at:   { gte: now },
                  },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    const targetCityClean = normalizeCityName(city).toLowerCase();
    const regions = allStateRegions.filter(
      (r) => normalizeCityName(r.city).toLowerCase() === targetCityClean
    );

    const result = regions
      .filter((r) => r.distributor.products.length > 0)
      .map((region) => {
        const dist    = region.distributor;
        const product = dist.products[0];
        const promo   = product.promotions[0] ?? null;

        const effectiveCents = promo
          ? promo.type === "fixed_price" && promo.promotional_price_cents != null
            ? promo.promotional_price_cents
            : Math.round(product.price_cents * (1 - (promo.discount_percentage ?? 0) / 100))
          : product.price_cents;

        const estimate = calculateDeliveryEstimate(now, {
          route_days:             region.route_days,
          cutoff_time:            region.cutoff_time,
          delivery_days_business: region.delivery_days_business,
        });

        return {
          product_id:               product.id,
          distributor_id:           dist.id,
          company_name:             dist.company_name,
          price_cents:              product.price_cents,
          effective_price_cents:    effectiveCents,
          promotion: promo
            ? {
                type:                    promo.type,
                discount_percentage:     promo.discount_percentage ?? null,
                promotional_price_cents: promo.promotional_price_cents ?? null,
                description:             promo.description ?? null,
              }
            : null,
          delivery_date:     estimate.deliveryDateFormatted,
          delivery_days:     estimate.totalBusinessDays,
          minimum_order_cents:      region.minimum_order_cents,
          freight_type:             region.freight_type,
          freight_value_cents:      region.freight_value_cents ?? null,
          free_freight_above_cents: region.free_freight_above_cents ?? null,
          freight_notes:            region.freight_notes ?? null,
        };
      })
      .sort((a, b) => a.effective_price_cents - b.effective_price_cents);

    return Response.json({ distributors: result, product_name: name, brand, packaging_type, packaging_volume_ml });
  },
  { roles: ["client"] }
);
