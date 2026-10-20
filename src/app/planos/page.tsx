"use client";

import { useState } from "react";
import SiteNavbar from "@/components/SiteNavbar";
import SiteFooter from "@/components/SiteFooter";
import { Check, Sparkles, MessageCircle } from "lucide-react";
import {
  DISTRIBUTOR_PLANS,
  BUYER_PLANS,
  PERIOD_LABELS,
  PERIOD_DISCOUNTS,
  PERIOD_MONTHS,
  PlanPeriod,
  DistributorPlanKey,
  formatBRL,
  formatBRLDecimals,
} from "@/config/plans";

// ─── Componente Toggle de Período ─────────────────────────────────────────────

const DISPLAY_PERIODS: PlanPeriod[] = ["monthly", "semiannual", "annual"];

function PeriodToggle({
  period,
  onChange,
}: {
  period: PlanPeriod;
  onChange: (p: PlanPeriod) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap justify-center rounded-xl border border-white/10 bg-[#1f2937] p-1 gap-1">
        {DISPLAY_PERIODS.map((p) => {
          const disc = PERIOD_DISCOUNTS[p];
          const isSelected = period === p;
          return (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={[
                "relative min-h-[44px] cursor-pointer select-none rounded-lg px-5 py-2 text-[13px] font-semibold touch-manipulation transition-all duration-200",
                isSelected
                  ? "bg-[#22C55E] text-black shadow-md font-bold"
                  : "text-slate-400 hover:text-white",
              ].join(" ")}
            >
              {PERIOD_LABELS[p]}
              {disc > 0 && (
                <span
                  className={`ml-1.5 text-[10px] font-bold ${
                    isSelected ? "text-black/70" : "text-[#22C55E]"
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
        <span className="rounded-full bg-[#22C55E]/15 border border-[#22C55E]/30 px-3.5 py-1 text-[11px] font-bold uppercase tracking-widest text-[#22C55E]">
          ECONOMIZE {PERIOD_DISCOUNTS[period]}% no plano {PERIOD_LABELS[period].toLowerCase()}
        </span>
      )}
    </div>
  );
}

// ─── Página de Planos ─────────────────────────────────────────────────────────

export default function PlanosPage() {
  // Padrão: Anual
  const [period, setPeriod] = useState<PlanPeriod>("annual");

  const planKeys: DistributorPlanKey[] = ["starter", "pro", "enterprise"];

  return (
    <div className="min-h-screen bg-[#0D1117]">
      <SiteNavbar />

      {/* Header */}
      <div className="pt-28 pb-10 text-center px-4">
        <span className="inline-block rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-slate-400">
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
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Para</p>
            <h2 className="font-display text-3xl font-bold text-white">Distribuidoras</h2>
          </div>
          <p className="text-right text-[11px] text-slate-400">
            {period === "monthly" ? "14 dias grátis · " : ""}cancele quando quiser · sem comissão por venda
          </p>
        </div>

        {/* 3 Cards Lado a Lado: Starter, Pro (Destaque), Enterprise */}
        <div className="mb-16 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">
          {planKeys.map((key) => {
            const plan = DISTRIBUTOR_PLANS[key];
            const isPro = plan.highlight;
            const isEnterprise = plan.isCustomQuote;

            // Valores calculados
            const monthlyEquiv =
              period === "monthly"
                ? plan.monthlyEquivalents.monthlyCents
                : period === "semiannual"
                ? plan.monthlyEquivalents.semiannualCents
                : plan.monthlyEquivalents.annualCents;

            const totalPeriod =
              period === "monthly"
                ? plan.prices.monthlyCents
                : period === "semiannual"
                ? plan.prices.semiannualCents
                : plan.prices.annualCents;

            return (
              <div
                key={key}
                className={[
                  "relative flex flex-col rounded-2xl p-7 transition-all duration-200",
                  isPro
                    ? "border-2 border-[#22C55E] bg-[#111827] shadow-2xl shadow-[#22C55E]/15 scale-[1.02] z-10"
                    : "border border-white/10 bg-[#111827] hover:border-white/20",
                ].join(" ")}
              >
                {/* Badge "Mais escolhido" no Pro */}
                {isPro && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#22C55E] px-4 py-1 text-[11px] font-black uppercase tracking-wider text-black shadow-md flex items-center gap-1.5">
                    <Sparkles size={12} className="fill-black" />
                    {plan.badge ?? "Mais escolhido"}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <p
                    className={`text-[11px] font-bold uppercase tracking-[0.2em] ${
                      isPro ? "text-[#22C55E]" : "text-slate-400"
                    }`}
                  >
                    bébbi {plan.name}
                  </p>
                  {isEnterprise && (
                    <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-bold text-blue-400 border border-blue-500/20">
                      Grande porte
                    </span>
                  )}
                </div>

                {/* Preço */}
                <div className="mt-4 leading-none">
                  {isEnterprise ? (
                    <div className="py-2">
                      <span className="font-display text-3xl font-bold text-white">Sob consulta</span>
                      <p className="mt-2 text-[12px] text-slate-400">
                        Proposta sob medida para o tamanho da sua operação
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-end gap-1">
                        <span className="font-display text-[2.2rem] font-bold text-white">
                          {formatBRL(monthlyEquiv)}
                        </span>
                        <span className="mb-1 text-xs text-slate-400">/mês</span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-400">
                        {period === "monthly"
                          ? "cobrança mês a mês"
                          : `${formatBRL(totalPeriod)} cobrados ${
                              period === "semiannual" ? "semestralmente" : "anualmente"
                            }`}
                      </p>
                    </div>
                  )}
                </div>

                <p className="mt-4 text-[13px] leading-relaxed text-slate-300 min-h-[40px]">
                  {plan.tagline}
                </p>

                <div className="my-6 h-px bg-white/[0.08]" />

                {/* Lista de Features */}
                <ul className="flex-1 space-y-3 text-[13px] text-slate-300">
                  {plan.featureList.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 leading-snug">
                      <Check
                        size={14}
                        className={`mt-0.5 shrink-0 ${
                          isPro ? "text-[#22C55E]" : "text-slate-400"
                        }`}
                      />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {/* Botão de Ação */}
                <div className="mt-8 border-t border-white/[0.08] pt-6">
                  {isEnterprise ? (
                    <a
                      href="https://wa.me/5511999999999?text=Ol%C3%A1%2C%20tenho%20interesse%20no%20plano%20Enterprise%20do%20b%C3%A9bbi."
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[0.06] py-3 text-[13px] font-bold text-white transition hover:border-[#22C55E] hover:bg-[#22C55E]/10 hover:text-[#22C55E]"
                    >
                      <MessageCircle size={15} />
                      Falar com vendas
                    </a>
                  ) : (
                    <a
                      href={`/checkout/distribuidora?plan=${key}&period=${period}`}
                      className={[
                        "flex w-full items-center justify-center rounded-xl py-3 text-[13px] font-bold transition duration-200",
                        isPro
                          ? "bg-[#22C55E] text-black hover:bg-[#1ea850] shadow-lg shadow-[#22C55E]/20"
                          : "border border-white/20 text-slate-200 hover:border-white/40 hover:bg-white/[0.04]",
                      ].join(" ")}
                    >
                      {period === "monthly" ? "Começar 14 dias grátis" : "Começar agora"}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── COMPRADORES (Bar / Restaurante) ───────────────────────────────── */}
        <div className="mb-5 flex items-end justify-between gap-4 border-b border-white/[0.06] pb-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Para</p>
            <h2 className="font-display text-3xl font-bold text-white">Bares e Restaurantes</h2>
          </div>
          <p className="text-right text-[11px] text-slate-400">
            cadastro e uso básico grátis para sempre
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Free */}
          <div className="flex flex-col rounded-2xl border border-white/10 bg-[#111827] p-7">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
              bébbi {BUYER_PLANS.free.name}
            </p>
            <div className="mt-4">
              <span className="font-display text-[2.2rem] font-bold text-white">Grátis</span>
              <p className="mt-1 text-[11px] text-slate-400">para sempre, sem necessidade de cartão</p>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-slate-300">
              {BUYER_PLANS.free.tagline}
            </p>
            <div className="my-6 h-px bg-white/[0.08]" />
            <ul className="flex-1 space-y-3 text-[13px] text-slate-300">
              {BUYER_PLANS.free.featureList.map((f) => (
                <li key={f} className="flex items-start gap-2.5 leading-snug">
                  <Check size={14} className="mt-0.5 shrink-0 text-slate-400" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 border-t border-white/[0.08] pt-6">
              <a
                href="/auth/register?role=client"
                className="flex w-full items-center justify-center rounded-xl border border-white/20 py-3 text-[13px] font-bold text-slate-200 transition hover:border-white/40 hover:bg-white/[0.04]"
              >
                Criar conta grátis
              </a>
            </div>
          </div>

          {/* Pro Comprador */}
          <div
            className="flex flex-col rounded-2xl border-2 border-[#22C55E] bg-[#111827] p-7 shadow-xl shadow-[#22C55E]/10"
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#22C55E]">
                bébbi {BUYER_PLANS.pro.name}
              </p>
              <span className="rounded-full bg-[#22C55E]/15 border border-[#22C55E]/30 px-3 py-0.5 text-[11px] font-bold text-[#22C55E]">
                {BUYER_PLANS.pro.badge}
              </span>
            </div>
            <div className="mt-4 leading-none">
              <div className="flex items-end gap-1">
                <span className="font-display text-[2.2rem] font-bold text-white">
                  R$ 14,90
                </span>
                <span className="mb-1 text-xs text-slate-400">/mês no anual</span>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">
                ou R$ 19,90 no plano mensal · pagamento via cartão ou Pix recorrente
              </p>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-slate-300">
              {BUYER_PLANS.pro.tagline}
            </p>
            <div className="my-6 h-px bg-white/[0.08]" />
            <ul className="flex-1 space-y-3 text-[13px] text-slate-300">
              {BUYER_PLANS.pro.featureList.map((f) => (
                <li key={f} className="flex items-start gap-2.5 leading-snug">
                  <Check size={14} className="mt-0.5 shrink-0 text-[#22C55E]" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 border-t border-white/[0.08] pt-6">
              <a
                href="/checkout/comprador"
                className="flex w-full items-center justify-center rounded-xl bg-[#22C55E] py-3 text-[13px] font-bold text-black transition hover:bg-[#1ea850] shadow-lg shadow-[#22C55E]/20"
              >
                Assinar Pro Comprador
              </a>
            </div>
          </div>
        </div>

        {/* Rodapé da seção */}
        <div className="mt-12 rounded-2xl border border-white/[0.08] bg-[#111827]/60 p-6 text-center">
          <p className="text-[13px] text-slate-400">
            Dúvidas sobre o plano ideal para a sua distribuidora ou estabelecimento?{" "}
            <a
              href="https://wa.me/5511999999999"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#22C55E] hover:underline"
            >
              Fale pelo WhatsApp
            </a>{" "}
            — nossa equipe responde em minutos.
          </p>
          <p className="mt-2 text-[11px] text-slate-500">
            Todos os planos incluem: CNPJ verificado automaticamente · suporte dedicado · sem fidelidade ou multa
          </p>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
