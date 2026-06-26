import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/orders/:group_id/reorder
 *
 * Recompra com 1 clique: cria uma nova cotação em status "open" com os
 * mesmos produtos e quantidades da cotação original.
 *
 * - Produtos que não existem mais no catálogo de nenhuma distribuidora
 *   são sinalizados no campo `unavailable_items` mas não removidos —
 *   o ranking vai simplesmente não encontrar match para eles.
 * - Localidade e prazo herdados da cotação original.
 *
 * Resposta:
 *   quotation:        { id, status: "open", items, delivery_city, ... }
 *   unavailable_items: string[]  — produtos sem correspondência no catálogo atual
 *   original_group_id: string
 */
export const POST = withAuth(
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

    // Busca cotação original via um pedido do grupo
    const originalOrder = await prisma.order.findFirst({
      where: { group_id: groupId, client_id: client.id },
      select: {
        quotation: {
          select: {
            id: true,
            delivery_city: true,
            delivery_state: true,
            max_delivery_days: true,
            items: {
              select: {
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

    if (!originalOrder) {
      return Response.json({ error: "Grupo de pedidos não encontrado" }, { status: 404 });
    }

    const orig = originalOrder.quotation;

    if (orig.items.length === 0) {
      return Response.json(
        { error: "Cotação original não possui itens para recompra" },
        { status: 422 }
      );
    }

    // Verifica quais produtos ainda existem no catálogo (por brand + category)
    const unavailableItems: string[] = [];

    for (const item of orig.items) {
      const exists = await prisma.product.findFirst({
        where: {
          available: true,
          brand: { equals: item.brand, mode: "insensitive" },
          category: item.category as never,
          distributor: {
            approved_by_admin: true,
            plan_status: { in: ["active", "trial"] },
          },
        },
        select: { id: true },
      });

      if (!exists) {
        unavailableItems.push(`${item.brand} ${item.product_name}`);
      }
    }

    // Cria nova cotação em status "open" (direto para ranking)
    const newQuotation = await prisma.quotation.create({
      data: {
        client_id: client.id,
        status: "open",
        delivery_city:     orig.delivery_city,
        delivery_state:    orig.delivery_state,
        max_delivery_days: orig.max_delivery_days,
        items: {
          create: orig.items.map((item) => ({
            product_name: item.product_name,
            brand:        item.brand,
            category:     item.category,
            packaging:    item.packaging,
            quantity:     item.quantity,
          })),
        },
      },
      include: { items: true },
    });

    return Response.json(
      {
        quotation:         newQuotation,
        unavailable_items: unavailableItems,
        original_group_id: groupId,
        original_quotation_id: orig.id,
      },
      { status: 201 }
    );
  },
  { roles: ["client"] }
);
