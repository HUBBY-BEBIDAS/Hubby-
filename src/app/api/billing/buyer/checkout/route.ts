import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import {
  stripe,
  getBuyerPriceId,
  BUYER_MONTHLY_DISPLAY,
  PERIOD_LABELS,
  PERIOD_MONTHS,
} from "@/lib/stripe";
import type { BuyerPeriodKey } from "@/lib/stripe";

const schema = z.object({
  period: z.enum(["monthly", "quarterly", "semiannual", "annual"]).default("monthly"),
});

const APP_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

/**
 * POST /api/billing/buyer/checkout
 *
 * Cria sessão de checkout para o plano Pro do comprador.
 * Sem trial — acesso imediato ao assinar.
 * Aceita `period` para cobrar o valor correspondente de uma só vez.
 */
export const POST = withAuth(
  async (req: NextRequest, user) => {
    let body: unknown;
    try { body = await req.json(); } catch { body = {}; }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Dados inválidos", details: parsed.error.flatten().fieldErrors }, { status: 422 });
    }

    const period = parsed.data.period as BuyerPeriodKey;
    const priceId = getBuyerPriceId(period);

    if (!priceId) {
      return Response.json(
        { error: `Preço para o período "${period}" não configurado. Verifique STRIPE_PRICE_BUYER_PRO_${period.toUpperCase()}.` },
        { status: 500 }
      );
    }

    const client = await prisma.client.findUnique({
      where: { user_id: user.userId },
      select: {
        id: true, company_name: true, cnpj: true,
        stripe_customer_id: true,
        client_plan: true, client_plan_status: true,
        user: { select: { email: true } },
      },
    });

    if (!client) {
      return Response.json({ error: "Complete o cadastro do perfil antes de assinar um plano." }, { status: 404 });
    }

    if (client.client_plan === "pro" && client.client_plan_status === "active") {
      return Response.json({ error: "Você já possui o plano Pro ativo." }, { status: 409 });
    }

    // Cria ou reutiliza Stripe Customer
    let customerId = client.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: client.user.email,
        name:  client.company_name,
        metadata: { client_id: client.id, cnpj: client.cnpj, entity_type: "client" },
      });
      customerId = customer.id;
      await prisma.client.update({ where: { id: client.id }, data: { stripe_customer_id: customerId } });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode:     "subscription",
      payment_method_collection: "always",
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        metadata: { client_id: client.id, entity_type: "client", plan: "pro", period },
      },
      metadata: { client_id: client.id, entity_type: "client", plan: "pro", period },
      success_url: `${APP_URL}/cotacao?plano=pro&sucesso=1`,
      cancel_url:  `${APP_URL}/checkout/comprador?cancelado=1`,
      allow_promotion_codes:      true,
      billing_address_collection: "required",
      locale: "pt-BR",
    });

    return Response.json({
      checkout_url: session.url,
      session_id:   session.id,
      period,
      period_label: PERIOD_LABELS[period],
      months: PERIOD_MONTHS[period],
      monthly_display_cents: BUYER_MONTHLY_DISPLAY[period],
    });
  },
  { roles: ["client"] }
);
