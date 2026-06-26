import { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { applyReferralReward } from "@/lib/referral";
import type Stripe from "stripe";

/**
 * POST /api/billing/webhook
 *
 * Recebe eventos do Stripe. Obrigatoriamente validado com stripe-signature.
 * Nunca processar eventos sem validar a assinatura.
 *
 * Eventos tratados:
 *   checkout.session.completed         → assinatura criada → plan_status = "trial"
 *   customer.subscription.updated      → plano ou status mudou → sincroniza
 *   customer.subscription.deleted      → cancelado → plan_status = "cancelled"
 *   invoice.payment_succeeded          → renovação paga → plan_status = "active"
 *   invoice.payment_failed             → falha no pagamento → plan_status = "suspended"
 *
 * IMPORTANTE: Esta rota não usa withAuth — autenticação é feita via stripe-signature.
 * O Next.js não deve modificar o body — lemos o raw buffer para validar a assinatura.
 */
export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return Response.json(
      { error: "stripe-signature ou STRIPE_WEBHOOK_SECRET ausentes" },
      { status: 400 }
    );
  }

  // Lê o body como raw bytes para validação da assinatura
  let event: Stripe.Event;
  try {
    const rawBody = await req.arrayBuffer();
    event = stripe.webhooks.constructEvent(
      Buffer.from(rawBody),
      signature,
      webhookSecret
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Assinatura inválida";
    console.error("[webhook] Falha na validação da assinatura Stripe:", msg);
    return Response.json({ error: `Webhook inválido: ${msg}` }, { status: 400 });
  }

  // ─── Roteamento de eventos ────────────────────────────────────────────────

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        // Evento não tratado — retorna 200 para o Stripe não reenviar
        break;
    }
  } catch (err) {
    console.error(`[webhook] Erro ao processar evento ${event.type}:`, err);
    // Retorna 500 para o Stripe tentar reenviar
    return Response.json({ error: "Erro interno ao processar evento" }, { status: 500 });
  }

  return Response.json({ received: true });
}

// ─── Handlers individuais ─────────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const entityType = session.metadata?.entity_type ?? "distributor";
  const plan = session.metadata?.plan;
  if (!plan) return;

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  const period = (session.metadata?.period ?? "monthly") as "monthly" | "quarterly" | "semiannual" | "annual";

  // ── Comprador ────────────────────────────────────────────────────────────
  if (entityType === "client") {
    const clientId = session.metadata?.client_id;
    if (!clientId) return;

    await prisma.client.update({
      where: { id: clientId },
      data: {
        client_plan: "pro",
        client_plan_status: "active",
        client_plan_period: period,
        stripe_subscription_id: subscriptionId ?? undefined,
      },
    });

    console.log(`[webhook] Checkout comprador completado: client=${clientId} plan=${plan} period=${period}`);
    return;
  }

  // ── Distribuidora ────────────────────────────────────────────────────────
  const distributorId = session.metadata?.distributor_id;
  if (!distributorId) return;

  const validPlan = ["starter", "pro", "business", "enterprise"].includes(plan)
    ? (plan as "starter" | "pro" | "business" | "enterprise")
    : "starter";

  const isBoleto = session.metadata?.payment_method === "boleto";
  // Boleto: sessão completa mas boleto ainda não foi pago → pending_payment
  // Cartão mensal: trial. Cartão outros períodos: active.
  const newStatus = isBoleto
    ? "pending_payment"
    : period === "monthly" ? "trial" : "active";

  await prisma.distributor.update({
    where: { id: distributorId },
    data: {
      plan: validPlan,
      plan_status: newStatus,
      plan_period: period,
      stripe_subscription_id: subscriptionId ?? undefined,
    },
  });

  console.log(`[webhook] Checkout completado: distributor=${distributorId} plan=${plan} period=${period} status=${newStatus}`);

  // Aplica recompensa de indicação se houver referral pendente
  if (!isBoleto) {
    const referral = await prisma.referral.findUnique({
      where: { referred_distributor_id: distributorId },
    });
    if (referral && referral.status === "pending") {
      applyReferralReward(referral.id).catch((e) =>
        console.error("[webhook] erro ao aplicar recompensa de indicação:", e)
      );
    }
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const entityType = subscription.metadata?.entity_type ?? "distributor";
  const stripeStatus = subscription.status;
  const planStatus = mapStripeToPlanStatus(stripeStatus);
  if (!planStatus) return;

  // ── Comprador ────────────────────────────────────────────────────────────
  if (entityType === "client") {
    const clientId = subscription.metadata?.client_id;
    if (!clientId) return;

    await prisma.client.update({
      where: { id: clientId },
      data: { client_plan_status: planStatus },
    });

    console.log(`[webhook] Subscription comprador atualizada: client=${clientId} status=${stripeStatus}`);
    return;
  }

  // ── Distribuidora ────────────────────────────────────────────────────────
  const distributorId = subscription.metadata?.distributor_id;
  if (!distributorId) return;

  const plan = subscription.metadata?.plan;
  const data: Record<string, unknown> = { plan_status: planStatus };

  if (plan && ["vitrine", "operacional", "enterprise"].includes(plan)) {
    data.plan = plan;
  }

  await prisma.distributor.update({
    where: { id: distributorId },
    data: data as Parameters<typeof prisma.distributor.update>[0]["data"],
  });

  console.log(`[webhook] Subscription atualizada: distributor=${distributorId} status=${stripeStatus}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const entityType = subscription.metadata?.entity_type ?? "distributor";

  // ── Comprador ────────────────────────────────────────────────────────────
  if (entityType === "client") {
    const clientId = subscription.metadata?.client_id;
    if (clientId) {
      await prisma.client.update({
        where: { id: clientId },
        data: { client_plan: "free", client_plan_status: "cancelled" },
      });
    } else {
      // Tenta pelo stripe_subscription_id
      await prisma.client.updateMany({
        where: { stripe_subscription_id: subscription.id },
        data: { client_plan: "free", client_plan_status: "cancelled" },
      });
    }
    console.log(`[webhook] Subscription comprador cancelada: client=${clientId}`);
    return;
  }

  // ── Distribuidora ────────────────────────────────────────────────────────
  const distributorId = subscription.metadata?.distributor_id;
  if (!distributorId) {
    const dist = await prisma.distributor.findUnique({
      where: { stripe_subscription_id: subscription.id },
      select: { id: true },
    });
    if (!dist) return;

    await prisma.distributor.update({
      where: { id: dist.id },
      data: { plan_status: "cancelled" },
    });
    return;
  }

  await prisma.distributor.update({
    where: { id: distributorId },
    data: { plan_status: "cancelled" },
  });

  console.log(`[webhook] Subscription cancelada: distributor=${distributorId}`);
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (!subscriptionId) return;

  // Ignora faturas do trial (amount_paid === 0)
  if (invoice.amount_paid === 0) return;

  // Atualiza distribuidoras
  await prisma.distributor.updateMany({
    where: { stripe_subscription_id: subscriptionId },
    data: { plan_status: "active" },
  });

  // Atualiza compradores
  await prisma.client.updateMany({
    where: { stripe_subscription_id: subscriptionId },
    data: { client_plan_status: "active" },
  });

  console.log(`[webhook] Pagamento recebido: subscription=${subscriptionId}`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (!subscriptionId) return;

  // Atualiza distribuidoras
  await prisma.distributor.updateMany({
    where: { stripe_subscription_id: subscriptionId },
    data: { plan_status: "suspended" },
  });

  // Atualiza compradores
  await prisma.client.updateMany({
    where: { stripe_subscription_id: subscriptionId },
    data: { client_plan_status: "suspended" },
  });

  console.log(`[webhook] Pagamento falhou: subscription=${subscriptionId}`);
}

/**
 * Extrai o subscription ID de uma Invoice.
 * Na API 2026-03-25.dahlia o campo está em parent.subscription_details.subscription.
 */
function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const parent = invoice.parent as
    | { type: string; subscription_details?: { subscription?: string | Stripe.Subscription | null } }
    | null
    | undefined;

  if (parent?.type === "subscription_details") {
    const sub = parent.subscription_details?.subscription;
    if (typeof sub === "string") return sub;
    if (sub && typeof sub === "object") return (sub as Stripe.Subscription).id;
  }
  return null;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function mapStripeToPlanStatus(
  stripeStatus: string
): "trial" | "active" | "suspended" | "cancelled" | "pending_payment" | null {
  switch (stripeStatus) {
    case "trialing":           return "trial";
    case "active":             return "active";
    case "incomplete":         return "pending_payment"; // boleto gerado, aguardando pagamento
    case "past_due":
    case "unpaid":
    case "incomplete_expired":
    case "paused":             return "suspended";
    case "canceled":           return "cancelled";
    default:                   return null;
  }
}
