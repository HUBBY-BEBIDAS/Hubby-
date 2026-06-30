"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";
import { Inbox } from "lucide-react";
import Link from "next/link";

interface MonthlyPoint {
  monthKey: string;
  monthLabel: string;
  spent: number;
  saved: number;
  order_count: number;
}

interface TopProductPoint {
  name: string;
  brand: string;
  saved_cents: number;
}

interface DashboardData {
  total_spent_cents: number;
  total_saved_cents: number;
  avg_savings_pct: number;
  order_count: number;
  monthly_data: MonthlyPoint[];
  top_products: TopProductPoint[];
}

function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function SavingsChart({ monthly }: { monthly: MonthlyPoint[] }) {
  const maxVal = Math.max(...monthly.map((r) => r.saved), 1);
  const barW = Math.min(48, Math.floor(520 / Math.max(monthly.length, 1)) - 8);

  return (
    <div className="overflow-x-auto">
      <svg width={Math.max(monthly.length * (barW + 8), 300)} height={140} className="block mx-auto">
        {monthly.map((r, i) => {
          const pct = r.saved / maxVal;
          const barH = Math.max(4, Math.round(pct * 100));
          const x = i * (barW + 8);
          const y = 100 - barH;
          return (
            <g key={r.monthKey}>
              <rect x={x} y={y} width={barW} height={barH} rx={4} fill="#22C55E" opacity={0.8} />
              <title>{r.monthLabel}: {formatBRL(r.saved)}</title>
              <text x={x + barW / 2} y={120} textAnchor="middle" fontSize={9} fill="#94a3b8">
                {r.monthLabel}
              </text>
              {r.saved > 0 && (
                <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize={8} fill="#22C55E" fontWeight="700">
                  {formatBRL(r.saved).replace("R$ ", "R$")}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function ClientDashboard() {
  const token = useApiToken();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    apiFetch("/api/clients/dashboard", { method: "GET", token })
      .then(async (res) => {
        if (res.ok) {
          const json = await res.json();
          setData(json);
        } else {
          const errText = await res.text();
          setError(`Erro ${res.status}: ${errText || res.statusText}`);
        }
      })
      .catch((err) => {
        console.error(err);
        setError(`Erro de conexão: ${err.message || err}`);
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#22C55E] border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center shadow-sm">
        <p className="text-base font-semibold text-red-800">Falha ao carregar dados do painel</p>
        <p className="text-xs text-red-600 mt-1 font-mono">{error}</p>
      </div>
    );
  }

  if (!data || data.order_count === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
        <div className="mx-auto mb-3 text-slate-300 flex justify-center">
          <Inbox size={32} />
        </div>
        <p className="mb-1 text-base font-semibold text-[#0F172A]">Nenhum dado de economia disponível</p>
        <p className="text-sm font-medium text-slate-500">
          Faça cotações e envie pedidos para acompanhar sua economia na plataforma.
        </p>
        <div className="mt-5">
          <Link href="/cotacao">
            <Button size="sm">Fazer cotação</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#0F172A]">Painel do Comprador</h1>
        <p className="mt-1 text-sm font-medium text-slate-500">Acompanhe sua economia acumulada utilizando o Hubby</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#DBEAFE] bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Economizado</p>
          <p className="mt-1 font-display font-extrabold text-[32px] leading-none tracking-tight text-[#22C55E]">
            {formatBRL(data.total_saved_cents)}
          </p>
          <p className="mt-2 text-xs text-slate-400">Em relação ao preço médio de mercado</p>
        </div>

        <div className="rounded-2xl border border-[#DBEAFE] bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Eficiência de Compra</p>
          <p className="mt-1 font-display font-extrabold text-[32px] leading-none tracking-tight text-[#0F172A]">
            {data.avg_savings_pct}%
          </p>
          <p className="mt-2 text-xs text-slate-400">Economia média em cada item comprado</p>
        </div>

        <div className="rounded-2xl border border-[#DBEAFE] bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Pedidos Enviados</p>
          <p className="mt-1 font-display font-extrabold text-[32px] leading-none tracking-tight text-[#0F172A]">
            {data.order_count}
          </p>
          <p className="mt-2 text-xs text-slate-400">Pedidos com registro de economia</p>
        </div>
      </div>

      {/* Savings Chart */}
      <div className="rounded-2xl border border-[#DBEAFE] bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-display font-bold text-[#0F172A]">Economia Mensal (últimos 6 meses)</h3>
        <SavingsChart monthly={data.monthly_data} />
      </div>

      {/* Top Savings Products */}
      <div className="rounded-2xl border border-[#DBEAFE] bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-display font-bold text-[#0F172A]">Produtos com maior economia acumulada</h3>
        <div className="space-y-4">
          {data.top_products.map((p, idx) => (
            <div key={`${p.brand}|${p.name}`} className="flex items-center gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F5F7FB] text-xs font-bold text-slate-500">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#0F172A] truncate">{p.name}</p>
                <p className="text-xs text-slate-400">{p.brand}</p>
              </div>
              <span className="text-sm font-semibold text-[#22C55E] font-mono">
                {formatBRL(p.saved_cents)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
