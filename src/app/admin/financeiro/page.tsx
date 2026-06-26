"use client";

import { useEffect, useState } from "react";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";

type Financial = {
  mrr_by_plan: Record<string, number>;
  mrr_total_cents: number;
  active_count: number; trial_count: number; cancelled_count: number;
  new_this_month: number; churned_this_month: number;
  trial_expiring_soon: number; conversion_rate: number;
};

const PLAN_LABEL: Record<string, string> = { starter: "Starter", pro: "Pro", business: "Business", enterprise: "Enterprise" };
const PLAN_COLOR: Record<string, string> = {
  starter: "bg-slate-100 text-slate-700",
  pro: "bg-blue-100 text-blue-700",
  business: "bg-violet-100 text-violet-700",
  enterprise: "bg-amber-100 text-amber-700",
};

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function StatCard({ label, value, sub, color = "text-[#0F172A]" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`mt-1 text-3xl font-extrabold tracking-tight ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-xs font-medium text-slate-500">{sub}</p>}
    </div>
  );
}

export default function AdminFinanceiroPage() {
  const token = useApiToken();
  const [data, setData] = useState<Financial | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    apiFetch("/api/admin/financeiro", { method: "GET", token })
      .then(async (r) => { if (r.ok) setData(await r.json()); })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200" />)}</div>
    </main>;
  }

  if (!data) return <main className="mx-auto max-w-5xl px-4 py-8"><p className="text-sm text-slate-500">Erro ao carregar dados financeiros.</p></main>;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-[#0F172A]">Financeiro</h1>
      <p className="mb-6 text-sm font-medium text-slate-500">Receita e métricas de assinatura</p>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="MRR Total" value={formatBRL(data.mrr_total_cents)} sub="mensalidades ativas" color="text-[#22C55E]" />
        <StatCard label="Ativas" value={String(data.active_count)} sub="distribuidoras com plano ativo" />
        <StatCard label="Trial" value={String(data.trial_count)} sub={`${data.trial_expiring_soon} expirando em breve`} color="text-amber-600" />
        <StatCard label="Taxa de conversão" value={`${data.conversion_rate}%`} sub="trial → ativo" />
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Novas este mês" value={String(data.new_this_month)} sub="novas assinaturas ativas" color="text-[#22C55E]" />
        <StatCard label="Churn este mês" value={String(data.churned_this_month)} sub="cancelamentos (aprox.)" color="text-red-600" />
        <StatCard label="Canceladas" value={String(data.cancelled_count)} sub="total histórico" />
        <StatCard label="Trial expirando" value={String(data.trial_expiring_soon)} sub="> 14 dias sem converter" color="text-amber-600" />
      </div>

      {/* MRR por plano */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-[#0F172A]">MRR por plano</h2>
        <div className="space-y-3">
          {Object.entries(data.mrr_by_plan).filter(([, v]) => v > 0).map(([plan, mrr]) => {
            const pct = data.mrr_total_cents > 0 ? (mrr / data.mrr_total_cents) * 100 : 0;
            return (
              <div key={plan}>
                <div className="mb-1 flex items-center justify-between">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${PLAN_COLOR[plan] ?? "bg-slate-100 text-slate-600"}`}>
                    {PLAN_LABEL[plan] ?? plan}
                  </span>
                  <span className="text-sm font-bold text-[#0F172A]">{formatBRL(mrr)}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-[#22C55E]" style={{ width: `${pct.toFixed(1)}%` }} />
                </div>
                <p className="mt-0.5 text-right text-[11px] font-medium text-slate-400">{pct.toFixed(1)}%</p>
              </div>
            );
          })}
          {Object.values(data.mrr_by_plan).every((v) => v === 0) && (
            <p className="text-sm font-medium text-slate-400">Sem receita ativa no momento.</p>
          )}
        </div>
      </div>
    </main>
  );
}
