"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/Button";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TopDistributor = { name: string; order_count: number; value_cents: number };
type TopProduct     = { product_name: string; brand: string; quote_count: number };

type MonthlyReport = {
  id: string;
  month: number;
  year: number;
  total_quotations: number;
  total_orders: number;
  total_value_cents: number;
  avg_distributors_per_quotation: number;
  top_distributors: TopDistributor[];
  top_products: TopProduct[];
  created_at: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function monthLabel(month: number, year: number): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" })
    .format(new Date(year, month - 1, 1));
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Gráfico de barras (SVG) — total gasto por mês ───────────────────────────

function SpendingChart({ reports }: { reports: MonthlyReport[] }) {
  const sorted  = [...reports].sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
  const maxVal  = Math.max(...sorted.map((r) => r.total_value_cents), 1);
  const barW    = Math.min(48, Math.floor(520 / Math.max(sorted.length, 1)) - 8);

  return (
    <div className="overflow-x-auto">
      <svg width={Math.max(sorted.length * (barW + 8), 300)} height={140} className="block">
        {sorted.map((r, i) => {
          const pct  = r.total_value_cents / maxVal;
          const barH = Math.max(4, Math.round(pct * 100));
          const x    = i * (barW + 8);
          const y    = 100 - barH;
          return (
            <g key={r.id}>
              <rect x={x} y={y} width={barW} height={barH} rx={4} fill="#22C55E" opacity={0.8} />
              <title>{capitalize(monthLabel(r.month, r.year))}: {formatBRL(r.total_value_cents)}</title>
              <text x={x + barW / 2} y={120} textAnchor="middle" fontSize={9} fill="#94a3b8">
                {new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(new Date(r.year, r.month - 1))}
              </text>
              {r.total_value_cents > 0 && (
                <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize={8} fill="#22C55E" fontWeight="700">
                  {formatBRL(r.total_value_cents).replace("R$ ", "R$")}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Exportar CSV ─────────────────────────────────────────────────────────────

function exportCSV(reports: MonthlyReport[]) {
  const rows = [
    ["Mês", "Ano", "Cotações", "Pedidos", "Valor Total (R$)", "Média Distribuidoras/Cotação"],
    ...reports.map((r) => [
      r.month,
      r.year,
      r.total_quotations,
      r.total_orders,
      (r.total_value_cents / 100).toFixed(2),
      r.avg_distributors_per_quotation.toFixed(1),
    ]),
  ];
  const csv  = rows.map((r) => r.join(";")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "hubby-relatorios.csv"; a.click();
  URL.revokeObjectURL(url);
}

// ─── Comparação com mês anterior ──────────────────────────────────────────────

function MoMComparison({ current, previous }: { current: MonthlyReport; previous: MonthlyReport | null }) {
  if (!previous) return null;
  const diff = current.total_value_cents - previous.total_value_cents;
  const pct  = previous.total_value_cents > 0
    ? Math.round((diff / previous.total_value_cents) * 100)
    : null;

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${diff < 0 ? "border-green-200 bg-green-50" : diff > 0 ? "border-amber-200 bg-amber-50" : "border-[#DBEAFE] bg-[#F5F7FB]"}`}>
      <p className="font-semibold text-[#0F172A]">
        Comparação com {capitalize(monthLabel(previous.month, previous.year))}
      </p>
      <p className="mt-0.5 text-slate-600">
        Você gastou{" "}
        <strong className={diff < 0 ? "text-green-700" : diff > 0 ? "text-amber-700" : "text-[#0F172A]"}>
          {formatBRL(current.total_value_cents)}
        </strong>{" "}
        em {capitalize(monthLabel(current.month, current.year))} vs{" "}
        <strong>{formatBRL(previous.total_value_cents)}</strong> em{" "}
        {capitalize(monthLabel(previous.month, previous.year))}.
        {pct !== null && (
          <span className={`ml-1 font-bold ${diff < 0 ? "text-green-700" : "text-amber-700"}`}>
            ({diff < 0 ? "-" : "+"}{Math.abs(pct)}%{diff < 0 ? " — ótimo!" : ""})
          </span>
        )}
      </p>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function RelatoriosPage() {
  const { data: session, status } = useSession({ required: true });
  const router  = useRouter();
  const token   = useApiToken();
  const role    = (session?.user as { role?: string })?.role ?? "";

  const [reports, setReports]       = useState<MonthlyReport[]>([]);
  const [loading, setLoading]       = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected]     = useState<MonthlyReport | null>(null);

  useEffect(() => {
    if (status === "authenticated" && role && role !== "client") router.replace("/");
  }, [status, role, router]);

  useEffect(() => {
    if (!token) return;
    apiFetch("/api/reports", { method: "GET", token })
      .then(async (r) => {
        const data = await r.json() as { reports: MonthlyReport[] };
        setReports(data.reports ?? []);
        if (data.reports?.length > 0) setSelected(data.reports[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  async function generateReport() {
    if (!token) return;
    setGenerating(true);
    const res  = await apiFetch("/api/reports", { method: "POST", token });
    const data = await res.json() as { report: MonthlyReport };
    setGenerating(false);
    if (data.report) {
      setReports((prev) => {
        const exists = prev.find((r) => r.id === data.report.id);
        return exists ? prev.map((r) => r.id === data.report.id ? data.report : r) : [data.report, ...prev];
      });
      setSelected(data.report);
    }
  }

  // Mês anterior ao selecionado
  const prevReport = selected
    ? reports.find((r) => {
        const prevMonth = selected.month === 1 ? 12 : selected.month - 1;
        const prevYear  = selected.month === 1 ? selected.year - 1 : selected.year;
        return r.month === prevMonth && r.year === prevYear;
      }) ?? null
    : null;

  if (loading || status === "loading") {
    return (
      <div className="flex min-h-screen flex-col bg-[#F5F7FB]">
        <Navbar />
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#22C55E] border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F7FB]">
      <Navbar />

      <main className="mx-auto w-full max-w-3xl px-4 py-10">

        {/* Header */}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#0F172A]">Relatórios</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">Gastos e histórico mensal das suas cotações</p>
          </div>
          <div className="flex gap-2">
            {reports.length > 0 && (
              <Button variant="secondary" size="sm" onClick={() => exportCSV(reports)}>
                Exportar CSV
              </Button>
            )}
            <Button size="sm" loading={generating} onClick={generateReport}>
              Gerar relatório
            </Button>
          </div>
        </div>

        {reports.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-300 mx-auto mb-3"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
            <p className="mb-1 text-base font-semibold text-[#0F172A]">Nenhum relatório gerado ainda</p>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Relatórios são gerados automaticamente no dia 1 de cada mês.
            </p>
            <div className="mt-5">
              <Button loading={generating} onClick={generateReport} size="sm">Gerar agora</Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[200px_1fr]">

            {/* Sidebar — lista de meses */}
            <div className="flex flex-col gap-1">
              {reports.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className={[
                    "rounded-xl px-4 py-3 text-left text-sm transition-all",
                    selected?.id === r.id
                      ? "bg-[#0F172A] font-semibold text-white"
                      : "font-medium text-slate-600 hover:bg-[#DCFCE7]/50 hover:text-[#0F172A]",
                  ].join(" ")}
                >
                  {capitalize(monthLabel(r.month, r.year))}
                </button>
              ))}
            </div>

            {/* Detalhe do mês selecionado */}
            {selected && (
              <div className="space-y-4">

                {/* Total gasto — hero */}
                <div className="rounded-2xl border border-[#DBEAFE] bg-white p-6 text-center shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Total gasto via plataforma</p>
                  <p className="mt-1 text-4xl font-display font-extrabold text-[#22C55E]">
                    {formatBRL(selected.total_value_cents)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    em {capitalize(monthLabel(selected.month, selected.year))}
                  </p>
                </div>

                {/* Métricas */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {[
                    { label: "Cotações realizadas", value: selected.total_quotations },
                    { label: "Pedidos enviados",    value: selected.total_orders },
                    { label: "Dist. por cotação",   value: selected.avg_distributors_per_quotation.toFixed(1) },
                  ].map((m) => (
                    <div key={m.label} className="rounded-xl border border-[#DBEAFE] bg-white p-4 text-center">
                      <p className="text-2xl font-black text-[#0F172A]">{m.value}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">{m.label}</p>
                    </div>
                  ))}
                </div>

                {/* Comparação com mês anterior */}
                <MoMComparison current={selected} previous={prevReport} />

                {/* Top distribuidoras */}
                {selected.top_distributors.length > 0 && (
                  <div className="rounded-2xl border border-[#DBEAFE] bg-white p-5 shadow-sm">
                    <h3 className="mb-3 text-sm font-display font-bold text-[#0F172A]">Top 3 distribuidoras</h3>
                    <div className="space-y-2">
                      {selected.top_distributors.slice(0, 3).map((d, i) => (
                        <div key={d.name} className="flex items-center gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F5F7FB] text-xs font-bold text-slate-500">
                            {i + 1}
                          </span>
                          <span className="flex-1 text-sm text-[#0F172A] truncate">{d.name}</span>
                          <span className="text-sm font-semibold text-[#22C55E]">{formatBRL(d.value_cents)}</span>
                          <span className="text-xs text-slate-400 shrink-0">{d.order_count} pedido{d.order_count !== 1 ? "s" : ""}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Produto mais cotado */}
                {selected.top_products.length > 0 && (
                  <div className="rounded-2xl border border-[#DBEAFE] bg-white p-5 shadow-sm">
                    <h3 className="mb-3 text-sm font-display font-bold text-[#0F172A]">Produtos mais cotados</h3>
                    <div className="space-y-2">
                      {selected.top_products.slice(0, 5).map((p, i) => (
                        <div key={`${p.brand}|${p.product_name}`} className="flex items-center gap-3">
                          {i === 0 && (
                            <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-600">1</span>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#0F172A] truncate">{p.product_name}</p>
                            <p className="text-xs text-slate-400">{p.brand}</p>
                          </div>
                          <span className="rounded-full bg-[#DCFCE7] px-2.5 py-0.5 text-xs font-bold text-[#22C55E]">
                            {p.quote_count}x
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Gráfico de barras — gastos por mês */}
        {reports.length > 1 && (
          <div className="mt-6 rounded-2xl border border-[#DBEAFE] bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-display font-bold text-[#0F172A]">Gastos mensais (últimos 6 meses)</h3>
            <SpendingChart reports={reports.slice(0, 6)} />
          </div>
        )}

      </main>
    </div>
  );
}
