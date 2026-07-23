import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { buildPrismaProductSearchWhere } from "@/lib/search-engine";

// ─── GET /api/products/catalog?q=termo ───────────────────────────────────────
// Busca no catálogo central por nome ou marca (autocomplete ao cadastrar produto)

export const GET = withAuth(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";

    if (q.length < 2) {
      return Response.json({ catalog: [] });
    }

    const catalog = await prisma.productCatalog.findMany({
      where: buildPrismaProductSearchWhere(q),
      orderBy: [{ brand: "asc" }, { name: "asc" }],
      take: 12,
    });

    return Response.json({ catalog });
  },
  { roles: ["distributor_admin", "distributor_collaborator"] }
);
