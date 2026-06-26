import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

const SCORE_MIN = 0;
const SCORE_MAX = 1000;

function clampScore(base: number, delta: number): number {
  return Math.max(SCORE_MIN, Math.min(SCORE_MAX, base + delta));
}

const respondSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ok") }),
  z.object({
    status: z.literal("problem"),
    problem_type: z.enum(["late_payment", "no_payment", "returned_goods", "other"]),
    notes: z.string().max(500).optional(),
  }),
  z.object({ status: z.literal("cancelled") }),
]);

function computeScoreDelta(data: z.infer<typeof respondSchema>): number {
  if (data.status === "ok") return 10;
  if (data.status === "cancelled") return 0;
  switch (data.problem_type) {
    case "late_payment":   return -30;
    case "no_payment":     return -100;
    case "returned_goods": return 0;
    case "other":          return 0;
  }
}

/**
 * POST /api/distributor/payment-feedback/:orderId
 *
 * Distribuidora responde ao feedback de pagamento de um pedido.
 * Body:
 *   { status: "ok" }
 *   { status: "problem", problem_type: "late_payment"|"no_payment"|"returned_goods"|"other", notes? }
 *   { status: "cancelled" }
 *
 * Score Hubby do comprador:
 *   ok            → +10
 *   late_payment  → -30
 *   no_payment    → -100
 *   cancelled / other → 0
 */
export const POST = withAuth(
  async (req: NextRequest, user, ctx) => {
    const orderId = ctx?.params.orderId;
    if (!orderId) {
      return Response.json({ error: "orderId ausente" }, { status: 400 });
    }

    let body: unknown;
    try { body = await req.json(); } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const parsed = respondSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 });
    }

    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!distributor) {
      return Response.json({ error: "Perfil de distribuidora não encontrado" }, { status: 404 });
    }

    const feedback = await prisma.paymentFeedback.findUnique({
      where: { order_id: orderId },
      select: { id: true, status: true, distributor_id: true, client_id: true },
    });

    if (!feedback) {
      return Response.json({ error: "Feedback não encontrado para este pedido" }, { status: 404 });
    }
    if (feedback.distributor_id !== distributor.id) {
      return Response.json({ error: "Acesso negado" }, { status: 403 });
    }
    if (feedback.status !== "pending") {
      return Response.json({ error: "Este pedido já recebeu feedback" }, { status: 409 });
    }

    const d = parsed.data;
    const delta = computeScoreDelta(d);

    const currentClient = await prisma.client.findUnique({
      where: { id: feedback.client_id },
      select: { hubby_score: true },
    });

    const newScore = currentClient
      ? clampScore(currentClient.hubby_score, delta)
      : Math.max(SCORE_MIN, Math.min(SCORE_MAX, 500 + delta));

    await prisma.$transaction([
      prisma.paymentFeedback.update({
        where: { id: feedback.id },
        data: {
          status:       d.status,
          problem_type: d.status === "problem" ? d.problem_type : null,
          notes:        d.status === "problem" ? (d.notes ?? null) : null,
          responded_at: new Date(),
        },
      }),
      prisma.client.update({
        where: { id: feedback.client_id },
        data: { hubby_score: newScore },
      }),
    ]);

    return Response.json({ ok: true, score_delta: delta, new_score: newScore });
  },
  { roles: ["distributor_admin", "distributor_collaborator"] }
);
