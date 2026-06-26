import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/catalog/frequentes
 *
 * Retorna os 6 produtos mais cotados pelo comprador autenticado.
 * Agrega por (product_name + brand + packaging) das QuotationItems.
 */
export const GET = withAuth(
  async (_req: NextRequest, user) => {
    const client = await prisma.client.findUnique({
      where:  { user_id: user.userId },
      select: { id: true, delivery_city: true, delivery_state: true },
    });
    if (!client) return Response.json({ products: [] });

    // Busca todos os itens de cotações do comprador
    const items = await prisma.quotationItem.findMany({
      where:   { quotation: { client_id: client.id } },
      select: {
        product_name: true,
        brand:        true,
        category:     true,
        packaging:    true,
      },
    });

    if (items.length === 0) return Response.json({ products: [] });

    // Conta frequência por (name+brand+packaging)
    const counts = new Map<string, { name: string; brand: string; category: string; packaging: string; count: number }>();
    for (const item of items) {
      const key = `${item.brand}|${item.product_name}|${item.packaging}`;
      const entry = counts.get(key);
      if (entry) { entry.count++; }
      else { counts.set(key, { name: item.product_name, brand: item.brand, category: item.category, packaging: item.packaging, count: 1 }); }
    }

    const top6 = [...counts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // Enriquece com preço atual na região
    const city  = client.delivery_city.replace(/\s*\([^)]*\)\s*/g, "").trim();
    const state = client.delivery_state;

    const enriched = await Promise.all(
      top6.map(async (item) => {
        const cheapest = await prisma.product.findFirst({
          where: {
            name:  { contains: item.name,  mode: "insensitive" },
            brand: { contains: item.brand, mode: "insensitive" },
            available: true,
            distributor: {
              approved_by_admin: true,
              delivery_regions: {
                some: {
                  city:  { equals: city,  mode: "insensitive" },
                  state: { equals: state, mode: "insensitive" },
                },
              },
            },
          },
          orderBy: { price_cents: "asc" },
          select:  { id: true, price_cents: true, image_url: true, distributor_id: true, packaging_type: true, packaging_volume_ml: true },
        });

        return {
          key:                `${item.brand}|${item.name}|${item.category}|${cheapest?.packaging_type ?? ""}|${cheapest?.packaging_volume_ml ?? 0}`,
          product_name:       item.name,
          brand:              item.brand,
          category:           item.category,
          packaging:          item.packaging,
          times_quoted:       item.count,
          min_price_cents:    cheapest?.price_cents ?? null,
          image_url:          cheapest?.image_url   ?? null,
          cheapest_product_id:     cheapest?.id              ?? null,
          cheapest_distributor_id: cheapest?.distributor_id  ?? null,
        };
      })
    );

    return Response.json({ products: enriched.filter((p) => p.min_price_cents !== null) });
  },
  { roles: ["client"] }
);
