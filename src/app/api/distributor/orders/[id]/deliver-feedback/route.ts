import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

const SCORE_MIN = 0;
const SCORE_MAX = 1000;

const schema = z.discriminatedUnion("payment_status", [
  z.object({ payment_status: z.literal("ok") }),
  z.object({
    payment_status: z.literal("late_payment"),
    notes: z.string().max(100).optional(),
  }),
  z.object({
    payment_status: z.literal("no_payment"),
    notes: z.string().max(100).optional(),
  }),
  z.object({ payment_status: z.literal("skip") }),
]);

const SCORE_DELTA: Record<string, number> = {
  ok:          10,
  late_payment: -30,
  no_payment:  -100,
  skip:         0,
};

/**
 * POST /api/distributor/orders/:id/deliver-feedback
 *
 * Marca o pedido como entregue e registra o feedback de pagamento imediatamente.
 * payment_status: "ok" | "late_payment" | "no_payment" | "skip"
 *
 * - Transição permitida: approved → delivered
 * - Cria ou atualiza PaymentFeedback
 * - Ajusta hubby_score do comprador (exceto skip)
 */
export const POST = withAuth(
  async (req: NextRequest, user, context) => {
    const orderId = context?.params.id;
    if (!orderId) return Response.json({ error: "ID ausente" }, { status: 400 });

    let body: unknown;
    try { body = await req.json(); } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 });
    }

    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!distributor) return Response.json({ error: "Distribuidor não encontrado" }, { status: 404 });

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, distributor_id: true, client_id: true },
    });
    if (!order || order.distributor_id !== distributor.id) {
      return Response.json({ error: "Pedido não encontrado" }, { status: 404 });
    }
    if (order.status !== "approved") {
      return Response.json({ error: "Só pedidos aprovados podem ser marcados como entregues" }, { status: 409 });
    }

    const d = parsed.data;
    const isSkip = d.payment_status === "skip";
    const delta = SCORE_DELTA[d.payment_status] ?? 0;

    const feedbackStatus = isSkip
      ? "pending"
      : d.payment_status === "ok"
        ? "ok"
        : "problem";

    const problemType = !isSkip && d.payment_status !== "ok"
      ? d.payment_status
      : null;

    const notes = !isSkip && d.payment_status !== "ok" && "notes" in d
      ? (d.notes ?? null)
      : null;

    const now = new Date();

    const currentClient = await prisma.client.findUnique({
      where: { id: order.client_id },
      select: { hubby_score: true },
    });
    const newScore = currentClient
      ? Math.max(SCORE_MIN, Math.min(SCORE_MAX, currentClient.hubby_score + delta))
      : Math.max(SCORE_MIN, Math.min(SCORE_MAX, 500 + delta));

    await prisma.$transaction([
      // 1. Mark as delivered
      prisma.order.update({
        where: { id: orderId },
        data: { status: "delivered", updated_at: now },
      }),
      // 2. Create or update payment feedback
      prisma.paymentFeedback.upsert({
        where:  { order_id: orderId },
        create: {
          order_id:       orderId,
          distributor_id: distributor.id,
          client_id:      order.client_id,
          status:         feedbackStatus,
          problem_type:   problemType,
          notes,
          notified_at:    now,
          responded_at:   isSkip ? null : now,
        },
        update: {
          status:       feedbackStatus,
          problem_type: problemType,
          notes,
          responded_at: isSkip ? null : now,
        },
      }),
      // 3. Adjust hubby_score (skip → no delta)
      ...(delta !== 0
        ? [prisma.client.update({
            where: { id: order.client_id },
            data:  { hubby_score: newScore },
          })]
        : []),
    ]);

    return Response.json({ ok: true, score_delta: delta });
  },
  { roles: ["distributor_admin", "distributor_collaborator"] }
);
