import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import type Stripe from "stripe";

type Invoice = {
  id: string;
  amount_paid: number;
  status: string | null;
  created: string;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
};

async function fetchStripeData(
  subscriptionId: string | null,
  customerId: string | null
): Promise<{ renewal_date: string | null; cancel_at: string | null; invoices: Invoice[] }> {
  let renewal_date: string | null = null;
  let cancel_at: string | null = null;
  const invoices: Invoice[] = [];

  if (subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ["items.data.period"],
      }) as unknown as Stripe.Subscription & {
        trial_end: number | null;
        cancel_at: number | null;
        items: { data: Array<{ current_period_end?: number; period?: { end?: number } }> };
      };
      // Tenta obter fim do período atual a partir do primeiro item
      const item = sub.items?.data?.[0];
      const rawItem = item as unknown as Record<string, unknown>;
      const periodEnd: number | undefined =
        (rawItem?.current_period_end as number | undefined) ??
        ((rawItem?.period as { end?: number } | undefined)?.end);
      if (periodEnd) renewal_date = new Date(periodEnd * 1000).toISOString();
      else if (sub.trial_end) renewal_date = new Date(sub.trial_end * 1000).toISOString();
      cancel_at = sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null;
    } catch { /* Stripe não disponível em dev */ }
  }

  if (customerId) {
    try {
      const inv = await stripe.invoices.list({ customer: customerId, limit: 6 });
      for (const i of inv.data) {
        invoices.push({
          id:                  i.id,
          amount_paid:         i.amount_paid,
          status:              i.status ?? null,
          created:             new Date(i.created * 1000).toISOString(),
          hosted_invoice_url:  i.hosted_invoice_url ?? null,
          invoice_pdf:         i.invoice_pdf ?? null,
        });
      }
    } catch { /* silencia */ }
  }

  return { renewal_date, cancel_at, invoices };
}

/** GET /api/billing/my-plan — retorna plano atual, status e faturas do usuário logado. */
export const GET = withAuth(
  async (_req: NextRequest, user) => {

    // ── Comprador ─────────────────────────────────────────────────────────────
    if (user.role === "client") {
      const client = await prisma.client.findUnique({
        where:  { user_id: user.userId },
        select: {
          client_plan: true, client_plan_status: true, client_plan_period: true,
          stripe_customer_id: true, stripe_subscription_id: true,
        },
      });
      if (!client) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

      const stripe_data = await fetchStripeData(
        client.stripe_subscription_id ?? null,
        client.stripe_customer_id     ?? null,
      );

      return Response.json({
        entity:       "client",
        plan:         client.client_plan         ?? "free",
        status:       client.client_plan_status  ?? null,
        period:       client.client_plan_period  ?? null,
        ...stripe_data,
      });
    }

    // ── Distribuidora ─────────────────────────────────────────────────────────
    if (user.role === "distributor_admin") {
      const dist = await prisma.distributor.findUnique({
        where:  { user_id: user.userId },
        select: {
          plan: true, plan_status: true, plan_period: true,
          stripe_customer_id: true, stripe_subscription_id: true,
        },
      });
      if (!dist) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

      const stripe_data = await fetchStripeData(
        dist.stripe_subscription_id ?? null,
        dist.stripe_customer_id     ?? null,
      );

      return Response.json({
        entity:  "distributor",
        plan:    dist.plan        ?? "starter",
        status:  dist.plan_status ?? null,
        period:  dist.plan_period ?? null,
        ...stripe_data,
      });
    }

    return Response.json({ error: "Forbidden" }, { status: 403 });
  },
  { roles: ["client", "distributor_admin"] }
);
