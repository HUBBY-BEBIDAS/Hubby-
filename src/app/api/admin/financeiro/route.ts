import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

const PLAN_PRICES: Record<string, Record<string, number>> = {
  starter:    { monthly: 29900, quarterly: 26900, semiannual: 25400, annual: 23900 },
  pro:        { monthly: 79900, quarterly: 71900, semiannual: 67900, annual: 63900 },
  business:   { monthly: 149900, quarterly: 134900, semiannual: 127400, annual: 119900 },
  enterprise: { monthly: 149900, quarterly: 134900, semiannual: 127400, annual: 119900 },
};

export const GET = withAuth(
  async (_req: NextRequest) => {
    const now = new Date();
    const startOfMonth  = new Date(now.getFullYear(), now.getMonth(), 1);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const distributors = await prisma.distributor.findMany({
      select: { id: true, plan: true, plan_status: true, plan_period: true, created_at: true },
    });

    const mrrByPlan: Record<string, number> = { starter: 0, pro: 0, business: 0, enterprise: 0 };
    let mrrTotal = 0;
    let activeCount = 0;
    let trialCount = 0;
    let cancelledCount = 0;
    let newThisMonth = 0;
    let trialExpiringSoon = 0;

    for (const d of distributors) {
      if (d.plan_status === "active") {
        const mrr = PLAN_PRICES[d.plan]?.[d.plan_period] ?? 0;
        mrrByPlan[d.plan] = (mrrByPlan[d.plan] ?? 0) + mrr;
        mrrTotal += mrr;
        activeCount++;
        if (d.created_at >= startOfMonth) newThisMonth++;
      } else if (d.plan_status === "trial") {
        trialCount++;
        if (d.created_at <= fourteenDaysAgo) trialExpiringSoon++;
      } else if (d.plan_status === "cancelled") {
        cancelledCount++;
      }
    }

    // Approximate churn: distributors cancelled this month
    const churnedThisMonth = distributors.filter(
      (d) => d.plan_status === "cancelled" && d.created_at >= startOfMonth
    ).length;

    const conversionRate = activeCount + cancelledCount > 0
      ? Math.round((activeCount / (activeCount + cancelledCount)) * 10000) / 100
      : 0;

    return Response.json({
      mrr_by_plan: mrrByPlan,
      mrr_total_cents: mrrTotal,
      active_count: activeCount,
      trial_count: trialCount,
      cancelled_count: cancelledCount,
      new_this_month: newThisMonth,
      churned_this_month: churnedThisMonth,
      trial_expiring_soon: trialExpiringSoon,
      conversion_rate: conversionRate,
    });
  },
  { roles: ["platform_admin"] }
);
