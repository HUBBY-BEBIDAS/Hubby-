import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(
  async (_req: NextRequest) => {
    const items = await prisma.quotationItem.findMany({
      select: { product_name: true, brand: true, category: true },
    });

    // Group by brand + category (case-insensitive)
    const map = new Map<string, { product_name: string; brand: string; category: string; count: number }>();
    for (const item of items) {
      const key = `${item.brand.toLowerCase()}::${item.category}`;
      if (!map.has(key)) {
        map.set(key, { product_name: item.product_name, brand: item.brand, category: item.category, count: 0 });
      }
      map.get(key)!.count++;
    }

    // Fetch pricing stats from Product table
    const brands = [...new Set(items.map((i) => i.brand.toLowerCase()))];
    const products = await prisma.product.findMany({
      where: { brand: { in: brands, mode: "insensitive" } },
      select: { brand: true, category: true, price_cents: true, distributor_id: true },
    });

    const priceMap = new Map<string, { prices: number[]; distributors: Set<string> }>();
    for (const p of products) {
      const key = `${p.brand.toLowerCase()}::${p.category}`;
      if (!priceMap.has(key)) priceMap.set(key, { prices: [], distributors: new Set() });
      priceMap.get(key)!.prices.push(p.price_cents);
      priceMap.get(key)!.distributors.add(p.distributor_id);
    }

    const result = [...map.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 100)
      .map((g) => {
        const key = `${g.brand.toLowerCase()}::${g.category}`;
        const pricing = priceMap.get(key);
        const prices = pricing?.prices ?? [];
        return {
          product_name:       g.product_name,
          brand:              g.brand,
          category:           g.category,
          quote_count:        g.count,
          distributor_count:  pricing?.distributors.size ?? 0,
          avg_price_cents:    prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null,
          min_price_cents:    prices.length ? Math.min(...prices) : null,
          max_price_cents:    prices.length ? Math.max(...prices) : null,
        };
      });

    return Response.json({ products: result });
  },
  { roles: ["platform_admin"] }
);
