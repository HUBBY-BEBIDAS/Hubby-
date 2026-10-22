import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { calculateDeliveryEstimate, getNowBRT } from "@/lib/delivery-calculator";
import { normalizeCityName } from "@/lib/coverage";
import { getFamilyProductInfo } from "@/lib/catalog-family";

/**
 * GET /api/catalog/product-distributors
 * ?name=Heineken&brand=Heineken&packaging_type=lata&packaging_volume_ml=350&family_key=...
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
    const family_key          = searchParams.get("family_key")?.trim();

    if (!name || !brand || !packaging_type || !packaging_volume_ml) {
      return Response.json({ error: "Parâmetros obrigatórios: name, brand, packaging_type, packaging_volume_ml" }, { status: 400 });
    }

    const client = await prisma.client.findUnique({
      where: { user_id: user.userId },
      select: { id: true, delivery_city: true, delivery_state: true },
    });
    if (!client) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

    const city   = client.delivery_city.replace(/\s*\([^)]*\)\s*/g, "").trim();
    const state  = client.delivery_state;
    const now    = new Date();
    const nowBRT = getNowBRT();

    const targetFamilyKey = family_key || getFamilyProductInfo(name, brand, packaging_type).familyKey;

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
                brand:              { equals: brand, mode: "insensitive" },
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

    type DistributorOffer = {
      product_id:               string;
      distributor_id:           string;
      company_name:             string;
      price_cents:              number;
      effective_price_cents:    number;
      promotion: {
        type:                    string;
        discount_percentage:     number | null;
        promotional_price_cents: number | null;
        description:             string | null;
      } | null;
      delivery_date:            string;
      delivery_days:            number;
      minimum_order_cents:      number;
      freight_type:             string;
      freight_value_cents:      number | null;
      free_freight_above_cents: number | null;
      freight_notes:            string | null;
    };

    const distributorMap = new Map<string, DistributorOffer>();

    for (const region of regions) {
      const dist = region.distributor;

      // Filtra produtos que pertencem à mesma família deste produto
      const matchingProducts = dist.products
        .filter((p) => {
          const pFamily = getFamilyProductInfo(p.name, p.brand, p.packaging_type);
          return pFamily.familyKey === targetFamilyKey;
        })
        .map((product) => {
          const promo = product.promotions[0] ?? null;
          const effectiveCents = promo
            ? promo.type === "fixed_price" && promo.promotional_price_cents != null
              ? promo.promotional_price_cents
              : Math.round(product.price_cents * (1 - (promo.discount_percentage ?? 0) / 100))
            : product.price_cents;
          return { product, promo, effectiveCents };
        })
        .sort((a, b) => a.effectiveCents - b.effectiveCents);

      if (matchingProducts.length === 0) continue;

      const best = matchingProducts[0];
      const product = best.product;
      const promo = best.promo;

      const estimate = calculateDeliveryEstimate(nowBRT, {
        route_days:             region.route_days,
        cutoff_time:            region.cutoff_time,
        delivery_days_business: region.delivery_days_business,
      });

      const offer: DistributorOffer = {
        product_id:               product.id,
        distributor_id:           dist.id,
        company_name:             dist.company_name,
        price_cents:              product.price_cents,
        effective_price_cents:    best.effectiveCents,
        promotion: promo
          ? {
              type:                    promo.type,
              discount_percentage:     promo.discount_percentage ?? null,
              promotional_price_cents: promo.promotional_price_cents ?? null,
              description:             promo.description ?? null,
            }
          : null,
        delivery_date:            estimate.deliveryDateFormatted,
        delivery_days:            estimate.totalBusinessDays,
        minimum_order_cents:      region.minimum_order_cents,
        freight_type:             region.freight_type,
        freight_value_cents:      region.freight_value_cents ?? null,
        free_freight_above_cents: region.free_freight_above_cents ?? null,
        freight_notes:            region.freight_notes ?? null,
      };

      if (!distributorMap.has(dist.id) || distributorMap.get(dist.id)!.effective_price_cents > offer.effective_price_cents) {
        distributorMap.set(dist.id, offer);
      }
    }

    const result = Array.from(distributorMap.values()).sort(
      (a, b) => a.effective_price_cents - b.effective_price_cents
    );

    return Response.json({ distributors: result, product_name: name, brand, packaging_type, packaging_volume_ml });
  },
  { roles: ["client"] }
);
