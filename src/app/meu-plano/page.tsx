"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";
import {
  CreditCard, ExternalLink, Calendar, AlertTriangle,
  CheckCircle, XCircle, Clock, Zap, X,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Period = "monthly" | "quarterly" | "semiannual" | "annual";

type Invoice = {
  id: string;
  amount_paid: number;
  status: string | null;
  created: string;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
};

type MyPlan = {
  entity: "client" | "distributor";
  plan: string;
  status: string | null;
  period: string | null;
  renewal_date: string | null;
  cancel_at: string | null;
  invoices: Invoice[];
};

// ─── Constantes de preço e período ───────────────────────────────────────────

const PERIOD_LABELS: Record<Period, string> = {
  monthly: "Mensal", quarterly: "Trimestral", semiannual: "Semestral", annual: "Anual",
};
const PERIOD_DISC: Record<Period, number> = {
  monthly: 0, quarterly: 10, semiannual: 15, annual: 20,
};
const PERIOD_MONTHS: Record<Period, number> = {
  monthly: 1, quarterly: 3, semiannual: 6, annual: 12,
};
const PERIOD_MULT: Record<Period, number> = {
  monthly: 1, quarterly: 0.90, semiannual: 0.85, annual: 0.80,
};

// Preço mensal base em centavos
const DIST_BASE: Record<string, number> = {
  starter: 29900, pro: 79900, business: 149900,
};
const BUYER_BASE = 9900;

const DIST_PLAN_ORDER = ["starter", "pro", "business", "enterprise"] as const;

// O que cada plano GANHA em relação ao anterior
const DIST_GAINS: Record<string, string[]> = {
  pro: [
    "Até 5 usuários com permissões distintas",
    "Fila de atendimento e carteira de clientes",
    "Histórico completo de cotações e pedidos",
    "Relatórios de performance da equipe",
    "Destaque no ranking de preços",
  ],
  business: [
    "Usuários e colaboradores ilimitados",
    "Hierarquia de equipe comercial completa",
    "Integração ERP via webhook em tempo real",
    "Relatórios avançados exportáveis por período",
    "Onboarding e suporte dedicados",
  ],
  enterprise: [
    "Gestão automática de vencimentos com ERP",
    "Notificação automática a compradores da região",
    "SLA garantido e suporte 24 horas por dia",
    "Account manager exclusivo",
    "API própria e integração sob medida",
  ],
};

const DIST_TARGET: Record<string, string> = {
  starter:    "Distribuidoras que estão começando na plataforma.",
  pro:        "Equipes que querem vender mais e perder menos.",
  business:   "Operações que precisam de escala e controle total.",
  enterprise: "Para grandes distribuidoras — sob consulta.",
};

const BUYER_GAINS = [
  "Cotar com distribuidoras de qualquer região do Brasil",
  "Alertas de queda de preço nas marcas que você compra",
  "Relatórios mensais de economia e top distribuidoras",
  "Múltiplos endereços de entrega cadastrados",
];

const WA_ENTERPRISE = "https://wa.me/5511999999999?text=Ol%C3%A1%2C%20tenho%20interesse%20no%20plano%20Enterprise%20da%20Hubby.";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(cents / 100);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

function monthlyDisplay(baseCents: number, period: Period): number {
  return Math.round(baseCents * PERIOD_MULT[period]);
}
function totalCharge(baseCents: number, period: Period): number {
  return monthlyDisplay(baseCents, period) * PERIOD_MONTHS[period];
}
function periodLabel(period: Period, months: number): string {
  if (months === 1)  return "cobrado mensalmente";
  if (months === 3)  return "cobrado a cada 3 meses";
  if (months === 6)  return "cobrado a cada 6 meses";
  return "cobrado anualmente";
}

const PLAN_DISPLAY: Record<string, string> = {
  free: "Gratuito", pro: "Pro",
  starter: "Starter", business: "Business", enterprise: "Enterprise",
};

function planCurrentPrice(plan: string, period: string | null, entity: "client" | "distributor"): string {
  if (entity === "client") {
    if (plan === "free") return "Grátis";
    const m = BUYER_BASE;
    if (period === "quarterly")  return fmt(Math.round(m * 0.90)) + "/mês";
    if (period === "semiannual") return fmt(Math.round(m * 0.85)) + "/mês";
    if (period === "annual")     return fmt(Math.round(m * 0.80)) + "/mês";
    return fmt(m) + "/mês";
  }
  const base = DIST_BASE[plan] ?? 0;
  if (!base) return "Sob consulta";
  if (period === "quarterly")  return fmt(Math.round(base * 0.90)) + "/mês";
  if (period === "semiannual") return fmt(Math.round(base * 0.85)) + "/mês";
  if (period === "annual")     return fmt(Math.round(base * 0.80)) + "/mês";
  return fmt(base) + "/mês";
}

type StatusMeta = { label: string; color: string; icon: React.ReactNode };

function statusMeta(status: string | null): StatusMeta {
  switch (status) {
    case "active":          return { label: "Ativo",          color: "text-green-600 bg-green-50 border-green-200",    icon: <CheckCircle size={13} /> };
    case "trial":           return { label: "Trial",          color: "text-blue-600 bg-blue-50 border-blue-200",       icon: <Clock size={13} /> };
    case "pending_payment": return { label: "Aguard. pagto.", color: "text-yellow-600 bg-yellow-50 border-yellow-200", icon: <AlertTriangle size={13} /> };
    case "suspended":       return { label: "Suspenso",       color: "text-red-600 bg-red-50 border-red-200",          icon: <XCircle size={13} /> };
    case "cancelled":       return { label: "Cancelado",      color: "text-slate-500 bg-slate-50 border-slate-200",    icon: <XCircle size={13} /> };
    default:                return { label: "—",              color: "text-slate-400 bg-slate-50 border-slate-200",    icon: null };
  }
}

function invoiceStatusLabel(s: string | null) {
  if (s === "paid") return { label: "Pago",    cls: "text-green-600 bg-green-50" };
  if (s === "open") return { label: "Aberto",  cls: "text-yellow-600 bg-yellow-50" };
  if (s === "void") return { label: "Anulado", cls: "text-slate-400 bg-slate-100" };
  return { label: s ?? "—", cls: "text-slate-400 bg-slate-100" };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-[#DBEAFE] bg-white shadow-sm">
      <div className="border-b border-[#DBEAFE] px-6 py-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}

// ─── Modal de cancelamento ────────────────────────────────────────────────────

function CancelModal({ onConfirm, onClose, loading }: {
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-100">
            <AlertTriangle size={20} className="text-red-500" />
          </div>
          <div>
            <p className="font-bold text-[#0F172A]">Cancelar plano</p>
            <p className="text-xs text-slate-500">Esta ação não pode ser desfeita</p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-full p-1 text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>
        <p className="mb-5 text-sm text-slate-600">
          Ao cancelar, você perderá acesso às funcionalidades pagas no fim do período atual. Tem certeza?
        </p>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 rounded-xl border border-[#DBEAFE] py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
            Manter plano
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white transition hover:bg-red-600 disabled:opacity-60">
            {loading ? "Cancelando…" : "Sim, cancelar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Toggle de período (compartilhado) ───────────────────────────────────────

function PeriodToggle({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap justify-center rounded-xl border border-[#DBEAFE] bg-[#F5F7FB] p-1 gap-1">
        {(["monthly", "quarterly", "semiannual", "annual"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={[
              "min-h-[36px] cursor-pointer select-none rounded-lg px-3 py-1.5 text-xs font-semibold touch-manipulation transition-all",
              period === p ? "bg-white shadow-sm text-[#0F172A]" : "text-slate-500 hover:text-[#0F172A]",
            ].join(" ")}
          >
            {PERIOD_LABELS[p]}
            {PERIOD_DISC[p] > 0 && (
              <span className={`ml-1 text-[10px] font-bold ${period === p ? "text-[#22C55E]" : "text-[#22C55E]/70"}`}>
                -{PERIOD_DISC[p]}%
              </span>
            )}
          </button>
        ))}
      </div>
      {period === "annual" && (
        <span className="rounded-full bg-[#22C55E] px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">
          ECONOMIZE 20%
        </span>
      )}
    </div>
  );
}

// ─── Card de um plano individual ─────────────────────────────────────────────

function PlanCard({
  planKey, period, currentPlan, entity, onUpgrade, isLoading,
}: {
  planKey: string;
  period: Period;
  currentPlan: string;
  entity: "client" | "distributor";
  onUpgrade: (plan: string, period: Period) => void;
  isLoading: boolean;
}) {
  const isEnterprise = planKey === "enterprise";
  const isPro = planKey === "pro" && entity === "distributor";
  const isBuyerPro = planKey === "pro" && entity === "client";

  const base = entity === "client" ? BUYER_BASE : (DIST_BASE[planKey] ?? 0);
  const monthly = isEnterprise ? 0 : monthlyDisplay(base, period);
  const total   = isEnterprise ? 0 : totalCharge(base, period);
  const months  = PERIOD_MONTHS[period];

  const gains = entity === "client" ? BUYER_GAINS : (DIST_GAINS[planKey] ?? []);
  const target = DIST_TARGET[planKey] ?? "";

  const accentColor =
    isEnterprise    ? "border-violet-400"  :
    isPro           ? "border-[#22C55E]"   :
    isBuyerPro      ? "border-[#22C55E]"   :
                      "border-[#2563EB]";

  const btnClass =
    isEnterprise    ? "bg-violet-600 hover:bg-violet-700 text-white" :
    (isPro || isBuyerPro) ? "bg-[#22C55E] hover:opacity-90 text-black" :
                      "bg-[#2563EB] hover:bg-[#1D4ED8] text-white";

  const checkColor =
    isEnterprise    ? "text-violet-500" :
    (isPro || isBuyerPro) ? "text-[#22C55E]" :
                      "text-[#2563EB]";

  return (
    <div className={`flex flex-col rounded-2xl border-2 bg-white p-5 ${accentColor}`}>
      {/* Cabeçalho */}
      <div className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          {PLAN_DISPLAY[planKey]}
        </p>
        {target && <p className="mt-0.5 text-xs text-slate-500">{target}</p>}
      </div>

      {/* Preço */}
      {isEnterprise ? (
        <div className="mb-4">
          <p className="text-xl font-black text-[#0F172A]">Sob consulta</p>
          <p className="mt-0.5 text-[11px] text-slate-400">Personalizado para sua operação</p>
        </div>
      ) : (
        <div className="mb-4">
          <div className="flex items-end gap-1">
            <span className="text-2xl font-black text-[#0F172A]">{fmt(monthly)}</span>
            <span className="mb-0.5 text-xs text-slate-400">/mês</span>
          </div>
          {period !== "monthly" && (
            <p className="mt-0.5 text-[11px] text-slate-400">
              {fmt(total)} {periodLabel(period, months)}
            </p>
          )}
          {period === "annual" && (
            <span className="mt-1 inline-block rounded-full bg-[#22C55E]/15 px-2 py-0.5 text-[10px] font-bold text-[#16A34A]">
              ECONOMIZE 20%
            </span>
          )}
        </div>
      )}

      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
        O que você ganha
      </div>

      {/* Features (ganhos em relação ao plano atual) */}
      <ul className="mb-5 flex-1 space-y-2">
        {gains.map((g) => (
          <li key={g} className="flex items-start gap-2 text-xs text-slate-600">
            <CheckCircle size={13} className={`mt-0.5 shrink-0 ${checkColor}`} />
            {g}
          </li>
        ))}
      </ul>

      {/* CTA */}
      {isEnterprise ? (
        <a
          href={WA_ENTERPRISE}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition ${btnClass}`}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
          </svg>
          Falar com consultor
        </a>
      ) : (
        <button
          onClick={() => onUpgrade(planKey, period)}
          disabled={isLoading}
          className={`rounded-xl py-2.5 text-sm font-bold transition disabled:opacity-60 ${btnClass}`}
        >
          {isLoading
            ? "Aguarde…"
            : `Assinar ${PLAN_DISPLAY[planKey]} — ${fmt(monthly)}/mês`}
        </button>
      )}
    </div>
  );
}

// ─── Comparativo de planos disponíveis ───────────────────────────────────────

function UpgradeComparison({ currentPlan, entity, onUpgrade, upgradingPlan }: {
  currentPlan: string;
  entity: "client" | "distributor";
  onUpgrade: (plan: string, period: Period) => void;
  upgradingPlan: string | null;
}) {
  const [period, setPeriod] = useState<Period>("monthly");

  let plansToShow: string[];
  if (entity === "client") {
    plansToShow = currentPlan === "free" ? ["pro"] : [];
  } else {
    const idx = DIST_PLAN_ORDER.indexOf(currentPlan as typeof DIST_PLAN_ORDER[number]);
    plansToShow = idx >= 0 ? [...DIST_PLAN_ORDER].slice(idx + 1) : [];
  }

  if (plansToShow.length === 0) return null;

  const gridCols =
    plansToShow.length === 1 ? "grid-cols-1" :
    plansToShow.length === 2 ? "grid-cols-1 sm:grid-cols-2" :
                               "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div className="overflow-hidden rounded-3xl border border-[#DBEAFE] bg-white shadow-sm">
      {/* Cabeçalho da seção */}
      <div className="border-b border-[#DBEAFE] px-6 py-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
          Planos disponíveis para upgrade
        </h2>
      </div>

      <div className="px-6 py-5">
        {/* Toggle de período */}
        <div className="mb-5">
          <PeriodToggle period={period} onChange={setPeriod} />
        </div>

        {/* Cards dos planos */}
        <div className={`grid gap-4 ${gridCols}`}>
          {plansToShow.map((planKey) => (
            <PlanCard
              key={planKey}
              planKey={planKey}
              period={period}
              currentPlan={currentPlan}
              entity={entity}
              onUpgrade={onUpgrade}
              isLoading={upgradingPlan === planKey}
            />
          ))}
        </div>

        {/* Nota explicativa */}
        <p className="mt-5 text-center text-[11px] leading-relaxed text-slate-400">
          Os planos trimestrais, semestrais e anuais são cobrados de uma vez no cartão.
          Você pode cancelar a qualquer momento — o acesso continua até o fim do período pago.{" "}
          <Link href="/planos" className="font-semibold text-[#2563EB] hover:underline">
            Ver comparação completa →
          </Link>
        </p>
      </div>
    </div>
  );
}

// ─── Histórico de faturas ─────────────────────────────────────────────────────

function InvoiceHistory({ invoices, isFree }: { invoices: Invoice[]; isFree: boolean }) {
  if (invoices.length === 0 && isFree) return null;
  return (
    <Section title="Histórico de faturas">
      {invoices.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhuma fatura encontrada.</p>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => {
            const { label, cls } = invoiceStatusLabel(inv.status);
            return (
              <div key={inv.id} className="flex items-center justify-between rounded-xl border border-[#DBEAFE] bg-[#F5F7FB] px-4 py-3">
                <div className="flex items-center gap-3">
                  <CreditCard size={14} className="shrink-0 text-slate-400" />
                  <div>
                    <p className="text-sm font-semibold text-[#0F172A]">{fmt(inv.amount_paid)}</p>
                    <p className="text-xs text-slate-400">{fmtDate(inv.created)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>{label}</span>
                  {inv.hosted_invoice_url && (
                    <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer"
                      className="rounded-lg p-1 text-slate-400 transition hover:text-[#2563EB]">
                      <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

// ─── Seção do comprador ───────────────────────────────────────────────────────

function ClientPlanSection({ data }: { data: MyPlan }) {
  const token = useApiToken();
  const [cancelOpen,    setCancelOpen]    = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [upgradingPlan, setUpgradingPlan] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const isFree = data.plan === "free" || !data.status;
  const sm = statusMeta(isFree ? null : data.status);

  const openPortal = async () => {
    if (!token) return;
    setPortalLoading(true);
    try {
      const res = await apiFetch("/api/billing/portal", { method: "POST", token });
      const d = await res.json() as { url?: string; error?: string };
      if (d.url) window.open(d.url, "_blank", "noopener,noreferrer");
      else setMsg(d.error ?? "Erro ao abrir portal.");
    } finally { setPortalLoading(false); }
  };

  const handleCancel = async () => {
    if (!token) return;
    setCancelLoading(true);
    try {
      const res = await apiFetch("/api/billing/portal", { method: "POST", token });
      const d = await res.json() as { url?: string };
      if (d.url) window.open(d.url, "_blank", "noopener,noreferrer");
    } finally { setCancelLoading(false); setCancelOpen(false); }
  };

  const handleUpgrade = async (plan: string, period: Period) => {
    if (!token) return;
    setUpgradingPlan(plan);
    try {
      const res = await apiFetch("/api/billing/buyer/checkout", {
        method: "POST", token,
        body: JSON.stringify({ period }),
      });
      const d = await res.json() as { checkout_url?: string; error?: string };
      if (d.checkout_url) window.location.href = d.checkout_url;
      else setMsg(d.error ?? "Erro ao iniciar checkout.");
    } finally { setUpgradingPlan(null); }
  };

  if (isFree) {
    return (
      <>
        <Section title="Plano atual">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F5F7FB]">
              <Zap size={22} className="text-slate-400" />
            </div>
            <div>
              <p className="text-lg font-black text-[#0F172A]">Gratuito</p>
              <p className="text-sm text-slate-500">Acesso ao plano básico — cote na sua região</p>
            </div>
          </div>
        </Section>

        <UpgradeComparison
          currentPlan="free"
          entity="client"
          onUpgrade={handleUpgrade}
          upgradingPlan={upgradingPlan}
        />
        {msg && <p className="text-xs text-red-500">{msg}</p>}
      </>
    );
  }

  return (
    <>
      <Section title="Plano atual">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50">
              <Zap size={22} className="text-[#22C55E]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-lg font-black text-[#0F172A]">Pro</p>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${sm.color}`}>
                  {sm.icon}{sm.label}
                </span>
              </div>
              <p className="text-sm text-slate-500">
                {planCurrentPrice(data.plan, data.period, "client")}{" "}
                {data.period && <span className="text-slate-400">· {PERIOD_LABELS[data.period as Period] ?? data.period}</span>}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            {data.renewal_date && (
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <Calendar size={12} />
                {data.cancel_at ? "Acesso até" : "Renova em"} {fmtDate(data.cancel_at ?? data.renewal_date)}
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={openPortal} disabled={portalLoading}
                className="flex items-center gap-1.5 rounded-xl border border-[#DBEAFE] bg-[#F5F7FB] px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50">
                <ExternalLink size={12} />{portalLoading ? "Abrindo…" : "Gerenciar pagamento"}
              </button>
              <button onClick={() => setCancelOpen(true)}
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-100">
                Cancelar
              </button>
            </div>
          </div>
        </div>
        {msg && <p className="mt-3 text-xs text-red-500">{msg}</p>}
      </Section>

      <InvoiceHistory invoices={data.invoices} isFree={false} />

      {cancelOpen && (
        <CancelModal loading={cancelLoading} onConfirm={handleCancel} onClose={() => setCancelOpen(false)} />
      )}
    </>
  );
}

// ─── Seção da distribuidora ───────────────────────────────────────────────────

function DistributorPlanSection({ data }: { data: MyPlan }) {
  const token = useApiToken();
  const [cancelOpen,    setCancelOpen]    = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [upgradingPlan, setUpgradingPlan] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const sm = statusMeta(data.status);
  const isEnterprise = data.plan === "enterprise";
  const isTrial = data.status === "trial";
  const isFree  = !data.status;

  const openPortal = async () => {
    if (!token) return;
    setPortalLoading(true);
    try {
      const res = await apiFetch("/api/billing/portal", { method: "POST", token });
      const d = await res.json() as { url?: string; error?: string };
      if (d.url) window.open(d.url, "_blank", "noopener,noreferrer");
      else setMsg(d.error ?? "Erro ao abrir portal.");
    } finally { setPortalLoading(false); }
  };

  const handleUpgrade = async (plan: string, period: Period) => {
    if (!token) return;
    setUpgradingPlan(plan);
    try {
      const res = await apiFetch("/api/billing/checkout", {
        method: "POST", token,
        body: JSON.stringify({ plan, period }),
      });
      const d = await res.json() as { checkout_url?: string; error?: string };
      if (d.checkout_url) window.location.href = d.checkout_url;
      else setMsg(d.error ?? "Erro ao iniciar checkout.");
    } finally { setUpgradingPlan(null); }
  };

  const handleCancel = async () => {
    if (!token) return;
    setCancelLoading(true);
    try {
      const res = await apiFetch("/api/billing/portal", { method: "POST", token });
      const d = await res.json() as { url?: string };
      if (d.url) window.open(d.url, "_blank", "noopener,noreferrer");
    } finally { setCancelLoading(false); setCancelOpen(false); }
  };

  return (
    <>
      {/* Plano atual */}
      <Section title="Plano atual">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${isEnterprise ? "bg-violet-50" : "bg-green-50"}`}>
              <Zap size={22} className={isEnterprise ? "text-violet-500" : "text-[#22C55E]"} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-black text-[#0F172A]">{PLAN_DISPLAY[data.plan] ?? data.plan}</p>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${sm.color}`}>
                  {sm.icon}{sm.label}
                </span>
                {isTrial && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-600">
                    14 dias grátis
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500">
                {planCurrentPrice(data.plan, data.period, "distributor")}{" "}
                {data.period && <span className="text-slate-400">· {PERIOD_LABELS[data.period as Period] ?? data.period}</span>}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            {data.renewal_date && (
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <Calendar size={12} />
                {data.cancel_at ? "Acesso até" : isTrial ? "Trial até" : "Renova em"} {fmtDate(data.cancel_at ?? data.renewal_date)}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {!isFree && (
                <button onClick={openPortal} disabled={portalLoading}
                  className="flex items-center gap-1.5 rounded-xl border border-[#DBEAFE] bg-[#F5F7FB] px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50">
                  <ExternalLink size={12} />{portalLoading ? "Abrindo…" : "Gerenciar pagamento"}
                </button>
              )}
              {!isFree && !isEnterprise && (
                <button onClick={() => setCancelOpen(true)}
                  className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-100">
                  Cancelar plano
                </button>
              )}
            </div>
          </div>
        </div>
        {msg && <p className="mt-3 text-xs text-red-500">{msg}</p>}
      </Section>

      {/* Comparativo de upgrade */}
      {!isEnterprise && (
        <UpgradeComparison
          currentPlan={data.plan}
          entity="distributor"
          onUpgrade={handleUpgrade}
          upgradingPlan={upgradingPlan}
        />
      )}

      <InvoiceHistory invoices={data.invoices} isFree={isFree} />

      {cancelOpen && (
        <CancelModal loading={cancelLoading} onConfirm={handleCancel} onClose={() => setCancelOpen(false)} />
      )}
    </>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-32 rounded-3xl bg-slate-200" />
      <div className="h-64 rounded-3xl bg-slate-200" />
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function MeuPlanoPage() {
  const { data: session } = useSession({ required: true });
  const token = useApiToken();

  const [data, setData]       = useState<MyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  const role = (session?.user as { role?: string })?.role ?? "";

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiFetch("/api/billing/my-plan", { method: "GET", token });
      if (!res.ok) { setError("Não foi possível carregar os dados do plano."); return; }
      const d = await res.json() as MyPlan;
      setData(d);
    } catch {
      setError("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (!session) return null;

  return (
    <div className="min-h-screen bg-[#F5F7FB]">
      <Navbar />

      <div className="mx-auto max-w-4xl px-4 py-8">

        {/* Cabeçalho */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EFF6FF]">
            <CreditCard size={20} className="text-[#2563EB]" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#0F172A]">Meu Plano</h1>
            <p className="text-sm text-slate-500">
              {role === "client" ? "Plano do comprador" : "Assinatura da distribuidora"}
            </p>
          </div>
          <Link href="/planos" className="ml-auto text-xs font-semibold text-[#2563EB] hover:underline">
            Ver todos os planos →
          </Link>
        </div>

        {/* Conteúdo */}
        {loading ? (
          <Skeleton />
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center text-sm text-red-600">
            {error}
          </div>
        ) : data ? (
          <div className="space-y-4">
            {data.entity === "client" ? (
              <ClientPlanSection data={data} />
            ) : (
              <DistributorPlanSection data={data} />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
