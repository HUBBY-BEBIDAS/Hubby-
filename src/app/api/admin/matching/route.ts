import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/matching
 * Retorna os itens pendentes na fila de curadoria com suas sugestões ordenadas por relevância.
 */
export const GET = withAuth(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));

    const where = { status: "pending" as const };

    const [total, pendingItems] = await Promise.all([
      prisma.unmatchedImportItem.count({ where }),
      prisma.unmatchedImportItem.findMany({
        where,
        include: {
          distributor: { select: { id: true, company_name: true } },
          suggestions: {
            include: {
              master_product: {
                include: { images: { where: { is_primary: true }, take: 1 } },
              },
            },
            orderBy: { rank: "asc" },
          },
        },
        orderBy: { created_at: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return Response.json({
      pending_items: pendingItems,
      total,
      page,
      total_pages: Math.ceil(total / limit),
    });
  },
  { roles: ["platform_admin"] }
);
