import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/catalog/similares
 *
 * Produtos que compradores com histórico parecido também cotaram.
 * Lógica: quem cotou os mesmos produtos que eu, o que mais cotou?
 */
export const GET = withAuth(
  async (_req: NextRequest, user) => {
    const client = await prisma.client.findUnique({
      where:  { user_id: user.userId },
      select: { id: true, delivery_city: true, delivery_state: true },
    });
    if (!client) return Response.json({ products: [] });

    // Pega as categorias e marcas que este comprador já cotou
    const myQuotations = await prisma.quotation.findMany({
      where:  { client_id: client.id },
      select: { items: { select: { brand: true, category: true, product_name: true } } },
      take:   20,
      orderBy: { created_at: "desc" },
    });

    const myItems = myQuotations.flatMap((q) => q.items);
    if (myItems.length === 0) return Response.json({ products: [] });

    const myBrands     = [...new Set(myItems.map((i) => i.brand.toLowerCase()))];
    const myCategories = [...new Set(myItems.map((i) => i.category))];
    const myProductNames = new Set(myItems.map((i) => i.product_name.toLowerCase()));

    // Encontra outros compradores na mesma região que cotaram as mesmas marcas/categorias
    const city  = client.delivery_city.replace(/\s*\([^)]*\)\s*/g, "").trim();
    const state = client.delivery_state;

    const similarItems = await prisma.quotationItem.findMany({
      where: {
        quotation: {
          client_id: { not: client.id },
          delivery_city:  { equals: city,  mode: "insensitive" },
          delivery_state: { equals: state, mode: "insensitive" },
        },
        category: { in: myCategories as never[] },
      },
      select: {
        product_name: true,
        brand:        true,
        category:     true,
        packaging:    true,
      },
      take: 500,
    });

    // Conta frequência dos produtos que YO ainda não cotei
    const counts = new Map<string, { name: string; brand: string; category: string; packaging: string; score: number }>();
    for (const item of similarItems) {
      if (myProductNames.has(item.product_name.toLowerCase())) continue;
      const key = `${item.brand}|${item.product_name}|${item.packaging}`;
      const entry = counts.get(key);
      // Boost se a marca é uma que eu já compro (mais relevante)
      const boost = myBrands.includes(item.brand.toLowerCase()) ? 2 : 1;
      if (entry) { entry.score += boost; }
      else { counts.set(key, { name: item.product_name, brand: item.brand, category: item.category, packaging: item.packaging, score: boost }); }
    }

    const top8 = [...counts.values()].sort((a, b) => b.score - a.score).slice(0, 8);
    if (top8.length === 0) return Response.json({ products: [] });

    // Enriquece com preço atual
    const enriched = await Promise.all(
      top8.map(async (item) => {
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
        if (!cheapest) return null;
        return {
          key:                `${item.brand}|${item.name}|${item.category}|${cheapest.packaging_type}|${cheapest.packaging_volume_ml}`,
          name:               item.name,
          brand:              item.brand,
          category:           item.category,
          packaging_type:     cheapest.packaging_type,
          packaging_volume_ml: cheapest.packaging_volume_ml,
          min_price_cents:    cheapest.price_cents,
          effective_price_cents: cheapest.price_cents,
          image_url:          cheapest.image_url ?? null,
          distributor_count:  1,
          cheapest_product_id:     cheapest.id,
          cheapest_distributor_id: cheapest.distributor_id,
          promotion:          null,
        };
      })
    );

    return Response.json({ products: enriched.filter(Boolean) });
  },
  { roles: ["client"] }
);
