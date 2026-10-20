/**
 * Cliente Stripe — singleton com lazy init para não quebrar no build.
 *
 * Tabela de preços (em centavos, cobrados de uma só vez por período):
 *
 * DISTRIBUIDORAS
 * ──────────────────────────────────────────────────────────────────
 *  Plano      | Mensal  | Trimestral | Semestral | Anual
 *  Starter    | 29.900  |  80.700    | 152.400   | 286.800
 *  Pro        | 79.900  | 215.700    | 407.400   | 766.800
 *  Business   | 149.900 | 404.700    | 764.400   | 1.438.800
 *  Enterprise | sob consulta
 *
 * COMPRADORES
 * ──────────────────────────────────────────────────────────────────
 *  Pro        | 9.900   | 26.700     | 50.400    | 94.800
 *
 * Variáveis de ambiente esperadas (uma por combinação plano+período):
 *   STRIPE_PRICE_STARTER_MONTHLY / _QUARTERLY / _SEMIANNUAL / _ANNUAL
 *   STRIPE_PRICE_PRO_MONTHLY     / _QUARTERLY / _SEMIANNUAL / _ANNUAL
 *   STRIPE_PRICE_BUSINESS_MONTHLY / _QUARTERLY / _SEMIANNUAL / _ANNUAL
 *   STRIPE_PRICE_BUYER_PRO_MONTHLY / _QUARTERLY / _SEMIANNUAL / _ANNUAL
 */

import Stripe from "stripe";

const globalForStripe = globalThis as unknown as { stripe: Stripe | undefined };

function getStripe(): Stripe {
  if (globalForStripe.stripe) return globalForStripe.stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY não configurada");
  const instance = new Stripe(key, { apiVersion: "2026-03-25.dahlia", typescript: true });
  if (process.env.NODE_ENV !== "production") globalForStripe.stripe = instance;
  return instance;
}

export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type DistributorPlanKey = "starter" | "pro" | "business" | "enterprise";
export type PeriodKey = "monthly" | "quarterly" | "semiannual" | "annual";
export type BuyerPeriodKey = PeriodKey;

// ─── Preços em centavos (exibição e metadados) ────────────────────────────────

/** Valor cobrado de uma só vez por combinação plano+período (em centavos) */
export const DISTRIBUTOR_PRICES_CENTS: Record<string, Record<PeriodKey, number>> = {
  starter:    { monthly: 29900,  quarterly: 80700,   semiannual: 152400,  annual: 286800 },
  pro:        { monthly: 59900,  quarterly: 161700,  semiannual: 305400,  annual: 574800 },
  business:   { monthly: 149900, quarterly: 404700,  semiannual: 764400,  annual: 1438800 },
  enterprise: { monthly: 0,      quarterly: 0,       semiannual: 0,       annual: 0 },
};

/** Preço mensal equivalente por período (para exibição) */
export const DISTRIBUTOR_MONTHLY_DISPLAY: Record<string, Record<PeriodKey, number>> = {
  starter:    { monthly: 29900, quarterly: 26900, semiannual: 25400, annual: 23900 },
  pro:        { monthly: 59900, quarterly: 53900, semiannual: 50900, annual: 47900 },
  business:   { monthly: 149900, quarterly: 134900, semiannual: 127400, annual: 119900 },
  enterprise: { monthly: 0,     quarterly: 0,     semiannual: 0,     annual: 0 },
};

export const BUYER_PRICES_CENTS: Record<BuyerPeriodKey, number> = {
  monthly: 1990, quarterly: 5370, semiannual: 10140, annual: 17880,
};

export const BUYER_MONTHLY_DISPLAY: Record<BuyerPeriodKey, number> = {
  monthly: 1990, quarterly: 1790, semiannual: 1690, annual: 1490,
};

/** Desconto % em relação ao mensal para cada período */
export const PERIOD_DISCOUNTS: Record<PeriodKey, number> = {
  monthly: 0, quarterly: 10, semiannual: 15, annual: 20,
};

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  monthly: "Mensal", quarterly: "Trimestral", semiannual: "Semestral", annual: "Anual",
};

export const PERIOD_MONTHS: Record<PeriodKey, number> = {
  monthly: 1, quarterly: 3, semiannual: 6, annual: 12,
};

// ─── Price IDs do Stripe ──────────────────────────────────────────────────────

export const DISTRIBUTOR_PRICE_IDS: Record<string, Partial<Record<PeriodKey, string>>> = {
  starter: {
    monthly:    process.env.STRIPE_PRICE_STARTER_MONTHLY,
    quarterly:  process.env.STRIPE_PRICE_STARTER_QUARTERLY,
    semiannual: process.env.STRIPE_PRICE_STARTER_SEMIANNUAL,
    annual:     process.env.STRIPE_PRICE_STARTER_ANNUAL,
  },
  pro: {
    monthly:    process.env.STRIPE_PRICE_PRO_MONTHLY,
    quarterly:  process.env.STRIPE_PRICE_PRO_QUARTERLY,
    semiannual: process.env.STRIPE_PRICE_PRO_SEMIANNUAL,
    annual:     process.env.STRIPE_PRICE_PRO_ANNUAL,
  },
  business: {
    monthly:    process.env.STRIPE_PRICE_BUSINESS_MONTHLY,
    quarterly:  process.env.STRIPE_PRICE_BUSINESS_QUARTERLY,
    semiannual: process.env.STRIPE_PRICE_BUSINESS_SEMIANNUAL,
    annual:     process.env.STRIPE_PRICE_BUSINESS_ANNUAL,
  },
};

export const BUYER_PRICE_IDS: Partial<Record<BuyerPeriodKey, string>> = {
  monthly:    process.env.STRIPE_PRICE_BUYER_PRO_MONTHLY,
  quarterly:  process.env.STRIPE_PRICE_BUYER_PRO_QUARTERLY,
  semiannual: process.env.STRIPE_PRICE_BUYER_PRO_SEMIANNUAL,
  annual:     process.env.STRIPE_PRICE_BUYER_PRO_ANNUAL,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getDistributorPriceId(plan: DistributorPlanKey, period: PeriodKey): string {
  return DISTRIBUTOR_PRICE_IDS[plan]?.[period] ?? "";
}

export function getBuyerPriceId(period: BuyerPeriodKey): string {
  return BUYER_PRICE_IDS[period] ?? "";
}

/** Trial de 14 dias para distribuidoras — apenas no plano mensal */
export const TRIAL_PERIOD_DAYS = 14;

// ─── Compatibilidade retroativa (usado em código legado) ─────────────────────

/** @deprecated Use DISTRIBUTOR_PRICE_IDS */
export const PLAN_PRICE_IDS = {
  vitrine:     process.env.STRIPE_PRICE_STARTER_MONTHLY!,
  operacional: process.env.STRIPE_PRICE_PRO_MONTHLY!,
  enterprise:  "",
};
