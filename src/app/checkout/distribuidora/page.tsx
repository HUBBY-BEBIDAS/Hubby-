"use client";

import { Suspense, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";
import { Check, CreditCard, Building2, AlertTriangle } from "lucide-react";

// ─── Dados dos planos ─────────────────────────────────────────────────────────

type PlanKey    = "starter" | "pro" | "business";
type PeriodKey  = "monthly" | "quarterly" | "semiannual" | "annual";
type PayMethod  = "card" | "boleto";

const PLANS: {
  key: PlanKey;
  name: string;
  desc: string;
  monthly_cents: number;
  prices: Record<PeriodKey, number>;
  features: string[];
  highlight?: boolean;
}[] = [
  {
    key: "starter",
    name: "Vitrine",
    desc: "Canal de novos clientes",
    monthly_cents: 29900,
    prices: { monthly: 29900, quarterly: 26900, semiannual: 25400, annual: 23900 },
    features: [
      "1 usuário administrativo",
      "Catálogo de produtos ilimitado",
      "Cotações recebidas de clientes",
      "Painel com métricas básicas",
      "Relatórios — últimos 7 dias",
    ],
  },
  {
    key: "pro",
    name: "Operacional",
    desc: "Canal principal de pedidos",
    monthly_cents: 79900,
    prices: { monthly: 79900, quarterly: 71900, semiannual: 67900, annual: 63900 },
    features: [
      "Até 5 colaboradores",
      "Fila de leads + atribuição automática",
      "Relatórios completos — 30 e 90 dias",
      "Top clientes e top cidades",
      "Importação em lote de preços",
    ],
    highlight: true,
  },
  {
    key: "business",
    name: "Enterprise",
    desc: "Hierarquia + analytics avançado",
    monthly_cents: 149900,
    prices: { monthly: 149900, quarterly: 134900, semiannual: 127400, annual: 119900 },
    features: [
      "Colaboradores ilimitados",
      "Hierarquia e reatribuição de clientes",
      "Analytics avançado + exportação",
      "Integração ERP via webhook",
      "Suporte prioritário",
    ],
  },
];

const PERIODS: { key: PeriodKey; label: string; discount: number }[] = [
  { key: "monthly",    label: "Mensal",      discount: 0  },
  { key: "quarterly",  label: "Trimestral",  discount: 10 },
  { key: "semiannual", label: "Semestral",   discount: 15 },
  { key: "annual",     label: "Anual",       discount: 20 },
];

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

// ─── Conteúdo ─────────────────────────────────────────────────────────────────

function CheckoutDistribuidoraContent() {
  useSession({ required: true });
  const router    = useRouter();
  const params    = useSearchParams();
  const token     = useApiToken();
  const cancelled = params.get("cancelado") === "1";

  const [plan,          setPlan]          = useState<PlanKey>("pro");
  const [period,        setPeriod]        = useState<PeriodKey>("monthly");
  const [payMethod,     setPayMethod]     = useState<PayMethod>("card");
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState("");

  const selectedPlan = PLANS.find((p) => p.key === plan)!;
  const displayCents = selectedPlan.prices[period];
  const isBoleto     = payMethod === "boleto";
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
      const data = await res.json() as { checkout_url?: string; error?: string };
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
        <div className="mb-8 text-center text-base font-black uppercase tracking-[0.22em] text-[#0F172A]">
          HUBBY
        </div>

        <h1 className="mb-2 text-center text-2xl font-display font-bold text-[#0F172A]">Escolha seu plano</h1>
        <p className="mb-8 text-center text-sm text-slate-500">
          Sem contrato de fidelidade · Cancele quando quiser
        </p>

        {cancelled && (
          <div className="mb-6 rounded-2xl bg-amber-50 px-5 py-4 text-sm text-amber-700 text-center">
            Checkout cancelado. Nenhuma cobrança foi feita.
          </div>
        )}

        {/* Seletor de período */}
        <div className="mb-8 flex justify-center">
          <div className="flex rounded-2xl border border-[#DBEAFE] bg-white overflow-hidden">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                  period === p.key ? "bg-[#2563EB] text-white" : "text-slate-500 hover:bg-[#F5F7FB]"
                }`}
              >
                {p.label}
                {p.discount > 0 && (
                  <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    period === p.key ? "bg-white/20 text-white" : "bg-green-100 text-green-700"
                  }`}>
                    -{p.discount}%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Cards dos planos */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          {PLANS.map((p) => {
            const active = plan === p.key;
            return (
              <button
                key={p.key}
                onClick={() => setPlan(p.key)}
                className={`relative rounded-3xl border-2 p-6 text-left transition-all ${
                  active
                    ? "border-[#2563EB] bg-white shadow-lg"
                    : "border-[#DBEAFE] bg-white hover:border-blue-300"
                }`}
              >
                {p.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#2563EB] px-3 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Mais popular
                  </span>
                )}
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{p.name}</p>
                <p className="mt-2 text-2xl font-black text-[#0F172A]">
                  {formatBRL(p.prices[period])}
                  <span className="text-sm font-normal text-slate-400">/mês</span>
                </p>
                {period !== "monthly" && (
                  <p className="text-xs text-slate-400">
                    {formatBRL(p.prices[period] * (period === "quarterly" ? 3 : period === "semiannual" ? 6 : 12))} cobrado de uma vez
                  </p>
                )}
                <p className="mt-2 text-xs text-slate-500">{p.desc}</p>
                <ul className="mt-4 space-y-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-slate-600">
                      <span className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                        active ? "bg-[#2563EB]/10 text-[#2563EB]" : "bg-slate-100 text-slate-400"
                      }`}><Check size={9} /></span>
                      {f}
                    </li>
                  ))}
                </ul>
                {active && (
                  <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-[#2563EB]">
                    <span className="h-2 w-2 rounded-full bg-[#2563EB]" /> Selecionado
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Método de pagamento + CTA */}
        <div className="mx-auto max-w-md rounded-3xl border border-[#DBEAFE] bg-white p-6 shadow-sm">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Método de pagamento
          </p>

          <div className="mb-5 grid grid-cols-2 gap-3">
            {/* Cartão */}
            <button
              onClick={() => setPayMethod("card")}
              className={`flex flex-col items-center gap-2 rounded-2xl border-2 px-4 py-4 transition-all ${
                payMethod === "card"
                  ? "border-[#2563EB] bg-[#EFF6FF]"
                  : "border-[#DBEAFE] hover:border-blue-300"
              }`}
            >
              <CreditCard size={24} />
              <span className="text-sm font-semibold text-[#0F172A]">Cartão de crédito</span>
              {period === "monthly" && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                  14 dias grátis
                </span>
              )}
            </button>

            {/* Boleto */}
            <button
              onClick={() => setPayMethod("boleto")}
              className={`flex flex-col items-center gap-2 rounded-2xl border-2 px-4 py-4 transition-all ${
                payMethod === "boleto"
                  ? "border-[#2563EB] bg-[#EFF6FF]"
                  : "border-[#DBEAFE] hover:border-blue-300"
              }`}
            >
              <Building2 size={24} />
              <span className="text-sm font-semibold text-[#0F172A]">Boleto bancário</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                Vence em 3 dias úteis
              </span>
            </button>
          </div>

          {/* Aviso boleto sem trial */}
          {isBoleto && period === "monthly" && (
            <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700">
              <AlertTriangle size={12} className="inline mr-1" />Boleto não inclui período de trial. A cobrança é imediata.
            </div>
          )}

          {/* Resumo */}
          <div className="mb-5 rounded-2xl border border-[#DBEAFE] bg-[#F5F7FB] px-4 py-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Plano {selectedPlan.name}</span>
              <span className="font-semibold text-[#0F172A]">{formatBRL(displayCents)}/mês</span>
            </div>
            {period !== "monthly" && (
              <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                <span>Cobrado {PERIODS.find((p) => p.key === period)?.label.toLowerCase()}</span>
                <span>{formatBRL(displayCents * (period === "quarterly" ? 3 : period === "semiannual" ? 6 : 12))}</span>
              </div>
            )}
            {hasTrialCard && (
              <p className="mt-1 text-xs font-medium text-green-600">
                <Check size={11} className="inline mr-1" />14 dias grátis — cobrança só após o trial
              </p>
            )}
          </div>

          {error && (
            <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <button
            onClick={handleCheckout}
            disabled={loading || !token}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2563EB] py-4 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:bg-[#1D4ED8] disabled:opacity-60"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Aguarde…
              </>
            ) : (
              isBoleto
                ? `Gerar boleto — ${formatBRL(displayCents * (period === "quarterly" ? 3 : period === "semiannual" ? 6 : period === "annual" ? 12 : 1))}`
                : hasTrialCard
                  ? "Iniciar 14 dias grátis"
                  : `Assinar ${selectedPlan.name} — ${formatBRL(displayCents)}/mês`
            )}
          </button>

          <p className="mt-3 text-center text-xs text-slate-400">
            Pagamento seguro via Stripe · Cancele a qualquer momento
          </p>
        </div>

        <button
          onClick={() => router.back()}
          className="mt-6 w-full text-center text-sm text-slate-400 hover:text-slate-600"
        >
          ← Voltar
        </button>
      </div>
    </div>
  );
}

export default function CheckoutDistribuidoraPage() {
  return (
    <Suspense>
      <CheckoutDistribuidoraContent />
    </Suspense>
  );
}
