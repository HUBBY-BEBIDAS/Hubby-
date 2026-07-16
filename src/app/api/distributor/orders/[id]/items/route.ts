import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

const itemsSchema = z.object({
  items_snapshot: z.array(z.any()),
});

/**
 * PATCH /api/distributor/orders/:id/items
 *
 * Atualiza o snapshot de itens de um pedido (usado para salvar o checklist de preparo).
 */
export const PATCH = withAuth(
  async (req: NextRequest, user, context) => {
    const orderId = context?.params?.id;
    if (!orderId) {
      return Response.json({ error: "ID do pedido não fornecido" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const parsed = itemsSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const { items_snapshot } = parsed.data;

    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!distributor) {
      return Response.json({ error: "Perfil de distribuidora não encontrado" }, { status: 404 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        distributor_id: true,
      },
    });

    if (!order || order.distributor_id !== distributor.id) {
      return Response.json({ error: "Pedido não encontrado" }, { status: 404 });
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { items_snapshot },
      select: {
        id: true,
        status: true,
        total_cents: true,
        items_snapshot: true,
        updated_at: true,
      },
    });

    return Response.json(updated);
  },
  { roles: ["distributor_admin", "distributor_collaborator"] }
);
