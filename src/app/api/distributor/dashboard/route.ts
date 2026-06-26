import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/distributor/dashboard
 *
 * Métricas do dia para a distribuidora autenticada.
 * Calculadas em tempo real (sem cache).
 * "Hoje" = dia corrente no fuso BRT (UTC-3).
 *
 * Retorna:
 *   today:                  string (data BRT, ex: "2026-04-09")
 *   new_orders_today:       pedidos recebidos hoje
 *   clients_today:          clientes distintos que enviaram pedidos hoje
 *   approved_orders_today:  pedidos aprovados hoje
 *   pending_orders:         pedidos aguardando resposta (status sent ou viewed)
 *   last_price_update:      data/hora da última atualização de preço
 *   active_products:        produtos com available=true
 *   inactive_products:      produtos com available=false
 *   total_products:         total de produtos cadastrados
 */
export const GET = withAuth(
  async (_req: NextRequest, user) => {
    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true, plan: true, plan_status: true },
    });
    if (!distributor) {
      return Response.json({ error: "Perfil de distribuidora não encontrado" }, { status: 404 });
    }

    // ── "Hoje" em BRT (UTC-3) ────────────────────────────────────────────────
    const nowBRT = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const startOfTodayBRT = new Date(nowBRT);
    startOfTodayBRT.setUTCHours(0, 0, 0, 0);
    // Converte de volta para UTC para comparar com timestamps do banco
    const startOfTodayUTC = new Date(startOfTodayBRT.getTime() + 3 * 60 * 60 * 1000);

    const todayLabel = nowBRT.toISOString().slice(0, 10); // "2026-04-09"

    const distId = distributor.id;

    const [
      newOrdersToday,
      approvedOrdersToday,
      pendingOrders,
      productStats,
      lastPriceUpdate,
    ] = await Promise.all([
      // Pedidos recebidos hoje
      prisma.order.findMany({
        where: { distributor_id: distId, sent_at: { gte: startOfTodayUTC } },
        select: { client_id: true },
      }),

      // Pedidos aprovados hoje
      prisma.order.count({
        where: {
          distributor_id: distId,
          status: "approved",
          updated_at: { gte: startOfTodayUTC },
        },
      }),

      // Pedidos aguardando resposta
      prisma.order.count({
        where: {
          distributor_id: distId,
          status: { in: ["sent", "viewed"] },
        },
      }),

      // Produtos ativos e inativos
      prisma.product.groupBy({
        by: ["available"],
        where: { distributor_id: distId },
        _count: { id: true },
      }),

      // Última atualização de preço
      prisma.product.findFirst({
        where: { distributor_id: distId },
        orderBy: { price_updated_at: "desc" },
        select: { price_updated_at: true },
      }),
    ]);

    const clientsToday = new Set(newOrdersToday.map((o) => o.client_id)).size;

    const activeProducts =
      productStats.find((s) => s.available === true)?._count.id ?? 0;
    const inactiveProducts =
      productStats.find((s) => s.available === false)?._count.id ?? 0;

    return Response.json({
      today: todayLabel,
      plan: distributor.plan,
      plan_status: distributor.plan_status,
      new_orders_today: newOrdersToday.length,
      clients_today: clientsToday,
      approved_orders_today: approvedOrdersToday,
      pending_orders: pendingOrders,
      last_price_update: lastPriceUpdate?.price_updated_at ?? null,
      active_products: activeProducts,
      inactive_products: inactiveProducts,
      total_products: activeProducts + inactiveProducts,
    });
  },
  { roles: ["distributor_admin", "distributor_collaborator"] }
);
