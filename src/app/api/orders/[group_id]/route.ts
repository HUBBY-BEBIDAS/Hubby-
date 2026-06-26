import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/orders/:group_id
 *
 * Detalhe completo de um grupo de pedidos (envio multi-distribuidora).
 * Inclui os itens de cada pedido (items_snapshot).
 * Apenas o cliente dono do grupo pode acessar.
 */
export const GET = withAuth(
  async (_req: NextRequest, user, context) => {
    const groupId = context?.params.group_id;
    if (!groupId) {
      return Response.json({ error: "group_id não fornecido" }, { status: 400 });
    }

    const client = await prisma.client.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!client) {
      return Response.json({ error: "Perfil de cliente não encontrado" }, { status: 404 });
    }

    const orders = await prisma.order.findMany({
      where: { group_id: groupId, client_id: client.id },
      orderBy: { sent_at: "asc" },
      select: {
        id: true,
        group_id: true,
        status: true,
        total_cents: true,
        items_snapshot: true,
        estimated_delivery_date: true,
        sent_at: true,
        updated_at: true,
        distributor: {
          select: { id: true, company_name: true, whatsapp_commercial: true },
        },
        quotation: {
          select: {
            id: true,
            delivery_city: true,
            delivery_state: true,
            max_delivery_days: true,
            items: {
              select: {
                id: true,
                product_name: true,
                brand: true,
                category: true,
                packaging: true,
                quantity: true,
              },
            },
          },
        },
      },
    });

    if (orders.length === 0) {
      return Response.json({ error: "Grupo de pedidos não encontrado" }, { status: 404 });
    }

    const first = orders[0];

    return Response.json({
      group_id: groupId,
      quotation_id: first.quotation.id,
      delivery_city: first.quotation.delivery_city,
      delivery_state: first.quotation.delivery_state,
      max_delivery_days: first.quotation.max_delivery_days,
      sent_at: first.sent_at,
      total_cents: orders.reduce((sum, o) => sum + o.total_cents, 0),
      // Itens da cotação original (o que o cliente pediu para cotar)
      quotation_items: first.quotation.items,
      orders: orders.map((o) => ({
        id: o.id,
        distributor_id: o.distributor.id,
        distributor_name: o.distributor.company_name,
        status: o.status,
        total_cents: o.total_cents,
        // Itens específicos desta distribuidora no momento do envio
        items: o.items_snapshot,
        estimated_delivery_date: o.estimated_delivery_date,
        updated_at: o.updated_at,
      })),
    });
  },
  { roles: ["client"] }
);
