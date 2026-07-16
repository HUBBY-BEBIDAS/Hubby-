"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
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

interface RecentOrder {
  id: string;
  group_id: string;
  total_cents: number;
  status: "sent" | "viewed" | "approved" | "rejected" | "delivered";
  sent_at: string;
  estimated_delivery_date: string | null;
  distributor_name: string;
}

interface DashboardData {
  total_spent_cents: number;
  total_saved_cents: number;
  avg_savings_pct: number;
  order_count: number;
  monthly_data: MonthlyPoint[];
  top_products: TopProductPoint[];
  recent_orders: RecentOrder[];
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
  const { data: session } = useSession();
  const token = useApiToken();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const onboardingSurveyCompleted = (session?.user as any)?.onboardingSurveyCompleted;

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
      <div className="space-y-6">
        {!onboardingSurveyCompleted && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0 mt-0.5">💡</span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-amber-900">Personalize sua experiência</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Responda a um rápido questionário para nos ajudar a encontrar melhores preços e recomendar os produtos certos para você.
                </p>
              </div>
            </div>
            <Link href="/onboarding-survey" className="shrink-0">
              <Button size="sm" className="bg-amber-500 hover:bg-amber-600 border-none text-white font-bold shadow-none">
                Responder agora →
              </Button>
            </Link>
          </div>
        )}

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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!onboardingSurveyCompleted && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0 mt-0.5">💡</span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-amber-900">Personalize sua experiência</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Responda a um rápido questionário para nos ajudar a encontrar melhores preços e recomendar os produtos certos para você.
              </p>
            </div>
          </div>
          <Link href="/onboarding-survey" className="shrink-0">
            <Button size="sm" className="bg-amber-500 hover:bg-amber-600 border-none text-white font-bold shadow-none">
              Responder agora →
            </Button>
          </Link>
        </div>
      )}

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

      {/* Acompanhamento de Pedidos Recentes */}
      {data.recent_orders && data.recent_orders.length > 0 && (
        <div className="rounded-2xl border border-[#DBEAFE] bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-display font-bold text-[#0F172A]">Acompanhamento de Pedidos Recentes</h3>
            <Link href="/historico" className="text-xs text-[#2563EB] hover:underline font-bold">
              Ver histórico completo →
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {data.recent_orders.map((order) => {
              const statusLabels = {
                sent: "Aguardando",
                viewed: "Em preparação",
                approved: "Em rota de entrega",
                rejected: "Recusado",
                delivered: "Entregue",
              };
              
              const statusColors = {
                sent: "yellow",
                viewed: "blue",
                approved: "indigo",
                rejected: "red",
                delivered: "green",
              } as const;

              const badgeColors = {
                yellow: "bg-amber-50 text-amber-800 border-amber-200",
                blue: "bg-blue-50 text-blue-800 border-blue-200",
                indigo: "bg-indigo-50 text-indigo-800 border-indigo-200",
                red: "bg-red-50 text-red-800 border-red-200",
                green: "bg-green-50 text-green-800 border-green-200",
              };

              const color = statusColors[order.status] || "gray";
              
              return (
                <div key={order.id} className="py-4 first:pt-0 last:pb-0 flex flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-[#0F172A]">{order.distributor_name}</p>
                      <p className="text-[11px] text-slate-400 font-medium">
                        Enviado em {new Date(order.sent_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-bold text-[#0F172A]">
                        {formatBRL(order.total_cents)}
                      </span>
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${badgeColors[color]}`}>
                        {statusLabels[order.status] || order.status}
                      </span>
                    </div>
                  </div>

                  {/* Stepper Progress Line */}
                  {order.status !== "rejected" ? (
                    <div className="mt-1 px-2 py-4">
                      {/* Visual Stepper dots and labels */}
                      <div className="relative flex items-center justify-between w-full">
                        {/* Background line */}
                        <div className="absolute left-0 right-0 top-1/2 h-1 bg-slate-100 -translate-y-1/2 rounded-full z-0" />
                        
                        {/* Progress line */}
                        <div 
                          className="absolute left-0 top-1/2 h-1 bg-[#22C55E] -translate-y-1/2 rounded-full z-0 transition-all duration-500" 
                          style={{
                            width: order.status === "sent" ? "0%" 
                              : order.status === "viewed" ? "33%" 
                              : order.status === "approved" ? "66%" 
                              : order.status === "delivered" ? "100%" : "0%"
                          }}
                        />

                        {/* Step Dots */}
                        {[
                          { key: "sent", label: "Enviado", active: true },
                          { key: "viewed", label: "Preparo", active: ["viewed", "approved", "delivered"].includes(order.status) },
                          { key: "approved", label: "Em rota", active: ["approved", "delivered"].includes(order.status) },
                          { key: "delivered", label: "Entregue", active: ["delivered"].includes(order.status) },
                        ].map((step, idx) => (
                          <div key={idx} className="relative z-10 flex flex-col items-center">
                            <div 
                              className={`h-5 w-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${
                                step.active 
                                  ? "bg-[#22C55E] border-[#22C55E] text-white shadow-sm" 
                                  : "bg-white border-slate-200 text-slate-400"
                              }`}
                            >
                              {step.active ? "✓" : idx + 1}
                            </div>
                            <span 
                              className={`text-[10px] mt-1.5 font-bold transition-colors ${
                                step.active ? "text-[#0F172A]" : "text-slate-400"
                              }`}
                            >
                              {step.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-red-50/50 border border-red-100 p-2.5 text-xs font-semibold text-red-700">
                      Este pedido foi recusado pela distribuidora. Entre em contato pelo chat para negociar.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

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
