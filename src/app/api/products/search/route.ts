import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { buildPrismaProductSearchWhere } from "@/lib/search-engine";

export type ProductSearchResult = {
  id: string;
  name: string;
  brand: string;
  category: string;
  packaging_type: string;
  packaging_volume_ml: number;
};

export const GET = withAuth(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";

    if (q.length < 2) {
      return Response.json({ results: [] });
    }

    const searchWhere = buildPrismaProductSearchWhere(q);

    const products = await prisma.product.findMany({
      where: {
        available: true,
        distributor: {
          approved_by_admin: true,
          plan_status: { in: ["active", "trial"] },
        },
        ...searchWhere,
      },
      select: {
        id: true,
        name: true,
        brand: true,
        category: true,
        packaging_type: true,
        packaging_volume_ml: true,
      },
      orderBy: [{ brand: "asc" }, { name: "asc" }],
      take: 100,
    });

    // Deduplica por especificação única do produto — não revela de qual distribuidora vem
    const seen = new Set<string>();
    const results: ProductSearchResult[] = [];
    for (const p of products) {
      const key = `${p.name}|${p.brand}|${p.category}|${p.packaging_type}|${p.packaging_volume_ml}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          id: p.id,
          name: p.name,
          brand: p.brand,
          category: p.category,
          packaging_type: p.packaging_type,
          packaging_volume_ml: p.packaging_volume_ml,
        });
      }
      if (results.length >= 20) break;
    }

    return Response.json({ results });
  },
  { roles: ["client"] }
);
