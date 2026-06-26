"use client";

import { useState } from "react";
import SiteNavbar from "@/components/SiteNavbar";
import SiteFooter from "@/components/SiteFooter";
import { Check } from "lucide-react";

// ─── Dados de preço ───────────────────────────────────────────────────────────

type Period = "monthly" | "quarterly" | "semiannual" | "annual";

const PERIOD_LABELS: Record<Period, string> = {
  monthly: "Mensal", quarterly: "Trimestral", semiannual: "Semestral", annual: "Anual",
};
const PERIOD_MONTHS: Record<Period, number> = {
  monthly: 1, quarterly: 3, semiannual: 6, annual: 12,
};
const PERIOD_DISCOUNTS: Record<Period, number> = {
  monthly: 0, quarterly: 10, semiannual: 15, annual: 20,
};

const DIST_MONTHLY: Record<string, Record<Period, number>> = {
  starter:  { monthly: 29900, quarterly: 26900, semiannual: 25400, annual: 23900 },
  pro:      { monthly: 79900, quarterly: 71900, semiannual: 67900, annual: 63900 },
  business: { monthly: 149900, quarterly: 134900, semiannual: 127400, annual: 119900 },
};
const DIST_TOTAL: Record<string, Record<Period, number>> = {
  starter:  { monthly: 29900, quarterly: 80700,   semiannual: 152400,  annual: 286800  },
  pro:      { monthly: 79900, quarterly: 215700,  semiannual: 407400,  annual: 766800  },
  business: { monthly: 149900, quarterly: 404700, semiannual: 764400,  annual: 1438800 },
};
const BUYER_MONTHLY: Record<Period, number> = {
  monthly: 9900, quarterly: 8900, semiannual: 8400, annual: 7900,
};
const BUYER_TOTAL: Record<Period, number> = {
  monthly: 9900, quarterly: 26700, semiannual: 50400, annual: 94800,
};

function fmt(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(cents / 100);
}

// ─── Features por plano ───────────────────────────────────────────────────────

const DIST_FEATURES: Record<string, string[]> = {
  starter: [
    "Perfil completo na plataforma",
    "Cotações via painel e WhatsApp",
    "Catálogo de produtos ilimitado",
    "Painel de métricas básico",
    "1 usuário comercial",
    "Suporte por email",
  ],
  pro: [
    "Tudo do Starter",
    "Até 5 usuários com permissões",
    "Destaque no ranking de preços",
    "Prioridade em empate técnico",
    "Histórico completo de cotações",
    "Relatórios de performance",
    "Selo de distribuidora verificada",
  ],
  business: [
    "Tudo do Pro",
    "Usuários ilimitados",
    "Hierarquia de equipe comercial",
    "Integração ERP via webhook",
    "Relatórios avançados exportáveis",
    "Onboarding e suporte dedicados",
    "SLA de 4h em dias úteis",
  ],
};

const ENTERPRISE_FEATURES = [
  "Tudo do Business",
  "Gestão automática de vencimentos (integra com ERP)",
  "Notificação automática aos compradores da região",
  "Webhook de sincronização de lotes em tempo real",
  "Usuários e regiões ilimitados",
  "Account manager exclusivo",
  "SLA garantido + suporte 24/7",
];

const BUYER_PRO_FEATURES = [
  "Cotar em qualquer região do Brasil (não só a sua)",
  "Alertas de queda de preço",
  "Relatórios mensais de compra e economia",
  "Acesso prioritário a novas funcionalidades",
  "Múltiplos endereços de entrega",
];

const BUYER_FREE_FEATURES = [
  "Cotação na sua região cadastrada",
  "Ranking automático de preços",
  "Histórico completo de pedidos",
  "Análise de crédito automática",
  "Recompra com 1 clique",
];

// ─── Componentes ──────────────────────────────────────────────────────────────

function PeriodToggle({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap justify-center rounded-xl border border-white/10 bg-[#1f2937] p-1 gap-1">
        {(["monthly", "quarterly", "semiannual", "annual"] as Period[]).map((p) => {
          const disc = PERIOD_DISCOUNTS[p];
          return (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={[
                "relative min-h-[44px] cursor-pointer select-none rounded-lg px-4 py-2 text-[13px] font-semibold touch-manipulation transition-all duration-200",
                period === p ? "bg-[#22C55E] text-black shadow-sm" : "text-slate-400 hover:text-white",
              ].join(" ")}
            >
              {PERIOD_LABELS[p]}
              {disc > 0 && (
                <span className={`ml-1.5 text-[10px] font-bold ${period === p ? "text-black/60" : "text-[#22C55E]"}`}>
                  -{disc}%
                </span>
              )}
            </button>
          );
        })}
      </div>
      {period !== "monthly" && (
        <span className="rounded-full bg-[#22C55E] px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-black">
          ECONOMIZE {PERIOD_DISCOUNTS[period]}% em relação ao mensal
        </span>
      )}
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function PlanosPage() {
  const [period, setPeriod] = useState<Period>("monthly");

  return (
    <div className="min-h-screen bg-[#0D1117]">
      <SiteNavbar />

      {/* Header */}
      <div className="pt-28 pb-10 text-center">
        <span className="inline-block rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-slate-500">
          Planos e preços
        </span>
        <h1 className="mt-4 font-display text-4xl font-bold text-white md:text-5xl">
          Simples, transparente,{" "}
          <span className="text-[#22C55E]">sem comissão.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-400">
          Compradores entram grátis para sempre. Distribuidoras pagam mensalidade fixa —
          sem comissão por venda, sem surpresas.
        </p>
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">

        {/* Toggle */}
        <div className="mb-12">
          <PeriodToggle period={period} onChange={setPeriod} />
        </div>

        {/* ── DISTRIBUIDORAS ────────────────────────────────────────────────── */}
        <div className="mb-5 flex items-end justify-between gap-4 border-b border-white/[0.06] pb-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-600">Para</p>
            <h2 className="font-display text-3xl font-bold text-white">Distribuidoras</h2>
          </div>
          <p className="text-right text-[11px] text-slate-500">
            {period === "monthly" ? "14 dias grátis · " : ""}cancele quando quiser · sem comissão por venda
          </p>
        </div>

        <div className="mb-6 grid grid-cols-1 items-stretch gap-4 md:grid-cols-3">
          {(["starter", "pro", "business"] as const).map((key) => {
            const isPro   = key === "pro";
            const names   = { starter: "Starter", pro: "Pro", business: "Business" };
            const targets = {
              starter:  "Distribuidoras que estão começando na plataforma.",
              pro:      "Equipes que querem vender mais e perder menos.",
              business: "Operações que precisam de escala e controle total.",
            };
            const monthly = DIST_MONTHLY[key][period];
            const total   = DIST_TOTAL[key][period];
            const months  = PERIOD_MONTHS[period];

            return (
              <div
                key={key}
                className={[
                  "relative flex flex-col rounded-2xl px-6 py-7",
                  isPro
                    ? "border-2 border-[#22C55E] bg-[#111827]"
                    : "border border-white/10 bg-[#111827]",
                ].join(" ")}
                style={isPro ? { boxShadow: "0 0 40px rgba(34,197,94,0.15)" } : undefined}
              >
                {isPro && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#22C55E] px-4 py-0.5 text-[10px] font-bold uppercase tracking-widest text-black">
                    Mais popular
                  </div>
                )}

                <p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${isPro ? "text-[#22C55E]" : "text-slate-500"}`}>
                  HUBBY {names[key]}
                </p>

                <div className="mt-3 leading-none">
                  <div className="flex items-end gap-1">
                    <span className="font-display text-[2rem] font-bold text-white">{fmt(monthly)}</span>
                    <span className="mb-0.5 text-xs text-slate-500">/mês</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {period === "monthly"
                      ? "cobrança mês a mês"
                      : `${fmt(total)} cobrados ${months === 3 ? "a cada 3 meses" : months === 6 ? "a cada 6 meses" : "anualmente"}`}
                  </p>
                </div>

                <p className="mt-3 text-[13px] leading-relaxed text-slate-400">{targets[key]}</p>

                <div className="my-5 h-px bg-white/[0.06]" />

                <ul className="flex-1 space-y-2.5 text-[13px] text-slate-400">
                  {DIST_FEATURES[key].map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check size={12} className={`mt-0.5 shrink-0 ${isPro ? "text-[#22C55E]" : "text-slate-500"}`} />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-6 border-t border-white/[0.06] pt-6">
                  <a
                    href={`/auth/register?plan=${key}&period=${period}`}
                    className={[
                      "flex w-full items-center justify-center rounded-xl py-3 text-[13px] font-bold transition",
                      isPro
                        ? "bg-[#22C55E] text-black hover:opacity-90"
                        : "border border-white/15 text-slate-400 hover:border-white/30 hover:text-white",
                    ].join(" ")}
                  >
                    {period === "monthly" ? "Começar 14 dias grátis" : "Começar agora"}
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        {/* Enterprise */}
        <div className="mb-16 rounded-2xl border border-white/10 bg-[#111827] px-6 py-6">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">HUBBY Enterprise</p>
              <p className="mt-1 text-base font-bold text-white">Sob consulta — para operações de grande escala</p>
              <p className="mt-0.5 text-[13px] text-slate-500">Usuários e regiões ilimitados · SLA garantido · integração personalizada</p>
            </div>
            <a
              href="https://wa.me/5511999999999?text=Ol%C3%A1%2C%20tenho%20interesse%20no%20plano%20Enterprise%20da%20Hubby."
              target="_blank"
              rel="noopener noreferrer"
              className="flex shrink-0 items-center gap-2 rounded-xl border border-white/20 bg-white/[0.04] px-5 py-2.5 text-[13px] font-bold text-slate-300 transition hover:border-white/40 hover:bg-white/[0.08] hover:text-white"
            >
              <svg className="h-4 w-4 text-[#22C55E]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
              </svg>
              Falar com consultor
            </a>
          </div>
          <div className="mt-5 border-t border-white/[0.06] pt-5">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-600">Exclusivo Enterprise</p>
            <ul className="grid grid-cols-1 gap-y-2 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
              {ENTERPRISE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-[12px] text-slate-500">
                  <Check size={11} className="mt-0.5 shrink-0 text-[#22C55E]" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── COMPRADORES ───────────────────────────────────────────────────── */}
        <div className="mb-5 flex items-end justify-between gap-4 border-b border-white/[0.06] pb-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-600">Para</p>
            <h2 className="font-display text-3xl font-bold text-white">Compradores</h2>
          </div>
          <p className="text-right text-[11px] text-slate-500">
            plano gratuito para sempre · sem comissão
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

          {/* Free */}
          <div className="flex flex-col rounded-2xl border border-white/10 bg-[#111827] px-6 py-7">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Gratuito</p>
            <div className="mt-3">
              <span className="font-display text-[2rem] font-bold text-white">Grátis</span>
              <p className="mt-1 text-[11px] text-slate-500">para sempre, sem cartão</p>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-slate-400">
              Tudo que um bar, restaurante ou adega precisa para cotar com agilidade.
            </p>
            <div className="my-5 h-px bg-white/[0.06]" />
            <ul className="flex-1 space-y-2.5 text-[13px] text-slate-400">
              {BUYER_FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <Check size={12} className="mt-0.5 shrink-0 text-slate-500" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-6 border-t border-white/[0.06] pt-6">
              <a
                href="/auth/register?role=client"
                className="flex w-full items-center justify-center rounded-xl border border-white/15 py-3 text-[13px] font-bold text-slate-400 transition hover:border-white/30 hover:text-white"
              >
                Criar conta grátis
              </a>
            </div>
          </div>

          {/* Pro */}
          <div
            className="flex flex-col rounded-2xl border-2 border-[#22C55E] bg-[#111827] px-6 py-7"
            style={{ boxShadow: "0 0 40px rgba(34,197,94,0.12)" }}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#22C55E]">Pro</p>
              <span className="rounded-full bg-[#22C55E]/15 px-2.5 py-0.5 text-[10px] font-bold text-[#22C55E]">
                Para quem compra em escala
              </span>
            </div>
            <div className="mt-3 leading-none">
              <div className="flex items-end gap-1">
                <span className="font-display text-[2rem] font-bold text-white">{fmt(BUYER_MONTHLY[period])}</span>
                <span className="mb-0.5 text-xs text-slate-500">/mês</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                {period === "monthly"
                  ? "cobrança mês a mês"
                  : `${fmt(BUYER_TOTAL[period])} cobrados ${PERIOD_MONTHS[period] === 3 ? "a cada 3 meses" : PERIOD_MONTHS[period] === 6 ? "a cada 6 meses" : "anualmente"}`}
              </p>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-slate-400">
              Amplie sua cobertura, receba alertas de preço e acesse relatórios completos.
            </p>
            <div className="my-5 h-px bg-white/[0.06]" />
            <ul className="flex-1 space-y-2.5 text-[13px] text-slate-400">
              <li className="flex items-start gap-2.5 font-semibold text-slate-300">
                <Check size={12} className="mt-0.5 shrink-0 text-[#22C55E]" />
                Tudo do Gratuito
              </li>
              {BUYER_PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <Check size={12} className="mt-0.5 shrink-0 text-[#22C55E]" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-6 border-t border-white/[0.06] pt-6">
              <a
                href={`/auth/register?role=client&plan=pro&period=${period}`}
                className="flex w-full items-center justify-center rounded-xl bg-[#22C55E] py-3 text-[13px] font-bold text-black transition hover:opacity-90"
              >
                Começar com o Pro
              </a>
            </div>
          </div>
        </div>

        {/* Rodapé da seção */}
        <div className="mt-10 rounded-2xl border border-white/[0.06] bg-[#111827]/50 p-6 text-center">
          <p className="text-[13px] text-slate-500">
            Dúvidas sobre qual plano escolher?{" "}
            <a
              href="https://wa.me/5511999999999"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#22C55E] hover:underline"
            >
              Fale pelo WhatsApp
            </a>
            {" "}— respondemos em minutos.
          </p>
          <p className="mt-2 text-[11px] text-slate-600">
            Todos os planos incluem: CNPJ verificado automaticamente · suporte por email · sem fidelidade obrigatória
          </p>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
