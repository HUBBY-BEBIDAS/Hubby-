import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { notifyOrderStatusUpdated } from "@/lib/notifications";

const statusSchema = z.object({
  status: z.enum(["viewed", "approved", "rejected"], {
    message: "status deve ser 'viewed', 'approved' ou 'rejected'",
  }),
});

/**
 * PATCH /api/distributor/orders/:id/status
 *
 * Distribuidora atualiza o status de um pedido recebido.
 *
 * Transições permitidas:
 *   sent      → viewed | approved | rejected
 *   viewed    → approved | rejected
 *   approved  → (terminal — não pode regredir)
 *   rejected  → (terminal — não pode regredir)
 *
 * A distribuidora vê apenas seus próprios pedidos.
 * O cliente é notificado in-app quando o status muda para approved ou rejected.
 */
export const PATCH = withAuth(
  async (req: NextRequest, user, context) => {
    const orderId = context?.params.id;
    if (!orderId) {
      return Response.json({ error: "ID do pedido não fornecido" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const { status: newStatus } = parsed.data;

    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true, company_name: true },
    });
    if (!distributor) {
      return Response.json({ error: "Perfil de distribuidora não encontrado" }, { status: 404 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        distributor_id: true,
        client: {
          select: {
            user: { select: { id: true } },
          },
        },
      },
    });

    if (!order || order.distributor_id !== distributor.id) {
      return Response.json({ error: "Pedido não encontrado" }, { status: 404 });
    }

    // Valida transição de estado
    const TERMINAL = ["approved", "rejected"];
    if (TERMINAL.includes(order.status)) {
      return Response.json(
        {
          error: `Pedido já está em estado terminal: ${order.status}`,
          current_status: order.status,
        },
        { status: 409 }
      );
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus },
      select: {
        id: true,
        group_id: true,
        status: true,
        total_cents: true,
        estimated_delivery_date: true,
        updated_at: true,
      },
    });

    // Notifica o cliente apenas para transições finais (aprovado / recusado)
    if (newStatus === "approved" || newStatus === "rejected") {
      notifyOrderStatusUpdated({
        client_user_id: order.client.user.id,
        distributor_name: distributor.company_name,
        order_id: orderId,
        new_status: newStatus,
      }).catch((err) => console.error("[order status] Notificação falhou:", err));
    }

    return Response.json(updated);
  },
  { roles: ["distributor_admin", "distributor_collaborator"] }
);
