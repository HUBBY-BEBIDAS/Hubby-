"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";
import { Lock } from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Summary = {
  total_orders: number;
  approved_orders: number;
  rejected_orders: number;
  pending_orders: number;
  revenue_cents: number;
  avg_ticket_cents: number;
};

type DayEntry = { date: string; total: number; approved: number };

type ClientEntry = {
  company_name: string;
  city: string;
  state: string;
  orders: number;
  revenue_cents: number;
};

type CityEntry = {
  city: string;
  state: string;
  orders: number;
  revenue_cents: number;
};

type FeedbackSummary = { ok: number; problem: number; auto_ok: number; pending: number };

type ReportData = {
  limited: boolean;
  period: string;
  summary: Summary;
  by_day: DayEntry[];
  top_clients: ClientEntry[];
  top_cities: CityEntry[];
  feedback: FeedbackSummary;
};

type Period = "7d" | "30d" | "90d";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function fmtDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

// ─── Componentes ──────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-[#DBEAFE] bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${accent ? "text-[#2563EB]" : "text-[#0F172A]"}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function BarChart({ data, period }: { data: DayEntry[]; period: Period }) {
  const maxVal = Math.max(...data.map((d) => d.total), 1);

  // Mostra no máximo 30 barras para não poluir
  const step = period === "90d" ? 3 : 1;
  const visible = data.filter((_, i) => i % step === 0);

  return (
    <div className="rounded-3xl border border-[#DBEAFE] bg-white p-5 shadow-sm">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Pedidos por {period === "7d" ? "dia" : period === "30d" ? "dia" : "período"}
      </p>
      {data.every((d) => d.total === 0) ? (
        <p className="py-8 text-center text-sm text-slate-400">Nenhum pedido neste período</p>
      ) : (
        <div className="flex items-end gap-1 overflow-x-auto pb-2" style={{ minHeight: 96 }}>
          {visible.map((d) => {
            const heightPct = Math.max((d.total / maxVal) * 100, 4);
            const approvedPct = d.total > 0 ? (d.approved / d.total) * 100 : 0;
            return (
              <div key={d.date} className="group flex flex-1 min-w-[16px] flex-col items-center gap-1">
                <div
                  className="relative w-full rounded-t-lg overflow-hidden bg-[#DBEAFE]"
                  style={{ height: `${heightPct * 0.8}px`, minHeight: 4 }}
                  title={`${d.date}: ${d.total} pedidos (${d.approved} aprovados)`}
                >
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-[#2563EB] rounded-t-lg transition-all"
                    style={{ height: `${approvedPct}%` }}
                  />
                </div>
                {(period === "7d" || visible.length <= 16) && (
                  <span className="text-[9px] text-slate-400 whitespace-nowrap">{fmtDate(d.date)}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-3 flex gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#2563EB]" /> Aprovados
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#DBEAFE]" /> Total
        </span>
      </div>
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function RelatoriosPage() {
  useSession({ required: true });
  const router = useRouter();
  const token = useApiToken();

  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(p: Period) {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/distributor/reports?period=${p}`, { method: "GET", token });
      if (res.ok) {
        const d = await res.json() as ReportData;
        setData(d);
        // API força 7d para plano vitrine
        if (d.limited) setPeriod("7d");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) load(period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, period]);

  const s = data?.summary;
  const approvalRate = s && s.total_orders > 0
    ? Math.round((s.approved_orders / s.total_orders) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-[#F5F7FB]">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">

        {/* Cabeçalho */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <button
              onClick={() => router.push("/painel")}
              className="mb-1 text-xs text-slate-400 hover:text-slate-600"
            >
              ← Voltar ao painel
            </button>
            <h1 className="text-2xl font-display font-semibold text-[#0F172A]">Relatórios</h1>
          </div>

          {/* Filtro de período */}
          <div className="flex flex-col items-end gap-1">
            <div className={`flex rounded-2xl border border-[#DBEAFE] bg-white overflow-hidden ${data?.limited ? "opacity-50 pointer-events-none" : ""}`}>
              {(["7d", "30d", "90d"] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  disabled={data?.limited}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    period === p
                      ? "bg-[#2563EB] text-white"
                      : "text-slate-500 hover:bg-[#F5F7FB]"
                  }`}
                >
                  {p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : "90 dias"}
                </button>
              ))}
            </div>
            {data?.limited && (
              <p className="text-xs text-slate-400">Período limitado ao plano Vitrine</p>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-[#2563EB] border-t-transparent" />
          </div>
        ) : !data ? (
          <p className="py-20 text-center text-sm text-slate-400">Não foi possível carregar os dados.</p>
        ) : (
          <div className="space-y-6">

            {/* Cards de resumo */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <SummaryCard
                label="Total de pedidos"
                value={String(s!.total_orders)}
              />
              <SummaryCard
                label="Aprovados"
                value={String(s!.approved_orders)}
                sub={`${approvalRate}% de aprovação`}
                accent
              />
              <SummaryCard
                label="Faturamento estimado"
                value={formatBRL(s!.revenue_cents)}
                sub="pedidos aprovados"
              />
              <SummaryCard
                label="Ticket médio"
                value={s!.avg_ticket_cents > 0 ? formatBRL(s!.avg_ticket_cents) : "—"}
                sub="por pedido aprovado"
              />
            </div>

            {/* Cards secundários */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-3xl border border-[#DBEAFE] bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pendentes</p>
                <p className="mt-1 text-xl font-bold text-amber-500">{s!.pending_orders}</p>
              </div>
              <div className="rounded-3xl border border-[#DBEAFE] bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rejeitados</p>
                <p className="mt-1 text-xl font-bold text-red-400">{s!.rejected_orders}</p>
              </div>
              <div className="rounded-3xl border border-[#DBEAFE] bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Feedback OK</p>
                <p className="mt-1 text-xl font-bold text-green-600">{data.feedback.ok}</p>
              </div>
              <div className="rounded-3xl border border-[#DBEAFE] bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Problemas</p>
                <p className="mt-1 text-xl font-bold text-red-600">{data.feedback.problem}</p>
              </div>
            </div>

            {/* Gráfico */}
            <BarChart data={data.by_day} period={period} />

            {/* Top clientes + Top cidades */}
            <div className="grid gap-4 sm:grid-cols-2">

              {/* Top clientes */}
              <div className="relative rounded-3xl border border-[#DBEAFE] bg-white shadow-sm overflow-hidden">
                <div className="border-b border-[#DBEAFE] px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top 5 clientes</p>
                </div>
                {/* Linhas fictícias para vitrine ver mas não ler */}
                <ul className="divide-y divide-[#DBEAFE]">
                  {(data.limited
                    ? [1,2,3,4,5].map((n) => ({ company_name: `Cliente ${n}`, city: "São Paulo", state: "SP", orders: 0, revenue_cents: 0 }))
                    : data.top_clients
                  ).map((c, i) => (
                    <li key={i} className={`flex items-center justify-between gap-3 px-5 py-3 ${data.limited ? "select-none" : ""}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#DBEAFE] text-xs font-bold text-[#1D4ED8]">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className={`truncate text-sm font-medium text-[#0F172A] ${data.limited ? "blur-sm" : ""}`}>{c.company_name}</p>
                          <p className={`text-xs text-slate-400 ${data.limited ? "blur-sm" : ""}`}>{c.city} — {c.state}</p>
                        </div>
                      </div>
                      <div className={`text-right flex-shrink-0 ${data.limited ? "blur-sm" : ""}`}>
                        <p className="text-sm font-semibold text-[#0F172A]">{formatBRL(c.revenue_cents)}</p>
                        <p className="text-xs text-slate-400">{c.orders} pedido{c.orders !== 1 ? "s" : ""}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                {data.limited && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/80 backdrop-blur-[2px]">
                    <Lock size={24} className="text-slate-400" />
                    <p className="text-sm font-semibold text-[#0F172A]">Disponível no plano Operacional</p>
                    <button
                      onClick={() => router.push("/perfil#plano")}
                      className="rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8]"
                    >
                      Ver planos
                    </button>
                  </div>
                )}
              </div>

              {/* Top cidades */}
              <div className="relative rounded-3xl border border-[#DBEAFE] bg-white shadow-sm overflow-hidden">
                <div className="border-b border-[#DBEAFE] px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top 5 cidades</p>
                </div>
                <ul className="divide-y divide-[#DBEAFE]">
                  {(data.limited
                    ? [1,2,3,4,5].map((n) => ({ city: `Cidade ${n}`, state: "SP", orders: 0, revenue_cents: 0 }))
                    : data.top_cities
                  ).map((c, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#DBEAFE] text-xs font-bold text-[#1D4ED8]">
                          {i + 1}
                        </span>
                        <div>
                          <p className={`text-sm font-medium text-[#0F172A] ${data.limited ? "blur-sm select-none" : ""}`}>{c.city}</p>
                          <p className={`text-xs text-slate-400 ${data.limited ? "blur-sm select-none" : ""}`}>{c.state}</p>
                        </div>
                      </div>
                      <div className={`text-right ${data.limited ? "blur-sm select-none" : ""}`}>
                        <p className="text-sm font-semibold text-[#0F172A]">{c.orders} pedido{c.orders !== 1 ? "s" : ""}</p>
                        <p className="text-xs text-slate-400">{formatBRL(c.revenue_cents)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                {data.limited && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/80 backdrop-blur-[2px]">
                    <Lock size={24} className="text-slate-400" />
                    <p className="text-sm font-semibold text-[#0F172A]">Disponível no plano Operacional</p>
                    <button
                      onClick={() => router.push("/perfil#plano")}
                      className="rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8]"
                    >
                      Ver planos
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
