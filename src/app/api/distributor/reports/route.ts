import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/distributor/reports?period=7d|30d|90d
 *
 * Retorna:
 *   summary:      total_orders, approved, rejected, pending, revenue_cents, avg_ticket_cents
 *   by_day:       [{ date, total, approved }] — para gráfico de barras
 *   top_clients:  [{ company_name, city, state, orders, revenue_cents }]
 *   top_cities:   [{ city, state, orders, revenue_cents }]
 *   feedback:     { ok, problem, auto_ok, pending }
 */
export const GET = withAuth(
  async (req: NextRequest, user) => {
    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true, plan: true },
    });
    if (!distributor) {
      return Response.json({ error: "Perfil não encontrado" }, { status: 404 });
    }

    const limited = !["operacional", "enterprise"].includes(distributor.plan);

    const { searchParams } = new URL(req.url);
    const period = limited ? "7d" : (searchParams.get("period") ?? "30d");
    const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const distId = distributor.id;

    const [orders, feedbackCounts] = await Promise.all([
      prisma.order.findMany({
        where: { distributor_id: distId, sent_at: { gte: since } },
        select: {
          id: true,
          status: true,
          total_cents: true,
          sent_at: true,
          client: {
            select: {
              company_name: true,
              delivery_city: true,
              delivery_state: true,
            },
          },
        },
        orderBy: { sent_at: "asc" },
      }),

      prisma.paymentFeedback.groupBy({
        by: ["status"],
        where: { distributor_id: distId, created_at: { gte: since } },
        _count: { id: true },
      }),
    ]);

    // ── Summary ───────────────────────────────────────────────────────────────
    const approved = orders.filter((o) => o.status === "approved");
    const revenue_cents = approved.reduce((s, o) => s + o.total_cents, 0);

    const summary = {
      total_orders: orders.length,
      approved_orders: approved.length,
      rejected_orders: orders.filter((o) => o.status === "rejected").length,
      pending_orders: orders.filter((o) => ["sent", "viewed"].includes(o.status)).length,
      revenue_cents,
      avg_ticket_cents: approved.length > 0 ? Math.round(revenue_cents / approved.length) : 0,
    };

    // ── Por dia ───────────────────────────────────────────────────────────────
    const dayMap = new Map<string, { total: number; approved: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      dayMap.set(key, { total: 0, approved: 0 });
    }
    for (const o of orders) {
      const key = new Date(o.sent_at).toISOString().slice(0, 10);
      const entry = dayMap.get(key);
      if (entry) {
        entry.total++;
        if (o.status === "approved") entry.approved++;
      }
    }
    const by_day = Array.from(dayMap.entries()).map(([date, v]) => ({ date, ...v }));

    // ── Top clientes ──────────────────────────────────────────────────────────
    const clientMap = new Map<string, {
      company_name: string; city: string; state: string; orders: number; revenue_cents: number;
    }>();
    for (const o of orders) {
      const key = o.client.company_name;
      const existing = clientMap.get(key);
      if (existing) {
        existing.orders++;
        if (o.status === "approved") existing.revenue_cents += o.total_cents;
      } else {
        clientMap.set(key, {
          company_name: o.client.company_name,
          city: o.client.delivery_city,
          state: o.client.delivery_state,
          orders: 1,
          revenue_cents: o.status === "approved" ? o.total_cents : 0,
        });
      }
    }
    const top_clients = Array.from(clientMap.values())
      .sort((a, b) => b.revenue_cents - a.revenue_cents || b.orders - a.orders)
      .slice(0, 5);

    // ── Top cidades ───────────────────────────────────────────────────────────
    const cityMap = new Map<string, { city: string; state: string; orders: number; revenue_cents: number }>();
    for (const o of orders) {
      const key = `${o.client.delivery_city}||${o.client.delivery_state}`;
      const existing = cityMap.get(key);
      if (existing) {
        existing.orders++;
        if (o.status === "approved") existing.revenue_cents += o.total_cents;
      } else {
        cityMap.set(key, {
          city: o.client.delivery_city,
          state: o.client.delivery_state,
          orders: 1,
          revenue_cents: o.status === "approved" ? o.total_cents : 0,
        });
      }
    }
    const top_cities = Array.from(cityMap.values())
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 5);

    // ── Feedback ──────────────────────────────────────────────────────────────
    const feedbackByStatus: Record<string, number> = {};
    for (const f of feedbackCounts) feedbackByStatus[f.status] = f._count.id;
    const feedback = {
      ok:       feedbackByStatus["ok"]       ?? 0,
      problem:  feedbackByStatus["problem"]  ?? 0,
      auto_ok:  feedbackByStatus["auto_ok"]  ?? 0,
      pending:  feedbackByStatus["pending"]  ?? 0,
    };

    return Response.json({
      limited,
      period,
      summary,
      by_day,
      top_clients: limited ? [] : top_clients,
      top_cities:  limited ? [] : top_cities,
      feedback,
    });
  },
  { roles: ["distributor_admin", "distributor_collaborator"] }
);
