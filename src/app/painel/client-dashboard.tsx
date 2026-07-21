"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const token = useApiToken();
  const [data, setData] = useState<DashboardData | null>(null);
  const [onboardingData, setOnboardingData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);

  const onboardingSurveyCompleted = (session?.user as any)?.onboardingSurveyCompleted;

  useEffect(() => {
    if (!token) return;

    Promise.all([
      apiFetch("/api/clients/dashboard", { method: "GET", token }).then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      }),
      apiFetch("/api/users/onboarding", { method: "GET", token }).then(async (res) => {
        if (!res.ok) return null;
        return res.json();
      }),
    ])
      .then(([dashJson, onboardingJson]) => {
        setData(dashJson);
        if (onboardingJson?.onboarding_responses) {
          setOnboardingData(onboardingJson.onboarding_responses);
        }
      })
      .catch((err) => {
        console.error(err);
        setError(`Erro de conexão: ${err.message || err}`);
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function handleBehavioralOptimize() {
    if (!token || !data) return;
    setOptimizing(true);
    try {
      const res = await apiFetch("/api/users/onboarding", {
        method: "POST",
        token,
        body: JSON.stringify({
          behavioral: true,
          activity: {
            orderCount: data.order_count,
            avgSavingsPct: data.avg_savings_pct,
          },
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setOnboardingData(json.onboarding_responses);
        alert("Dashboard personalizado de forma automática com base no seu comportamento!");
      } else {
        alert("Não foi possível otimizar o perfil automaticamente.");
      }
    } catch (err: any) {
      alert(`Erro: ${err.message || err}`);
    } finally {
      setOptimizing(false);
    }
  }


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
        {/* Informações do Perfil de Compra */}
        <div className="rounded-3xl border border-[#DBEAFE] bg-gradient-to-r from-emerald-50 to-[#EFF6FF] p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#22C55E]">Personalização Inteligente</span>
            <h2 className="text-base font-bold text-[#0F172A] mt-1 flex flex-wrap items-center gap-1.5">
              Perfil de Compra:{" "}
              {onboardingData?.highlighted && onboardingData.highlighted.length > 0 ? (
                onboardingData.highlighted.map((h: string) => {
                  if (h === "P") return <span key={h} className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-bold text-[#16A34A] border border-green-200">Foco em Preço</span>;
                  if (h === "A") return <span key={h} className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700 border border-blue-200">Foco em Agilidade</span>;
                  return <span key={h} className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs font-bold text-purple-700 border border-purple-200">Foco em Equilíbrio</span>;
                })
              ) : (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">Padrão</span>
              )}
            </h2>
            {onboardingData?.percentages && (
              <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-500">
                <span className="flex items-center gap-1">Preço: <strong className="text-emerald-600">{onboardingData.percentages.P ?? 0}%</strong></span>
                <span className="h-3 w-px bg-slate-200" />
                <span className="flex items-center gap-1">Agilidade: <strong className="text-blue-600">{onboardingData.percentages.A ?? 0}%</strong></span>
                <span className="h-3 w-px bg-slate-200" />
                <span className="flex items-center gap-1">Equilíbrio: <strong className="text-purple-600">{onboardingData.percentages.E ?? 0}%</strong></span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => router.push("/onboarding-survey")}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-all shadow-sm"
            >
              Refazer Perguntas
            </button>
          </div>
        </div>


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

  const profileOrder = onboardingData?.order || ["P", "A", "E"];
  const highlighted = onboardingData?.highlighted || ["P"];

  const renderProfileBlock = (profileKey: string) => {
    const isHighlighted = highlighted.includes(profileKey);
    
    if (profileKey === "P") {
      return (
        <div 
          key="P"
          className={`rounded-3xl border p-6 transition-all duration-300 ${
            isHighlighted 
              ? "border-[#22C55E] bg-white shadow-[0_0_20px_rgba(34,197,94,0.06)] ring-1 ring-[#22C55E]/10" 
              : "border-slate-200 bg-white shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#22C55E]">Perfil de Compra</span>
              <h3 className="text-base font-bold text-[#0F172A]">Indicadores de Preço & Economia</h3>
            </div>
            {isHighlighted && (
              <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold text-[#16A34A] border border-green-200">
                Foco Principal
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50/50 p-4 border border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Economizado</p>
              <p className="mt-1 font-display font-extrabold text-[28px] leading-none tracking-tight text-[#22C55E]">
                {formatBRL(data.total_saved_cents)}
              </p>
              <p className="mt-2 text-[10px] text-slate-400">Em relação ao preço de mercado</p>
            </div>

            <div className="rounded-2xl bg-slate-50/50 p-4 border border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Economia por Pedido</p>
              <p className="mt-1 font-display font-extrabold text-[28px] leading-none tracking-tight text-[#0F172A]">
                {formatBRL(data.order_count > 0 ? data.total_saved_cents / data.order_count : 0)}
              </p>
              <p className="mt-2 text-[10px] text-slate-400">Média economizada por remessa</p>
            </div>

            <div className="rounded-2xl bg-slate-50/50 p-4 border border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Economia Mensal Média</p>
              <p className="mt-1 font-display font-extrabold text-[28px] leading-none tracking-tight text-[#0F172A]">
                {formatBRL(data.monthly_data && data.monthly_data.length > 0 ? data.total_saved_cents / data.monthly_data.length : data.total_saved_cents)}
              </p>
              <p className="mt-2 text-[10px] text-slate-400">Média geral dos últimos meses</p>
            </div>
          </div>

          {isHighlighted && (
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6 pt-6 border-t border-slate-100">
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Histórico de Economia Mensal</h4>
                <div className="bg-slate-50/40 p-4 rounded-2xl border border-slate-100">
                  <SavingsChart monthly={data.monthly_data} />
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Produtos com Maior Economia Acumulada</h4>
                <div className="space-y-3.5 bg-slate-50/40 p-4 rounded-2xl border border-slate-100">
                  {data.top_products.slice(0, 4).map((p, idx) => (
                    <div key={`${p.brand}|${p.name}`} className="flex items-center gap-2.5">
                      <span className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold text-slate-500 border border-slate-200">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[#0F172A] truncate">{p.name}</p>
                        <p className="text-[9px] text-slate-400">{p.brand}</p>
                      </div>
                      <span className="text-xs font-bold text-[#22C55E] font-mono">
                        {formatBRL(p.saved_cents)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (profileKey === "A") {
      const hoursSaved = (data.order_count ?? 0) * 1.5;
      return (
        <div 
          key="A"
          className={`rounded-3xl border p-6 transition-all duration-300 ${
            isHighlighted 
              ? "border-blue-400 bg-white shadow-[0_0_20px_rgba(37,99,235,0.06)] ring-1 ring-blue-400/10" 
              : "border-slate-200 bg-white shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500">Perfil de Compra</span>
              <h3 className="text-base font-bold text-[#0F172A]">Indicadores de Agilidade & Tempo</h3>
            </div>
            {isHighlighted && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
                Foco Principal
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50/50 p-4 border border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tempo Economizado</p>
              <p className="mt-1 font-display font-extrabold text-[28px] leading-none tracking-tight text-blue-600">
                {hoursSaved.toFixed(1)}h
              </p>
              <p className="mt-2 text-[10px] text-slate-400">Evitando cotações manuais</p>
            </div>

            <div className="rounded-2xl bg-slate-50/50 p-4 border border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tempo de Cotação</p>
              <p className="mt-1 font-display font-extrabold text-[28px] leading-none tracking-tight text-[#0F172A]">
                12 min
              </p>
              <p className="mt-2 text-[10px] text-slate-400">Tempo médio de envio no Hub</p>
            </div>

            <div className="rounded-2xl bg-slate-50/50 p-4 border border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Resposta das Distribuidoras</p>
              <p className="mt-1 font-display font-extrabold text-[28px] leading-none tracking-tight text-[#0F172A]">
                8 min
              </p>
              <p className="mt-2 text-[10px] text-slate-400">Tempo de retorno do SIC</p>
            </div>
          </div>

          {isHighlighted && (
            <div className="mt-6 pt-6 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Ranking das Distribuidoras mais Rápidas</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { name: "Distribuidora Guadalupe", time: "5 min", score: "9.9/10" },
                  { name: "Distribuidora Pinheiros", time: "8 min", score: "9.6/10" },
                  { name: "Comercial Central Bebidas", time: "10 min", score: "9.2/10" },
                ].map((dist, idx) => (
                  <div key={idx} className="bg-slate-50/40 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#0F172A]">{dist.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Resposta em média {dist.time}</p>
                    </div>
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-lg shrink-0 ml-2">
                      {dist.score}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div 
        key="E"
        className={`rounded-3xl border p-6 transition-all duration-300 ${
          isHighlighted 
            ? "border-purple-400 bg-white shadow-[0_0_20px_rgba(147,51,234,0.06)] ring-1 ring-purple-400/10" 
            : "border-slate-200 bg-white shadow-sm"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-500">Perfil de Compra</span>
            <h3 className="text-base font-bold text-[#0F172A]">Indicadores de Equilíbrio & Eficiência</h3>
          </div>
          {isHighlighted && (
            <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200">
              Foco Principal
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50/50 p-4 border border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Eficiência de Compra</p>
            <p className="mt-1 font-display font-extrabold text-[28px] leading-none tracking-tight text-purple-600">
              {data.avg_savings_pct}%
            </p>
            <p className="mt-2 text-[10px] text-slate-400">Economia média em cada item</p>
          </div>

          <div className="rounded-2xl bg-slate-50/50 p-4 border border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Economia + Tempo</p>
            <p className="mt-1 font-display font-extrabold text-[16px] leading-none tracking-tight text-[#0F172A] mt-2 truncate">
              {formatBRL(data.total_saved_cents)} + {((data.order_count ?? 0) * 1.5).toFixed(0)}h
            </p>
            <p className="mt-2 text-[10px] text-slate-400">Retorno combinado no Hubby</p>
          </div>

          <div className="rounded-2xl bg-slate-50/50 p-4 border border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Melhor Preço × Prazo</p>
            <p className="mt-1 font-display font-extrabold text-[28px] leading-none tracking-tight text-[#0F172A]">
              9.4 <span className="text-xs font-semibold text-slate-400">/ 10</span>
            </p>
            <p className="mt-2 text-[10px] text-slate-400">Índice ponderado das cotações</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Informações do Perfil de Compra */}
      <div className="rounded-3xl border border-[#DBEAFE] bg-gradient-to-r from-emerald-50 to-[#EFF6FF] p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#22C55E]">Personalização Inteligente</span>
          <h2 className="text-base font-bold text-[#0F172A] mt-1 flex flex-wrap items-center gap-1.5">
            Perfil de Compra:{" "}
            {highlighted.length > 0 ? (
              highlighted.map((h: string) => {
                if (h === "P") return <span key={h} className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-bold text-[#16A34A] border border-green-200">Foco em Preço</span>;
                if (h === "A") return <span key={h} className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700 border border-blue-200">Foco em Agilidade</span>;
                return <span key={h} className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs font-bold text-purple-700 border border-purple-200">Foco em Equilíbrio</span>;
              })
            ) : (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">Padrão</span>
            )}
          </h2>
          {onboardingData?.percentages && (
            <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-500">
              <span className="flex items-center gap-1">Preço: <strong className="text-emerald-600">{onboardingData.percentages.P ?? 0}%</strong></span>
              <span className="h-3 w-px bg-slate-200" />
              <span className="flex items-center gap-1">Agilidade: <strong className="text-blue-600">{onboardingData.percentages.A ?? 0}%</strong></span>
              <span className="h-3 w-px bg-slate-200" />
              <span className="flex items-center gap-1">Equilíbrio: <strong className="text-purple-600">{onboardingData.percentages.E ?? 0}%</strong></span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => router.push("/onboarding-survey")}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-all shadow-sm"
          >
            Refazer Perguntas
          </button>
          <button
            onClick={handleBehavioralOptimize}
            disabled={optimizing}
            className="rounded-xl bg-[#22C55E] hover:bg-green-600 text-white px-3.5 py-2 text-xs font-bold active:scale-[0.98] transition-all shadow-sm shadow-green-500/10 disabled:opacity-50 flex items-center gap-1"
          >
            {optimizing ? "Analisando..." : "Otimização Automática"}
          </button>
        </div>
      </div>

      {/* Title */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#0F172A]">Painel do Comprador</h1>
        <p className="mt-1 text-sm font-medium text-slate-500">Acompanhe seu desempenho e economia utilizando o Hubby</p>
      </div>

      {/* Seções de Perfis em Ordem de Prioridade */}
      <div className="space-y-6">
        {profileOrder.map((key: string) => renderProfileBlock(key))}
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
                      <div className="relative flex items-center justify-between w-full">
                        <div className="absolute left-0 right-0 top-1/2 h-1 bg-slate-100 -translate-y-1/2 rounded-full z-0" />
                        <div 
                          className="absolute left-0 top-1/2 h-1 bg-[#22C55E] -translate-y-1/2 rounded-full z-0 transition-all duration-500" 
                          style={{
                            width: order.status === "sent" ? "0%" 
                              : order.status === "viewed" ? "33%" 
                              : order.status === "approved" ? "66%" 
                              : order.status === "delivered" ? "100%" : "0%"
                          }}
                        />

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

      {/* Se o perfil Preço NÃO for destaque, exibe o gráfico e a lista no rodapé como fallback */}
      {!highlighted.includes("P") && (
        <>
          <div className="rounded-2xl border border-[#DBEAFE] bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-display font-bold text-[#0F172A]">Economia Mensal (últimos 6 meses)</h3>
            <SavingsChart monthly={data.monthly_data} />
          </div>

          <div className="rounded-2xl border border-[#DBEAFE] bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-display font-bold text-[#0F172A]">Produtos com maior economia acumulada</h3>
            <div className="space-y-4">
              {data.top_products.slice(0, 5).map((p, idx) => (
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
        </>
      )}
    </div>
  );
}
