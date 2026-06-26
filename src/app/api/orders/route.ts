import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/orders
 *
 * Histórico de pedidos do cliente autenticado, agrupado por group_id.
 * Ordenado por data de envio (mais recente primeiro).
 *
 * Query params:
 *   page?:  number (padrão 1)
 *   limit?: number (padrão 20, máx 100)
 *   status?: "sent" | "viewed" | "approved" | "rejected"
 */
export const GET = withAuth(
  async (req: NextRequest, user) => {
    const client = await prisma.client.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!client) {
      return Response.json({ error: "Perfil de cliente não encontrado" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "20")));
    const statusFilter = searchParams.get("status");

    const validStatuses = ["sent", "viewed", "approved", "rejected"];
    const where = {
      client_id: client.id,
      ...(statusFilter && validStatuses.includes(statusFilter)
        ? { status: statusFilter as "sent" | "viewed" | "approved" | "rejected" }
        : {}),
    };

    // Busca os group_ids distintos paginados — cada "linha" do histórico é um grupo
    const groupIds = await prisma.order.findMany({
      where,
      select: { group_id: true, sent_at: true },
      distinct: ["group_id"],
      orderBy: { sent_at: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    if (groupIds.length === 0) {
      return Response.json({ data: [], pagination: { total: 0, page, limit, total_pages: 0 } });
    }

    const ids = groupIds.map((g) => g.group_id);

    // Carrega todos os pedidos dos grupos encontrados
    const orders = await prisma.order.findMany({
      where: { client_id: client.id, group_id: { in: ids } },
      orderBy: { sent_at: "desc" },
      select: {
        id: true,
        group_id: true,
        status: true,
        total_cents: true,
        estimated_delivery_date: true,
        sent_at: true,
        updated_at: true,
        distributor: {
          select: { id: true, company_name: true },
        },
        quotation: {
          select: { id: true, delivery_city: true, delivery_state: true },
        },
      },
    });

    // Agrupa por group_id mantendo a ordem dos group_ids paginados
    const grouped = ids.map((gid) => {
      const groupOrders = orders.filter((o) => o.group_id === gid);
      const first = groupOrders[0];
      return {
        group_id: gid,
        quotation_id: first?.quotation.id,
        delivery_city: first?.quotation.delivery_city,
        delivery_state: first?.quotation.delivery_state,
        sent_at: first?.sent_at,
        orders: groupOrders.map((o) => ({
          id: o.id,
          distributor_id: o.distributor.id,
          distributor_name: o.distributor.company_name,
          status: o.status,
          total_cents: o.total_cents,
          estimated_delivery_date: o.estimated_delivery_date,
          updated_at: o.updated_at,
        })),
        total_cents: groupOrders.reduce((sum, o) => sum + o.total_cents, 0),
      };
    });

    const totalGroups = await prisma.order.findMany({
      where,
      select: { group_id: true },
      distinct: ["group_id"],
    });

    return Response.json({
      data: grouped,
      pagination: {
        total: totalGroups.length,
        page,
        limit,
        total_pages: Math.ceil(totalGroups.length / limit),
      },
    });
  },
  { roles: ["client"] }
);
