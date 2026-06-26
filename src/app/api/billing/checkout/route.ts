import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import {
  stripe,
  getDistributorPriceId,
  DISTRIBUTOR_MONTHLY_DISPLAY,
  PERIOD_LABELS,
  PERIOD_MONTHS,
  TRIAL_PERIOD_DAYS,
} from "@/lib/stripe";
import type { DistributorPlanKey, PeriodKey } from "@/lib/stripe";

const checkoutSchema = z.object({
  plan: z.enum(["starter", "pro", "business"], {
    message: "Plano inválido. Escolha: starter, pro ou business",
  }),
  period: z.enum(["monthly", "quarterly", "semiannual", "annual"]).default("monthly"),
  payment_method: z.enum(["card", "boleto"]).default("card"),
  success_url: z.string().url("URL de sucesso inválida").optional(),
  cancel_url:  z.string().url("URL de cancelamento inválida").optional(),
});

const APP_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

/**
 * POST /api/billing/checkout
 *
 * Cria sessão de checkout Stripe para o plano + período escolhidos.
 * - Plano mensal: trial de 14 dias (cartão obrigatório).
 * - Demais períodos: cobrado imediatamente sem trial.
 */
export const POST = withAuth(
  async (req: NextRequest, user) => {
    let body: unknown;
    try { body = await req.json(); } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const { plan, period, payment_method, success_url, cancel_url } = parsed.data;
    const planKey  = plan   as DistributorPlanKey;
    const periodKey = period as PeriodKey;
    // Boleto não suporta trial — cobrança imediata
    const isBoleto = payment_method === "boleto";

    const priceId = getDistributorPriceId(planKey, periodKey);
    if (!priceId) {
      return Response.json(
        { error: `Preço para ${plan}/${period} não configurado. Verifique STRIPE_PRICE_${plan.toUpperCase()}_${period.toUpperCase()}.` },
        { status: 500 }
      );
    }

    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true, company_name: true, cnpj: true, email_commercial: true, stripe_customer_id: true },
    });
    if (!distributor) {
      return Response.json({ error: "Complete o cadastro do perfil antes de contratar um plano" }, { status: 404 });
    }

    // Cria ou reutiliza Stripe Customer
    let customerId = distributor.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: distributor.email_commercial,
        name:  distributor.company_name,
        metadata: { distributor_id: distributor.id, cnpj: distributor.cnpj, entity_type: "distributor" },
      });
      customerId = customer.id;
      await prisma.distributor.update({ where: { id: distributor.id }, data: { stripe_customer_id: customerId } });
    }

    // Trial apenas com cartão no plano mensal (boleto = cobrança imediata)
    const trialDays = (!isBoleto && periodKey === "monthly") ? TRIAL_PERIOD_DAYS : 0;
    const months    = PERIOD_MONTHS[periodKey];

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode:     "subscription",
      payment_method_types: isBoleto ? ["boleto"] : ["card"],
      payment_method_collection: "always",
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
        metadata: { distributor_id: distributor.id, plan: planKey, period: periodKey, payment_method, entity_type: "distributor" },
      },
      metadata: { distributor_id: distributor.id, plan: planKey, period: periodKey, payment_method, entity_type: "distributor" },
      success_url: success_url ?? `${APP_URL}/painel?plano=${planKey}&sucesso=1`,
      cancel_url:  cancel_url  ?? `${APP_URL}/checkout/distribuidora?cancelado=1`,
      allow_promotion_codes:      true,
      billing_address_collection: "required",
      locale: "pt-BR",
    });

    return Response.json({
      checkout_url:          session.url,
      session_id:            session.id,
      plan:                  planKey,
      period:                periodKey,
      period_label:          PERIOD_LABELS[periodKey],
      payment_method,
      months,
      monthly_display_cents: DISTRIBUTOR_MONTHLY_DISPLAY[planKey][periodKey],
      trial_days:            trialDays,
    });
  },
  { roles: ["distributor_admin"] }
);
