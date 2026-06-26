import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/patrocinios
 * Lista todos os slots de patrocínio com métricas e receita.
 */
export const GET = withAuth(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get("active") === "1";
    const now        = new Date();

    const slots = await prisma.sponsoredSlot.findMany({
      where: activeOnly
        ? { active: true, ends_at: { gt: now } }
        : undefined,
      include: {
        distributor: { select: { id: true, company_name: true, plan: true } },
        product:     { select: { id: true, name: true, brand: true } },
      },
      orderBy: { created_at: "desc" },
    });

    // Receita mensal: soma de budget_cents de slots ativos no mês corrente
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const revenueThisMonth = await prisma.sponsoredSlot.aggregate({
      where: { active: true, starts_at: { lte: now }, ends_at: { gte: startOfMonth } },
      _sum: { budget_cents: true },
    });

    return Response.json({
      slots,
      total: slots.length,
      active_count: slots.filter((s) => s.active && new Date(s.ends_at) > now).length,
      revenue_this_month_cents: revenueThisMonth._sum.budget_cents ?? 0,
    });
  },
  { roles: ["platform_admin"] }
);
