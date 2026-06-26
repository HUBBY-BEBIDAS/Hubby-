"use client";

import { useEffect, useState } from "react";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatMonth(key: string) {
  const [y, m] = key.split("-");
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(new Date(Number(y), Number(m) - 1));
}

type GrowthPoint = { month: string; count: number };
type MrrPoint    = { month: string; mrr_cents: number };

type Metrics = {
  period_month: string;
  clients:      { total: number };
  distributors: { total: number; by_status: Record<string, number>; pending_approval: number };
  quotations:   { today: number; week: number; month: number };
  orders:       { this_month: number; last_month: number; mom_change_percent: number | null };
  mrr_cents:    number;
  gmv_month_cents: number;
  distributor_growth: GrowthPoint[];
  client_growth:      GrowthPoint[];
  mrr_by_month:       MrrPoint[];
};

// ─── Mini gráfico de linha SVG ────────────────────────────────────────────────

function LineChart({ data, valueKey, color = "#22C55E" }: {
  data: (GrowthPoint | MrrPoint)[];
  valueKey: "count" | "mrr_cents";
  color?: string;
}) {
  const W = 260; const H = 64; const PAD = 8;
  const values = data.map((d) => (valueKey === "count" ? (d as GrowthPoint).count : (d as MrrPoint).mrr_cents));
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => {
    const x = PAD + (i / Math.max(values.length - 1, 1)) * (W - PAD * 2);
    const y = H - PAD - (v / max) * (H - PAD * 2);
    return `${x},${y}`;
  });
  const areaPath = `M${pts.join("L")}L${W - PAD},${H - PAD}L${PAD},${H - PAD}Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`lg-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#lg-${color})`} />
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      {values.map((v, i) => {
        const [x, y] = pts[i].split(",").map(Number);
        return <circle key={i} cx={x} cy={y} r="3" fill={color} />;
      })}
    </svg>
  );
}

// ─── Gráfico de barras SVG ────────────────────────────────────────────────────

function BarChart({ data }: { data: MrrPoint[] }) {
  const W = 260; const H = 72; const PAD = 8;
  const max = Math.max(...data.map((d) => d.mrr_cents), 1);
  const barW = (W - PAD * 2) / data.length - 4;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {data.map((d, i) => {
        const barH = Math.max(4, ((d.mrr_cents / max) * (H - PAD * 2)));
        const x = PAD + i * ((W - PAD * 2) / data.length) + 2;
        const y = H - PAD - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx={3} fill="#22C55E" opacity={0.85} />
            <title>{formatMonth(d.month)}: {formatBRL(d.mrr_cents)}</title>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Card de métrica ──────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, accent = false }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${accent ? "border-[#22C55E]/30 bg-[#F0FDF4]" : "border-slate-200 bg-white"}`}>
      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`mt-1 text-3xl font-extrabold tracking-tight ${accent ? "text-[#22C55E]" : "text-[#0F172A]"}`}>{value}</p>
      {sub && <p className="mt-1 text-xs font-medium text-slate-500">{sub}</p>}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AdminDashboard() {
  const token = useApiToken();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    apiFetch("/api/admin/metrics", { method: "GET", token })
      .then(async (r) => { if (r.ok) setMetrics(await r.json()); })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      </main>
    );
  }

  if (!metrics) {
    return <main className="mx-auto max-w-7xl px-4 py-10"><p className="text-sm text-slate-500">Erro ao carregar métricas.</p></main>;
  }

  const { distributors, clients, quotations, mrr_cents, gmv_month_cents } = metrics;
  const activeCount  = distributors.by_status["active"]  ?? 0;
  const trialCount   = distributors.by_status["trial"]   ?? 0;
  const cancelCount  = distributors.by_status["cancelled"] ?? 0;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#0F172A]">Dashboard</h1>
        <p className="mt-1 text-sm font-medium text-slate-500">Visão geral da plataforma em tempo real</p>
      </div>

      {/* Métrica cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard label="MRR" value={formatBRL(mrr_cents)} sub="mensalidades ativas" accent />
        <MetricCard label="GMV do mês" value={formatBRL(gmv_month_cents)} sub="volume de cotações" />
        <MetricCard label="Distribuidoras" value={String(distributors.total)}
          sub={`${activeCount} ativas · ${trialCount} trial · ${cancelCount} canceladas`} />
        <MetricCard label="Compradores" value={String(clients.total)} sub="total cadastrado" />
        <MetricCard label="Cotações hoje" value={String(quotations.today)}
          sub={`${quotations.week} na semana · ${quotations.month} no mês`} />
      </div>

      {distributors.pending_approval > 0 && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 font-bold text-sm">
            {distributors.pending_approval}
          </span>
          <div>
            <p className="text-sm font-bold text-amber-800">
              {distributors.pending_approval} distribuidora{distributors.pending_approval !== 1 ? "s" : ""} aguardando aprovação
            </p>
            <a href="/admin/aprovacoes" className="text-xs font-semibold text-amber-700 underline">
              Revisar agora →
            </a>
          </div>
        </div>
      )}

      {/* Gráficos */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">Novas distribuidoras (6 meses)</p>
          <LineChart data={metrics.distributor_growth} valueKey="count" color="#22C55E" />
          <div className="mt-2 flex justify-between">
            {metrics.distributor_growth.map((d) => (
              <span key={d.month} className="text-[9px] font-medium text-slate-400">{formatMonth(d.month)}</span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">Novos compradores (6 meses)</p>
          <LineChart data={metrics.client_growth} valueKey="count" color="#3B82F6" />
          <div className="mt-2 flex justify-between">
            {metrics.client_growth.map((d) => (
              <span key={d.month} className="text-[9px] font-medium text-slate-400">{formatMonth(d.month)}</span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">MRR por mês</p>
          <BarChart data={metrics.mrr_by_month} />
          <div className="mt-2 flex justify-between">
            {metrics.mrr_by_month.map((d) => (
              <span key={d.month} className="text-[9px] font-medium text-slate-400">{formatMonth(d.month)}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Status breakdown */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Object.entries(distributors.by_status).map(([status, count]) => (
          <div key={status} className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
            <p className="text-2xl font-extrabold text-[#0F172A]">{count}</p>
            <p className="mt-0.5 text-[11px] font-semibold capitalize text-slate-500">{status}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
