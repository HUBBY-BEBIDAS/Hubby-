import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyDistributorPaymentFeedback } from "@/lib/notifications";
import { sendPaymentFeedbackEmail } from "@/lib/email";

const TRIGGER_DAYS   = 15; // dias após sent_at para solicitar feedback
const AUTO_CLOSE_DAYS = 7; // dias após notified_at para auto-fechar como ok

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

/**
 * POST /api/cron/payment-feedback
 *
 * Executar diariamente (ex: Vercel Cron Jobs às 08h00).
 * Protegido por CRON_SECRET no header Authorization.
 *
 * Passo 1 — Cria feedbacks pendentes para pedidos com +15 dias sem feedback
 * Passo 2 — Auto-fecha feedbacks notificados há +7 dias sem resposta (status: auto_ok)
 */
export async function POST(req: NextRequest) {
  const auth   = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;

  if (secret && auth !== `Bearer ${secret}`) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const [notified, autoClosed] = await Promise.all([
      triggerPendingFeedbacks(),
      autoCloseStaleFeedbacks(),
    ]);

    console.log(
      `[cron/payment-feedback] notificados=${notified} auto_fechados=${autoClosed}`
    );

    return Response.json({ ok: true, notified, auto_closed: autoClosed });
  } catch (err) {
    console.error("[cron/payment-feedback]", err);
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
}

// GET — teste manual em dev
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Não disponível" }, { status: 403 });
  }
  return POST(req);
}

// ─────────────────────────────────────────────────────────────────────────────

async function triggerPendingFeedbacks(): Promise<number> {
  // Pedidos aprovados ou enviados há +15 dias sem feedback criado
  const orders = await prisma.order.findMany({
    where: {
      status: { in: ["approved", "sent"] },
      sent_at: { lte: daysAgo(TRIGGER_DAYS) },
      payment_feedback: null,
    },
    select: {
      id: true,
      total_cents: true,
      sent_at: true,
      client_id: true,
      distributor_id: true,
      client: { select: { company_name: true } },
      distributor: {
        select: {
          email_commercial: true,
          company_name: true,
          user: { select: { id: true } },
        },
      },
    },
    take: 200, // segurança contra loops grandes
  });

  if (orders.length === 0) return 0;

  const now = new Date();

  // Cria registros em lote e notifica em paralelo
  await Promise.all(
    orders.map(async (order) => {
      try {
        await prisma.paymentFeedback.create({
          data: {
            order_id:       order.id,
            distributor_id: order.distributor_id,
            client_id:      order.client_id,
            status:         "pending",
            notified_at:    now,
          },
        });

        await Promise.all([
          notifyDistributorPaymentFeedback({
            distributor_user_id: order.distributor.user.id,
            client_name:         order.client.company_name,
            order_id:            order.id,
            total_cents:         order.total_cents,
          }),
          sendPaymentFeedbackEmail({
            to:               order.distributor.email_commercial,
            distributorName:  order.distributor.company_name,
            clientName:       order.client.company_name,
            totalCents:       order.total_cents,
            orderId:          order.id,
            sentAt:           order.sent_at,
          }).catch((e) =>
            console.error(`[cron/payment-feedback] email falhou para order ${order.id}:`, e)
          ),
        ]);
      } catch (e) {
        console.error(`[cron/payment-feedback] falha ao criar feedback order ${order.id}:`, e);
      }
    })
  );

  return orders.length;
}

async function autoCloseStaleFeedbacks(): Promise<number> {
  // Feedbacks pendentes notificados há +7 dias sem resposta → auto_ok
  const stale = await prisma.paymentFeedback.findMany({
    where: {
      status:       "pending",
      notified_at:  { lte: daysAgo(AUTO_CLOSE_DAYS) },
    },
    select: { id: true },
    take: 500,
  });

  if (stale.length === 0) return 0;

  await prisma.paymentFeedback.updateMany({
    where: { id: { in: stale.map((f) => f.id) } },
    data: {
      status:       "auto_ok",
      responded_at: new Date(),
    },
  });

  // auto_ok não altera hubby_score (neutro — não penaliza)
  return stale.length;
}
