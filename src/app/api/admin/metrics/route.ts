import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

const PLAN_PRICES: Record<string, Record<string, number>> = {
  starter:    { monthly: 29900, quarterly: 26900, semiannual: 25400, annual: 23900 },
  pro:        { monthly: 79900, quarterly: 71900, semiannual: 67900, annual: 63900 },
  business:   { monthly: 149900, quarterly: 134900, semiannual: 127400, annual: 119900 },
  enterprise: { monthly: 149900, quarterly: 134900, semiannual: 127400, annual: 119900 },
};

function getMrr(plan: string, period: string): number {
  return PLAN_PRICES[plan]?.[period] ?? 0;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function last6Months(): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(monthKey(d));
  }
  return keys;
}

export const GET = withAuth(
  async (_req: NextRequest) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek  = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
    const startOfMonth    = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const sixMonthsAgo    = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      allDistributors,
      totalClients,
      quotationsToday,
      quotationsWeek,
      quotationsMonth,
      gmvMonth,
      distributorGrowthRaw,
      clientGrowthRaw,
      ordersLastMonth,
    ] = await Promise.all([
      prisma.distributor.findMany({
        select: { id: true, plan: true, plan_status: true, plan_period: true, approved_by_admin: true, created_at: true },
      }),
      prisma.client.count(),
      prisma.quotation.count({ where: { created_at: { gte: startOfToday } } }),
      prisma.quotation.count({ where: { created_at: { gte: startOfWeek } } }),
      prisma.quotation.count({ where: { created_at: { gte: startOfMonth } } }),
      prisma.order.aggregate({ where: { sent_at: { gte: startOfMonth } }, _sum: { total_cents: true } }),
      prisma.distributor.findMany({ where: { created_at: { gte: sixMonthsAgo } }, select: { created_at: true } }),
      prisma.client.findMany({ where: { user: { created_at: { gte: sixMonthsAgo } } }, select: { user: { select: { created_at: true } } } }),
      prisma.order.count({ where: { sent_at: { gte: startOfLastMonth, lt: startOfMonth } } }),
    ]);

    const byStatus: Record<string, number> = {};
    let mrrTotal = 0;
    let pendingApproval = 0;

    for (const d of allDistributors) {
      byStatus[d.plan_status] = (byStatus[d.plan_status] ?? 0) + 1;
      if (["active", "trial"].includes(d.plan_status)) mrrTotal += getMrr(d.plan, d.plan_period);
      if (!d.approved_by_admin && d.plan_status !== "cancelled") pendingApproval++;
    }

    const keys = last6Months();
    const distByMonth: Record<string, number>   = Object.fromEntries(keys.map((k) => [k, 0]));
    const clientByMonth: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]));

    for (const d of distributorGrowthRaw) {
      const k = monthKey(d.created_at);
      if (k in distByMonth) distByMonth[k]++;
    }
    for (const c of clientGrowthRaw) {
      const k = monthKey(c.user.created_at);
      if (k in clientByMonth) clientByMonth[k]++;
    }

    const ordersThisMonth = quotationsMonth; // reuse quotation count as proxy
    const ordersMoM = ordersLastMonth === 0 ? null :
      Math.round(((ordersThisMonth - ordersLastMonth) / ordersLastMonth) * 10000) / 100;

    return Response.json({
      period_month: monthKey(now),
      clients:      { total: totalClients },
      distributors: {
        total: allDistributors.length,
        by_status: byStatus,
        pending_approval: pendingApproval,
      },
      quotations:   { today: quotationsToday, week: quotationsWeek, month: quotationsMonth },
      orders:       { this_month: ordersThisMonth, last_month: ordersLastMonth, mom_change_percent: ordersMoM },
      mrr_cents:    mrrTotal,
      gmv_month_cents: gmvMonth._sum.total_cents ?? 0,
      distributor_growth: keys.map((month) => ({ month, count: distByMonth[month] })),
      client_growth:      keys.map((month) => ({ month, count: clientByMonth[month] })),
      mrr_by_month:       keys.map((month) => ({ month, mrr_cents: mrrTotal })),
    });
  },
  { roles: ["platform_admin"] }
);
