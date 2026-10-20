"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";
import { Check, CreditCard, Building2, AlertTriangle, Sparkles, MessageCircle } from "lucide-react";
import BebbiLogo from "@/components/BebbiLogo";
import {
  DISTRIBUTOR_PLANS,
  PERIOD_LABELS,
  PERIOD_DISCOUNTS,
  PlanPeriod,
  DistributorPlanKey,
  formatBRL,
} from "@/config/plans";

type PayMethod = "card" | "boleto";

const CHECKOUT_PERIODS: PlanPeriod[] = ["monthly", "semiannual", "annual"];

export default function CheckoutDistribuidoraClient() {
  useSession({ required: true });
  const router = useRouter();
  const params = useSearchParams();
  const token = useApiToken();
  const cancelled = params.get("cancelado") === "1";

  // URL query params ou padrões (Pro pré-selecionado, padrão Anual)
  const initialPlan = (params.get("plan") as DistributorPlanKey) === "starter" ? "starter" : "pro";
  const initialPeriod = (
    CHECKOUT_PERIODS.includes(params.get("period") as PlanPeriod)
      ? params.get("period")
      : "annual"
  ) as PlanPeriod;

  const [plan, setPlan] = useState<"starter" | "pro">(initialPlan);
  const [period, setPeriod] = useState<PlanPeriod>(initialPeriod);
  const [payMethod, setPayMethod] = useState<PayMethod>("card");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedPlan = DISTRIBUTOR_PLANS[plan];
  const monthlyEquiv =
    period === "monthly"
      ? selectedPlan.monthlyEquivalents.monthlyCents
      : period === "semiannual"
      ? selectedPlan.monthlyEquivalents.semiannualCents
      : selectedPlan.monthlyEquivalents.annualCents;

  const totalPeriodCents =
    period === "monthly"
      ? selectedPlan.prices.monthlyCents
      : period === "semiannual"
      ? selectedPlan.prices.semiannualCents
      : selectedPlan.prices.annualCents;

  const isBoleto = payMethod === "boleto";
  const hasTrialCard = !isBoleto && period === "monthly";

  async function handleCheckout() {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/billing/checkout", {
        method: "POST",
        token,
        body: JSON.stringify({ plan, period, payment_method: payMethod }),
      });
      const data = (await res.json()) as { checkout_url?: string; error?: string };
      if (!res.ok || !data.checkout_url) {
        setError(data.error ?? "Erro ao iniciar checkout.");
        return;
      }
      window.location.href = data.checkout_url;
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F7FB] px-4 py-12">
      <div className="mx-auto w-full max-w-4xl">
        {/* Logo */}
        <div className="mb-8 text-center">
          <BebbiLogo variant="dark" height={36} />
        </div>

        <h1 className="mb-2 text-center text-3xl font-display font-bold text-[#0F172A]">
          Escolha o plano da sua distribuidora
        </h1>
        <p className="mb-8 text-center text-sm text-slate-500">
          Sem comissão sobre vendas · Cancele ou altere a qualquer momento
        </p>

        {cancelled && (
          <div className="mb-6 rounded-2xl bg-amber-50 px-5 py-4 text-sm text-amber-700 text-center border border-amber-200">
            Checkout cancelado. Nenhuma cobrança foi realizada.
          </div>
        )}

        {/* Seletor de período (Mensal / Semestral / Anual - Padrão Anual) */}
        <div className="mb-8 flex flex-col items-center gap-2.5">
          <div className="flex rounded-2xl border border-[#DBEAFE] bg-white p-1 shadow-sm">
            {CHECKOUT_PERIODS.map((p) => {
              const active = period === p;
              const disc = PERIOD_DISCOUNTS[p];
              return (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`relative min-h-[42px] px-5 py-2 text-sm font-semibold rounded-xl transition-all ${
                    active
                      ? "bg-[#2563EB] text-white shadow-md"
                      : "text-slate-600 hover:text-[#0F172A] hover:bg-slate-50"
                  }`}
                >
                  {PERIOD_LABELS[p]}
                  {disc > 0 && (
                    <span
                      className={`ml-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        active ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      -{disc}%
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {period !== "monthly" && (
            <span className="text-xs font-semibold text-emerald-600">
              Economia de {PERIOD_DISCOUNTS[period]}% no plano {PERIOD_LABELS[period].toLowerCase()}
            </span>
          )}
        </div>

        {/* 3 Cards: Starter, Pro (Pré-selecionado e Destacado), Enterprise */}
        <div className="mb-8 grid gap-4 lg:grid-cols-3">
          {/* Starter */}
          <button
            type="button"
            onClick={() => setPlan("starter")}
            className={`relative rounded-3xl border-2 p-6 text-left transition-all ${
              plan === "starter"
                ? "border-[#2563EB] bg-white shadow-xl ring-2 ring-[#2563EB]/20"
                : "border-[#DBEAFE] bg-white hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                bébbi {DISTRIBUTOR_PLANS.starter.name}
              </p>
              {plan === "starter" && (
                <span className="rounded-full bg-[#2563EB]/10 px-2.5 py-0.5 text-[11px] font-bold text-[#2563EB]">
                  Selecionado
                </span>
              )}
            </div>

            <p className="mt-3 text-3xl font-black text-[#0F172A]">
              {formatBRL(
                period === "monthly"
                  ? DISTRIBUTOR_PLANS.starter.monthlyEquivalents.monthlyCents
                  : period === "semiannual"
                  ? DISTRIBUTOR_PLANS.starter.monthlyEquivalents.semiannualCents
                  : DISTRIBUTOR_PLANS.starter.monthlyEquivalents.annualCents
              )}
              <span className="text-sm font-normal text-slate-400">/mês</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {period === "monthly"
                ? "cobrança mês a mês"
                : `${formatBRL(
                    period === "semiannual"
                      ? DISTRIBUTOR_PLANS.starter.prices.semiannualCents
                      : DISTRIBUTOR_PLANS.starter.prices.annualCents
                  )} cobrado no total`}
            </p>

            <p className="mt-3 text-xs leading-relaxed text-slate-600">
              {DISTRIBUTOR_PLANS.starter.tagline}
            </p>

            <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4">
              {DISTRIBUTOR_PLANS.starter.featureList.slice(0, 5).map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-slate-600">
                  <Check size={14} className="mt-0.5 shrink-0 text-slate-400" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </button>

          {/* Pro (Destacado com badge "Mais escolhido") */}
          <button
            type="button"
            onClick={() => setPlan("pro")}
            className={`relative rounded-3xl border-2 p-6 text-left transition-all ${
              plan === "pro"
                ? "border-[#22C55E] bg-white shadow-2xl ring-2 ring-[#22C55E]/30 scale-[1.02] z-10"
                : "border-[#DBEAFE] bg-white hover:border-emerald-300"
            }`}
          >
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#22C55E] px-3.5 py-1 text-[11px] font-black uppercase tracking-wider text-black shadow-md flex items-center gap-1.5">
              <Sparkles size={12} className="fill-black" />
              Mais escolhido
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-[#22C55E]">
                bébbi {DISTRIBUTOR_PLANS.pro.name}
              </p>
              {plan === "pro" && (
                <span className="rounded-full bg-[#22C55E]/15 px-2.5 py-0.5 text-[11px] font-bold text-[#1ea850]">
                  Selecionado
                </span>
              )}
            </div>

            <p className="mt-3 text-3xl font-black text-[#0F172A]">
              {formatBRL(
                period === "monthly"
                  ? DISTRIBUTOR_PLANS.pro.monthlyEquivalents.monthlyCents
                  : period === "semiannual"
                  ? DISTRIBUTOR_PLANS.pro.monthlyEquivalents.semiannualCents
                  : DISTRIBUTOR_PLANS.pro.monthlyEquivalents.annualCents
              )}
              <span className="text-sm font-normal text-slate-400">/mês</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {period === "monthly"
                ? "cobrança mês a mês"
                : `${formatBRL(
                    period === "semiannual"
                      ? DISTRIBUTOR_PLANS.pro.prices.semiannualCents
                      : DISTRIBUTOR_PLANS.pro.prices.annualCents
                  )} cobrado no total`}
            </p>

            <p className="mt-3 text-xs leading-relaxed text-slate-600">
              {DISTRIBUTOR_PLANS.pro.tagline}
            </p>

            <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4">
              {DISTRIBUTOR_PLANS.pro.featureList.slice(0, 5).map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-slate-700 font-medium">
                  <Check size={14} className="mt-0.5 shrink-0 text-[#22C55E]" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </button>

          {/* Enterprise (Sob consulta / Falar com vendas) */}
          <div className="relative rounded-3xl border border-slate-200 bg-white p-6 text-left flex flex-col justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                bébbi {DISTRIBUTOR_PLANS.enterprise.name}
              </p>
              <p className="mt-3 text-2xl font-black text-[#0F172A]">Sob consulta</p>
              <p className="mt-1 text-xs text-slate-500">
                Operações de alto volume e rede
              </p>

              <p className="mt-3 text-xs leading-relaxed text-slate-600">
                Integração ERP, gestão de vencimentos e atendimento dedicado sob medida.
              </p>

              <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                {DISTRIBUTOR_PLANS.enterprise.featureList.slice(0, 4).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-slate-600">
                    <Check size={14} className="mt-0.5 shrink-0 text-slate-400" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <a
              href="https://wa.me/5511999999999?text=Ol%C3%A1%2C%20gostaria%20de%20uma%20proposta%20do%20plano%20Enterprise%20do%20b%C3%A9bbi."
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-slate-50 py-3 text-xs font-bold text-slate-700 transition hover:bg-slate-100 hover:text-[#0F172A]"
            >
              <MessageCircle size={15} />
              Falar com consultor
            </a>
          </div>
        </div>

        {/* Método de pagamento + CTA */}
        <div className="mx-auto max-w-md rounded-3xl border border-[#DBEAFE] bg-white p-6 shadow-sm">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Método de pagamento
          </p>

          <div className="mb-5 grid grid-cols-2 gap-3">
            {/* Cartão */}
            <button
              type="button"
              onClick={() => setPayMethod("card")}
              className={`flex flex-col items-center gap-2 rounded-2xl border-2 px-4 py-4 transition-all ${
                payMethod === "card"
                  ? "border-[#2563EB] bg-[#EFF6FF]"
                  : "border-[#DBEAFE] hover:border-blue-300"
              }`}
            >
              <CreditCard size={24} className="text-[#2563EB]" />
              <span className="text-sm font-semibold text-[#0F172A]">Cartão de crédito</span>
              {period === "monthly" && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  14 dias grátis
                </span>
              )}
            </button>

            {/* Boleto */}
            <button
              type="button"
              onClick={() => setPayMethod("boleto")}
              className={`flex flex-col items-center gap-2 rounded-2xl border-2 px-4 py-4 transition-all ${
                payMethod === "boleto"
                  ? "border-[#2563EB] bg-[#EFF6FF]"
                  : "border-[#DBEAFE] hover:border-blue-300"
              }`}
            >
              <Building2 size={24} className="text-slate-600" />
              <span className="text-sm font-semibold text-[#0F172A]">Boleto bancário</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                Cobrança imediata
              </span>
            </button>
          </div>

          {/* Aviso boleto sem trial */}
          {isBoleto && period === "monthly" && (
            <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700 border border-amber-200">
              <AlertTriangle size={12} className="inline mr-1" />
              Boleto não inclui período de teste gratuito. A cobrança é gerada imediatamente.
            </div>
          )}

          {/* Resumo */}
          <div className="mb-5 rounded-2xl border border-[#DBEAFE] bg-[#F5F7FB] px-4 py-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Plano selecionado</span>
              <span className="font-bold text-[#0F172A]">
                {selectedPlan.name} · {PERIOD_LABELS[period]}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
              <span>Equivalente mensal</span>
              <span className="font-semibold text-slate-800">{formatBRL(monthlyEquiv)}/mês</span>
            </div>
            {period !== "monthly" && (
              <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                <span>Total faturado ({PERIOD_LABELS[period].toLowerCase()})</span>
                <span>{formatBRL(totalPeriodCents)}</span>
              </div>
            )}
            {hasTrialCard && (
              <p className="mt-2 text-xs font-semibold text-emerald-600">
                <Check size={12} className="inline mr-1" />
                14 dias de teste grátis — cobrança somente após o período
              </p>
            )}
          </div>

          {error && (
            <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleCheckout}
            disabled={loading || !token}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#22C55E] py-4 text-sm font-bold text-black shadow-lg shadow-[#22C55E]/20 transition hover:bg-[#1ea850] disabled:opacity-60"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                Processando…
              </>
            ) : isBoleto ? (
              `Gerar boleto — ${formatBRL(totalPeriodCents)}`
            ) : hasTrialCard ? (
              "Iniciar 14 dias grátis"
            ) : (
              `Assinar ${selectedPlan.name} — ${formatBRL(totalPeriodCents)}`
            )}
          </button>

          <p className="mt-3 text-center text-xs text-slate-400">
            Pagamento seguro processado via Stripe · Cancele quando quiser
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.back()}
          className="mt-6 w-full text-center text-sm text-slate-400 hover:text-slate-600"
        >
          ← Voltar
        </button>
      </div>
    </div>
  );
}
