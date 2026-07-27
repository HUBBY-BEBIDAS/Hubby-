"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Navbar } from "@/components/Navbar";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";
import { ClientDashboard } from "./client-dashboard";
import {
  Building2, CheckCircle, AlertTriangle, XCircle, Check, X, Phone, Eye, MessageSquare,
} from "lucide-react";

type PendingFeedback = {
  id: string;
  notified_at: string | null;
  order: {
    id: string;
    total_cents: number;
    sent_at: string;
    client: {
      company_name: string;
      delivery_city: string;
      delivery_state: string;
      hubby_score: number;
    };
  };
};

type ProblemForm = {
  problem_type: "late_payment" | "no_payment" | "returned_goods" | "other";
  notes: string;
};

type DashboardData = {
  today: string;
  plan: string;
  plan_status: string;
  new_orders_today: number;
  clients_today: number;
  approved_orders_today: number;
  pending_orders: number;
  last_price_update: string | null;
  active_products: number;
  inactive_products: number;
  total_products: number;
};

interface OrderItemSnapshot {
  product_name: string;
  brand: string;
  category?: string;
  packaging?: string;
  quantity: number;
  unit_price_cents: number;
  total_price_cents?: number;
  prepared?: boolean;
}

type Period = "7d" | "30d" | "90d" | "12m";

type OrderItem = {
  id: string;
  group_id: string;
  status: "sent" | "viewed" | "approved" | "rejected" | "delivered";
  total_cents: number;
  items_snapshot: OrderItemSnapshot[] | null;
  sent_at: string;
  client: {
    id: string;
    company_name: string;
    cnpj: string;
    establishment_type: string;
    responsible_name: string | null;
    delivery_city: string;
    delivery_state: string;
    delivery_address_full: string | null;
    whatsapp: string;
  };
};


const STATUS_LABEL: Record<string, string> = {
  sent: "Aguardando",
  viewed: "Em preparo",
  approved: "Em rota de entrega",
  rejected: "Recusado",
  delivered: "Entregue",
};

const STATUS_BADGE: Record<string, "yellow" | "blue" | "green" | "red" | "gray" | "indigo"> = {
  sent: "yellow",
  viewed: "blue",
  approved: "indigo",
  rejected: "red",
  delivered: "green",
};

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDateTime(iso: string | null) {
  if (!iso) return "–";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

type ReportData = {
  limited: boolean;
  period: string;
  summary: {
    total_orders: number;
    approved_orders: number;
    rejected_orders: number;
    pending_orders: number;
    revenue_cents: number;
    avg_ticket_cents: number;
    active_clients_count: number;
  };
  by_day: Array<{
    date: string;
    total: number;
    approved: number;
    revenue_cents: number;
  }>;
  feedback: {
    ok: number;
    problem: number;
    auto_ok: number;
    pending: number;
  };
};

function SalesChart({ data, period }: { data: ReportData["by_day"]; period: Period }) {
  const entries = data.map(d => ({
    label: period === "12m" ? formatMonthLabel(d.date) : formatDateLabel(d.date),
    value: d.revenue_cents ? d.revenue_cents / 100 : 0, // value in BRL
    rawDate: d.date
  }));

  const values = entries.map(e => e.value);
  const maxVal = Math.max(...values, 100); // minimum max of R$100 to scale nicely

  // SVG dimensions
  const width = 600;
  const height = 240;
  const paddingLeft = 60;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Generate points
  const points = entries.map((e, idx) => {
    const x = paddingLeft + (idx / Math.max(entries.length - 1, 1)) * chartWidth;
    const y = paddingTop + chartHeight - (e.value / maxVal) * chartHeight;
    return { x, y, label: e.label, value: e.value, rawDate: e.rawDate };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(" ");
  const areaPath = points.length > 0
    ? `${linePath} L${points[points.length - 1].x},${paddingTop + chartHeight} L${points[0].x},${paddingTop + chartHeight} Z`
    : "";

  // Hover state
  const [hoveredPoint, setHoveredPoint] = useState<typeof points[0] | null>(null);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (points.length === 0) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * width;

    // Find closest point by X coordinate
    let closest = points[0];
    let minDist = Math.abs(points[0].x - mouseX);
    for (let i = 1; i < points.length; i++) {
      const dist = Math.abs(points[i].x - mouseX);
      if (dist < minDist) {
        minDist = dist;
        closest = points[i];
      }
    }
    setHoveredPoint(closest);
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  // Helper formats
  function formatDateLabel(dateStr: string) {
    const parts = dateStr.split("-");
    if (parts.length < 3) return dateStr;
    return `${parts[2]}/${parts[1]}`;
  }

  function formatMonthLabel(dateStr: string) {
    const parts = dateStr.split("-"); // YYYY-MM
    if (parts.length < 2) return dateStr;
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const mIdx = parseInt(parts[1], 10) - 1;
    return `${months[mIdx]}/${parts[0].slice(2)}`;
  }

  // Y-axis gridlines & ticks
  const yTicks = 4;
  const yGridLines = Array.from({ length: yTicks + 1 }).map((_, idx) => {
    const val = (maxVal / yTicks) * idx;
    const y = paddingTop + chartHeight - (val / maxVal) * chartHeight;
    return { y, val };
  });

  // X-axis ticks (limit labels to avoid overlapping)
  const maxLabels = period === "7d" ? 7 : period === "30d" ? 10 : period === "90d" ? 9 : 12;
  const labelStep = Math.max(Math.ceil(entries.length / maxLabels), 1);
  const xTicks = points.filter((_, idx) => idx % labelStep === 0);

  return (
    <div className="rounded-3xl border border-[#DBEAFE] bg-white p-6 shadow-sm relative">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Faturamento por dia/mês
          </p>
          {hoveredPoint ? (
            <p className="text-lg font-bold text-[#0F172A] mt-0.5">
              {formatBRL(Math.round(hoveredPoint.value * 100))}
              <span className="text-xs text-slate-400 font-normal ml-1.5">em {hoveredPoint.label}</span>
            </p>
          ) : (
            <p className="text-sm font-bold text-slate-400 mt-0.5">
              Passe o mouse no gráfico para ver valores
            </p>
          )}
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22C55E" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#22C55E" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Gridlines & Y-axis labels */}
          {yGridLines.map((g, idx) => (
            <g key={idx}>
              <line
                x1={paddingLeft}
                y1={g.y}
                x2={width - paddingRight}
                y2={g.y}
                stroke="#E2E8F0"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={paddingLeft - 10}
                y={g.y + 4}
                textAnchor="end"
                className="font-mono text-[9px] fill-slate-400 font-medium"
              >
                {new Intl.NumberFormat("pt-BR", {
                  notation: "compact",
                  compactDisplay: "short",
                  style: "currency",
                  currency: "BRL"
                }).format(g.val)}
              </text>
            </g>
          ))}

          {/* Area Path */}
          {areaPath && (
            <path d={areaPath} fill="url(#chartGradient)" />
          )}

          {/* Line Path */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="#22C55E"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Points */}
          {points.length <= 31 && points.map((p, idx) => (
            <circle
              key={idx}
              cx={p.x}
              cy={p.y}
              r={hoveredPoint?.rawDate === p.rawDate ? 5.5 : 3.5}
              fill={hoveredPoint?.rawDate === p.rawDate ? "#22C55E" : "#FFFFFF"}
              stroke="#22C55E"
              strokeWidth={hoveredPoint?.rawDate === p.rawDate ? 3 : 2}
              className="transition-all duration-150 cursor-pointer"
            />
          ))}

          {/* Hover indicator line & dot */}
          {hoveredPoint && (
            <g>
              <line
                x1={hoveredPoint.x}
                y1={paddingTop}
                x2={hoveredPoint.x}
                y2={paddingTop + chartHeight}
                stroke="#22C55E"
                strokeWidth={1.5}
                strokeDasharray="2 2"
                opacity={0.6}
              />
              {points.length > 31 && (
                <circle
                  cx={hoveredPoint.x}
                  cy={hoveredPoint.y}
                  r={5.5}
                  fill="#22C55E"
                  stroke="#FFFFFF"
                  strokeWidth={2}
                />
              )}
            </g>
          )}

          {/* X-axis line */}
          <line
            x1={paddingLeft}
            y1={paddingTop + chartHeight}
            x2={width - paddingRight}
            y2={paddingTop + chartHeight}
            stroke="#CBD5E1"
            strokeWidth={1}
          />

          {/* X-axis labels */}
          {xTicks.map((p, idx) => (
            <text
              key={idx}
              x={p.x}
              y={paddingTop + chartHeight + 18}
              textAnchor="middle"
              className="text-[9px] fill-slate-400 font-semibold"
            >
              {p.label}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, accent }: {
  label: string; value: string | number; sub?: string; accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${accent ? "border-[#DBEAFE] bg-[#EFF6FF]" : "border-[#DBEAFE] bg-white"}`}>
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className={`mt-1 font-mono text-[32px] font-medium leading-none tracking-tight ${accent ? "text-[#2563EB]" : "text-[#0F172A]"}`}>{value}</p>
      {sub && <p className="mt-1 font-mono text-[11px] font-medium text-slate-400">{sub}</p>}
    </div>
  );
}

export default function PainelPage() {
  const { data: session } = useSession({ required: true });
  const router = useRouter();
  const token = useApiToken();

  const role = (session?.user as any)?.role;
  const onboardingSurveyCompleted = (session?.user as any)?.onboardingSurveyCompleted;

  const [dash, setDash] = useState<DashboardData | null>(null);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [feedbacks, setFeedbacks] = useState<PendingFeedback[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingData, setOnboardingData] = useState<any>(null);
  const [optimizing, setOptimizing] = useState(false);

  async function handleBehavioralOptimize() {
    if (!token || !dash) return;
    setOptimizing(true);
    try {
      const res = await apiFetch("/api/users/onboarding", {
        method: "POST",
        token,
        body: JSON.stringify({
          behavioral: true,
          activity: {
            orderCount: orders.length,
            activeProductsCount: dash.active_products,
          },
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setOnboardingData(json.onboarding_responses);
        alert("Perfil de distribuidora otimizado com sucesso!");
      } else {
        alert("Não foi possível otimizar o perfil automaticamente.");
      }
    } catch (err: any) {
      alert(`Erro: ${err.message || err}`);
    } finally {
      setOptimizing(false);
    }
  }
  const [problemModal, setProblemModal] = useState<string | null>(null); // orderId
  const [problemForm, setProblemForm] = useState<ProblemForm>({
    problem_type: "late_payment",
    notes: "",
  });
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [orderFilterTab, setOrderFilterTab] = useState<"sent" | "viewed" | "approved" | "completed">("sent");
  const [prepOrderId, setPrepOrderId] = useState<string | null>(null);
  const [chattingClientId, setChattingClientId] = useState<string | null>(null);

  async function handleToggleItemPrepared(orderId: string, idx: number) {
    if (!token) return;
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    const snapshot = [...(order.items_snapshot || [])];
    snapshot[idx] = { ...snapshot[idx], prepared: !snapshot[idx].prepared };

    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, items_snapshot: snapshot } : o))
    );

    try {
      await apiFetch(`/api/distributor/orders/${orderId}/items`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ items_snapshot: snapshot }),
      });
    } catch (err) {
      console.error("Erro ao salvar preparo:", err);
    }
  }

  async function handleStartChat(clientId: string) {
    if (!token || chattingClientId) return;
    setChattingClientId(clientId);
    try {
      const res = await apiFetch("/api/chat/rooms", {
        method: "POST",
        token,
        body: JSON.stringify({ client_id: clientId }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/chat?roomId=${data.room.id}`);
      } else {
        alert("Erro ao iniciar conversa no chat.");
      }
    } catch {
      alert("Erro ao conectar com o servidor.");
    } finally {
      setChattingClientId(null);
    }
  }

  // ── Deliver feedback modal (ao entregar) ──────────────────────────────────
  const [deliverModal, setDeliverModal] = useState<{
    orderId: string;
    clientName: string;
    totalCents: number;
  } | null>(null);
  const [deliverProblemType, setDeliverProblemType] = useState<"late_payment" | "no_payment" | null>(null);
  const [deliverNotes, setDeliverNotes] = useState("");
  const [submittingDeliver, setSubmittingDeliver] = useState(false);
  const [viewOrderId, setViewOrderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"visao-geral" | "desempenho">("visao-geral");
  const [salesPeriod, setSalesPeriod] = useState<Period>("30d");
  const [reportsData, setReportsData] = useState<ReportData | null>(null);
  const [loadingReports, setLoadingReports] = useState(false);

  const selectedOrder = orders.find((o) => o.id === viewOrderId);

  useEffect(() => {
    if (!token || activeTab !== "desempenho") return;

    setLoadingReports(true);
    apiFetch(`/api/distributor/reports?period=${salesPeriod}`, { method: "GET", token })
      .then(async (res) => {
        if (res.ok) {
          const d = await res.json() as ReportData;
          setReportsData(d);
        }
      })
      .catch((err) => {
        console.error("Erro ao carregar relatórios de desempenho:", err);
      })
      .finally(() => {
        setViewOrderId(null); // Clean modal state if any
        setLoadingReports(false);
      });
  }, [token, activeTab, salesPeriod]);

  useEffect(() => {
    if (!token) return;

    // Verifica onboarding antes de carregar o painel
    apiFetch("/api/distributor/onboarding", { method: "GET", token })
      .then(async (r) => {
        if (!r.ok) return;
        const ob = await r.json() as { onboarding_completed: boolean };
        if (!ob.onboarding_completed) {
          router.replace("/onboarding");
          return;
        }
        // Onboarding concluído — carrega o painel normalmente
        Promise.all([
          apiFetch("/api/distributor/dashboard", { method: "GET", token }).then((r) => r.json()),
          apiFetch("/api/distributor/orders?limit=15", { method: "GET", token }).then((r) => r.json()),
          apiFetch("/api/users/onboarding", { method: "GET", token }).then((r) => r.json()).catch(() => null),
        ])
          .then(([dashData, ordersData, onboardingJson]) => {
            setDash(dashData as DashboardData);
            setOrders((ordersData as { data: OrderItem[] }).data ?? []);
            if (onboardingJson?.onboarding_responses) {
              setOnboardingData(onboardingJson.onboarding_responses);
            }
          })
          .finally(() => setLoading(false));

        // Carrega feedbacks de pagamento separadamente para não bloquear o painel
        apiFetch("/api/distributor/payment-feedback?status=pending&limit=20", { method: "GET", token })
          .then(async (r) => {
            if (r.ok) {
              const d = await r.json() as { data: PendingFeedback[] };
              setFeedbacks(d.data ?? []);
            }
          })
          .catch(() => { /* silencia — feature não crítica */ });
      })
      .catch(() => setLoading(false));
  }, [token, router]);

  async function updateStatus(orderId: string, status: "viewed" | "approved" | "rejected") {
    if (!token) return;
    setUpdating(orderId);

    const res = await apiFetch(`/api/distributor/orders/${orderId}/status`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ status }),
    });

    if (res.ok) {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status } : o))
      );
    }

    setUpdating(null);
  }

  async function submitDeliverFeedback(paymentStatus: "ok" | "late_payment" | "no_payment" | "skip") {
    if (!token || !deliverModal) return;
    setSubmittingDeliver(true);
    const body: Record<string, string> = { payment_status: paymentStatus };
    if ((paymentStatus === "late_payment" || paymentStatus === "no_payment") && deliverNotes) {
      body.notes = deliverNotes;
    }
    const res = await apiFetch(`/api/distributor/orders/${deliverModal.orderId}/deliver-feedback`, {
      method: "POST",
      token,
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setOrders((prev) => prev.map((o) =>
        o.id === deliverModal.orderId ? { ...o, status: "delivered" as const } : o
      ));
      setDeliverModal(null);
      setDeliverProblemType(null);
      setDeliverNotes("");
    }
    setSubmittingDeliver(false);
  }

  async function submitFeedback(orderId: string, status: "ok" | "problem") {
    if (!token) return;
    setSubmittingFeedback(true);

    const body =
      status === "ok"
        ? { status: "ok" }
        : { status: "problem", problem_type: problemForm.problem_type, notes: problemForm.notes || undefined };

    const res = await apiFetch(`/api/distributor/payment-feedback/${orderId}`, {
      method: "POST",
      token,
      body: JSON.stringify(body),
    });

    setSubmittingFeedback(false);
    if (res.ok) {
      setFeedbacks((prev) => prev.filter((f) => f.order.id !== orderId));
      setProblemModal(null);
    }
  }

  const distributorProfileOrder = onboardingData?.order || ["R", "EF", "C"];
  const distributorHighlighted = onboardingData?.highlighted || ["R"];
  const winningDistributorKey = (distributorHighlighted && distributorHighlighted.length > 0) ? distributorHighlighted[0] : (distributorProfileOrder[0] || "R");

  const renderDistributorProfileBlock = (profileKey: string) => {
    const isHighlighted = distributorHighlighted.includes(profileKey);

    if (profileKey === "R") {
      return (
        <div
          key="R"
          className={`rounded-3xl border p-6 transition-all duration-300 ${
            isHighlighted
              ? "border-[#22C55E] bg-white shadow-[0_0_20px_rgba(34,197,94,0.06)] ring-1 ring-[#22C55E]/10"
              : "border-slate-200 bg-white shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#22C55E]">Desempenho Comercial</span>
              <h3 className="text-base font-bold text-[#0F172A]">Indicadores de Foco em Receita</h3>
            </div>
            {isHighlighted && (
              <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold text-[#16A34A] border border-green-200">
                Foco Principal
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50/50 p-4 border border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Receita Incremental</p>
              <p className="mt-1 font-display font-extrabold text-[28px] leading-none tracking-tight text-[#22C55E]">
                {reportsData?.summary?.revenue_cents ? formatBRL(Math.round(reportsData.summary.revenue_cents * 0.15)) : "R$ 4.850,00"}
              </p>
              <p className="mt-2 text-[10px] text-slate-400">Estimativa adicional pelo Hubby</p>
            </div>

            <div className="rounded-2xl bg-slate-50/50 p-4 border border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Novos Compradores</p>
              <p className="mt-1 font-display font-extrabold text-[28px] leading-none tracking-tight text-[#0F172A]">
                {reportsData?.summary?.active_clients_count ?? 4}
              </p>
              <p className="mt-2 text-[10px] text-slate-400">Clientes ativos no período</p>
            </div>

            <div className="rounded-2xl bg-slate-50/50 p-4 border border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ticket Médio</p>
              <p className="mt-1 font-display font-extrabold text-[28px] leading-none tracking-tight text-[#0F172A]">
                {reportsData?.summary?.avg_ticket_cents ? formatBRL(reportsData.summary.avg_ticket_cents) : "R$ 680,00"}
              </p>
              <p className="mt-2 text-[10px] text-slate-400">Média por pedido aprovado</p>
            </div>
          </div>
        </div>
      );
    }

    if (profileKey === "EF") {
      return (
        <div
          key="EF"
          className={`rounded-3xl border p-6 transition-all duration-300 ${
            isHighlighted
              ? "border-blue-400 bg-white shadow-[0_0_20px_rgba(37,99,235,0.06)] ring-1 ring-blue-400/10"
              : "border-slate-200 bg-white shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500">Produtividade Operacional</span>
              <h3 className="text-base font-bold text-[#0F172A]">Indicadores de Foco em Eficiência</h3>
            </div>
            {isHighlighted && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
                Foco Principal
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50/50 p-4 border border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tempo de Resposta</p>
              <p className="mt-1 font-display font-extrabold text-[28px] leading-none tracking-tight text-blue-600">
                6 min
              </p>
              <p className="mt-2 text-[10px] text-slate-400">Tempo médio de retorno das cotações</p>
            </div>

            <div className="rounded-2xl bg-slate-50/50 p-4 border border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Produtividade</p>
              <p className="mt-1 font-display font-extrabold text-[28px] leading-none tracking-tight text-[#0F172A]">
                98%
              </p>
              <p className="mt-2 text-[10px] text-slate-400">Taxa de cotações respondidas</p>
            </div>

            <div className="rounded-2xl bg-slate-50/50 p-4 border border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Clientes Atendidos</p>
              <p className="mt-1 font-display font-extrabold text-[28px] leading-none tracking-tight text-[#0F172A]">
                {dash?.clients_today ?? 12}
              </p>
              <p className="mt-2 text-[10px] text-slate-400">Novos contatos hoje</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        key="C"
        className={`rounded-3xl border p-6 transition-all duration-300 ${
          isHighlighted
            ? "border-purple-400 bg-white shadow-[0_0_20px_rgba(147,51,234,0.06)] ring-1 ring-purple-400/10"
            : "border-slate-200 bg-white shadow-sm"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-500">Gestão e Custos</span>
            <h3 className="text-base font-bold text-[#0F172A]">Indicadores de Redução de Custos</h3>
          </div>
          {isHighlighted && (
            <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200">
              Foco Principal
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50/50 p-4 border border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Economia Operacional</p>
            <p className="mt-1 font-display font-extrabold text-[28px] leading-none tracking-tight text-purple-600">
              R$ 420,00
            </p>
            <p className="mt-2 text-[10px] text-slate-400">Redução de retrabalho com cotações</p>
          </div>

          <div className="rounded-2xl bg-slate-50/50 p-4 border border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Horas Economizadas</p>
            <p className="mt-1 font-display font-extrabold text-[28px] leading-none tracking-tight text-[#0F172A]">
              14h
            </p>
            <p className="mt-2 text-[10px] text-slate-400">Automação de processos comerciais</p>
          </div>

          <div className="rounded-2xl bg-slate-50/50 p-4 border border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Retorno (ROI)</p>
            <p className="mt-1 font-display font-extrabold text-[28px] leading-none tracking-tight text-[#0F172A]">
              4.8x
            </p>
            <p className="mt-2 text-[10px] text-slate-400">Retorno sobre assinatura da Hubby</p>
          </div>
        </div>
      </div>
    );
  };

  if (role === "client") {
    return (
      <div className="flex min-h-screen flex-col bg-[#F5F7FB]">
        <Navbar />
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
          <ClientDashboard />
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-[#F5F7FB]">
        <Navbar />
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-24 animate-pulse rounded-2xl bg-[#DBEAFE]/50" />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-3xl bg-[#DBEAFE]/50" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F7FB]">
      <Navbar />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">

        {/* Warning Banner Onboarding */}
        {!onboardingSurveyCompleted && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0 mt-0.5">💡</span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-amber-900">Personalize sua experiência</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Responda a um rápido questionário para nos ajudar a destacar seus produtos e otimizar suas vendas.
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push("/onboarding-survey")}
              className="shrink-0 rounded-xl bg-amber-500 hover:bg-amber-600 border-none px-4 py-2 text-xs font-bold text-white shadow-none active:scale-[0.98] transition-all"
            >
              Responder agora →
            </button>
          </div>
        )}

        {/* ── Boleto pendente: bloqueia o painel ─────────────────────────── */}
        {dash?.plan_status === "pending_payment" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#F5F7FB]/95 backdrop-blur-sm px-4">
            <div className="w-full max-w-md rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-xl">
              <Building2 size={48} className="text-amber-400" />
              <h2 className="mt-4 text-xl font-display font-bold text-[#0F172A]">Aguardando pagamento do boleto</h2>
              <p className="mt-3 text-sm text-slate-500">
                Seu boleto foi gerado. O acesso ao painel será liberado automaticamente após a confirmação do pagamento pelo banco.
              </p>
              <div className="mt-5 rounded-2xl bg-amber-50 px-5 py-4 text-left text-sm text-amber-800">
                <p className="font-semibold">O que fazer agora:</p>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  <li>Verifique seu e-mail — o boleto foi enviado pelo Stripe</li>
                  <li>Pague via internet banking ou app do seu banco</li>
                  <li>O prazo de vencimento é de <strong>3 dias úteis</strong></li>
                  <li>A confirmação pode levar até 2 dias úteis após o pagamento</li>
                </ul>
              </div>
              <p className="mt-4 text-xs text-slate-400">
                Dúvidas? Fale com o suporte via{" "}
                <a href="mailto:suporte@hubby.com.br" className="underline">suporte@hubby.com.br</a>
              </p>
            </div>
          </div>
        )}

        {/* Informações do Perfil da Distribuidora */}
        <div className="mb-6 rounded-3xl border border-[#DBEAFE] bg-gradient-to-r from-emerald-50 to-[#EFF6FF] p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#22C55E]">Personalização de Vendas</span>
            <h2 className="text-base font-bold text-[#0F172A] mt-1 flex flex-wrap items-center gap-1.5">
              Perfil da Distribuidora:{" "}
              {winningDistributorKey === "R" && <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-bold text-[#16A34A] border border-green-200">Foco em Receita</span>}
              {winningDistributorKey === "EF" && <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700 border border-blue-200">Foco em Eficiência</span>}
              {winningDistributorKey === "C" && <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs font-bold text-purple-700 border border-purple-200">Redução de Custos</span>}
            </h2>
            {onboardingData?.percentages && (
              <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-500">
                <span className="flex items-center gap-1">Receita: <strong className="text-emerald-600">{onboardingData.percentages.R ?? 0}%</strong></span>
                <span className="h-3 w-px bg-slate-200" />
                <span className="flex items-center gap-1">Eficiência: <strong className="text-blue-600">{onboardingData.percentages.EF ?? 0}%</strong></span>
                <span className="h-3 w-px bg-slate-200" />
                <span className="flex items-center gap-1">Custos: <strong className="text-purple-600">{onboardingData.percentages.C ?? 0}%</strong></span>
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

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-semibold text-[#0F172A]">Painel</h1>
            <p className="text-sm text-slate-500">Hoje, {dash?.today}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push("/painel/relatorios")}
            >
              Relatórios
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push("/painel/produtos")}
            >
              Gerenciar produtos
            </Button>
          </div>
        </div>

        {/* Abas do Painel */}
        <div className="mb-6 flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab("visao-geral")}
            className={`border-b-2 px-4 py-2.5 text-sm font-bold transition-all duration-205 -mb-px ${
              activeTab === "visao-geral"
                ? "border-[#22C55E] text-[#22C55E]"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Visão Geral
          </button>
          <button
            onClick={() => setActiveTab("desempenho")}
            className={`border-b-2 px-4 py-2.5 text-sm font-bold transition-all duration-205 -mb-px ${
              activeTab === "desempenho"
                ? "border-[#22C55E] text-[#22C55E]"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Desempenho de Vendas
          </button>
        </div>

        {activeTab === "visao-geral" && (
          <>
            {/* Indicador do Perfil Vencedor */}
            <div className="mb-8 space-y-6">
              {renderDistributorProfileBlock(winningDistributorKey)}
            </div>

            {/* Métricas do Dia */}
            <div className="mb-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Métricas Gerais de Hoje</h3>
            </div>
            <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <MetricCard
                label="Pedidos hoje"
                value={dash?.new_orders_today ?? 0}
                accent={Boolean(dash?.new_orders_today)}
              />
              <MetricCard
                label="Clientes hoje"
                value={dash?.clients_today ?? 0}
              />
              <MetricCard
                label="Aprovados hoje"
                value={dash?.approved_orders_today ?? 0}
              />
              <MetricCard
                label="Aguardando"
                value={dash?.pending_orders ?? 0}
                sub="sem resposta"
                accent={Boolean(dash?.pending_orders)}
              />
            </div>

        {/* Status de preços e produtos */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-[#DBEAFE] bg-white p-5 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Catálogo de produtos</p>
            <div className="flex items-center gap-6">
              <div>
                <p className="text-2xl font-semibold text-[#0F172A]">{dash?.active_products ?? 0}</p>
                <p className="text-xs text-slate-500">ativos</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-300">{dash?.inactive_products ?? 0}</p>
                <p className="text-xs text-slate-500">inativos</p>
              </div>
              <div className="ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/painel/produtos")}
                >
                  Gerenciar
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[#DBEAFE] bg-white p-5 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Regiões de entrega</p>
            <p className="text-xs text-slate-500">
              Gerencie os municípios atendidos, dias de rota e horário de corte.
            </p>
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/painel/regioes")}
              >
                Gerenciar regiões
              </Button>
            </div>
          </div>

          <div className="rounded-3xl border border-[#DBEAFE] bg-white p-5 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Última atualização de preço</p>
            <p className="text-lg font-bold text-[#0F172A]">
              {formatDateTime(dash?.last_price_update ?? null)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Preços atualizados após as 09h00 entram em vigor no próximo dia
            </p>
          </div>
        </div>

        {/* Feedback de pagamento */}
        {feedbacks.length > 0 && (
          <div className="mb-8 rounded-3xl border border-amber-200 bg-amber-50 shadow-sm">
            <div className="flex items-center gap-3 border-b border-amber-200 px-6 py-4">
              <span className="text-lg">⏳</span>
              <h2 className="text-sm font-display font-semibold text-amber-900">
                Pedidos aguardando feedback de pagamento
              </h2>
              <span className="ml-auto rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-800">
                {feedbacks.length}
              </span>
            </div>
            <ul className="divide-y divide-amber-100">
              {feedbacks.map((fb) => (
                <li key={fb.id} className="px-6 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium text-[#0F172A]">
                        {fb.order.client.company_name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {fb.order.client.delivery_city} — {fb.order.client.delivery_state} ·{" "}
                        pedido em {formatDateTime(fb.order.sent_at)}
                      </p>
                      {fb.order.client.hubby_score !== 0 && (
                        <p className={`mt-0.5 text-xs font-medium ${fb.order.client.hubby_score > 0 ? "text-green-600" : "text-red-600"}`}>
                          Histórico Hubby:{" "}
                          {fb.order.client.hubby_score > 0 ? (
                            <><Check size={12} className="inline mr-1" />{fb.order.client.hubby_score} pedidos sem problemas</>
                          ) : (
                            <><AlertTriangle size={12} className="inline mr-1" />{Math.abs(fb.order.client.hubby_score)} pontos negativos</>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-sm font-semibold text-[#0F172A]">
                        {formatBRL(fb.order.total_cents)}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <button
                          disabled={submittingFeedback}
                          onClick={() => submitFeedback(fb.order.id, "ok")}
                          className="rounded-xl bg-green-100 px-3 py-1.5 text-xs font-bold text-green-800 hover:bg-green-200 disabled:opacity-50"
                        >
                          <CheckCircle size={14} className="inline mr-1 text-green-700" />Pagou em dia
                        </button>
                        <button
                          disabled={submittingFeedback}
                          onClick={() => {
                            setProblemModal(fb.order.id);
                            setProblemForm({ problem_type: "late_payment", notes: "" });
                          }}
                          className="rounded-xl bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-200 disabled:opacity-50"
                        >
                          <AlertTriangle size={14} className="inline mr-1 text-amber-700" />Pagou com atraso
                        </button>
                        <button
                          disabled={submittingFeedback}
                          onClick={() => {
                            setProblemModal(fb.order.id);
                            setProblemForm({ problem_type: "no_payment", notes: "" });
                          }}
                          className="rounded-xl bg-red-100 px-3 py-1.5 text-xs font-bold text-red-800 hover:bg-red-200 disabled:opacity-50"
                        >
                          <XCircle size={14} className="inline mr-1 text-red-700" />Não pagou
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Modal — reportar problema de pagamento */}
        {problemModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
              <h3 className="mb-4 text-base font-display font-semibold text-[#0F172A]">
                Qual foi o problema com o pagamento?
              </h3>
              <div className="space-y-3">
                {(
                  [
                    { value: "late_payment", label: "Atraso no pagamento" },
                    { value: "no_payment", label: "Não pagou" },
                    { value: "returned_goods", label: "Devolveu mercadoria" },
                    { value: "other", label: "Outro" },
                  ] as const
                ).map(({ value, label }) => (
                  <label key={value} className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#DBEAFE] px-4 py-3 hover:bg-[#F5F7FB]">
                    <input
                      type="radio"
                      name="problem_type"
                      value={value}
                      checked={problemForm.problem_type === value}
                      onChange={() => setProblemForm((f) => ({ ...f, problem_type: value }))}
                      className="accent-[#2563EB]"
                    />
                    <span className="text-sm text-[#0F172A]">{label}</span>
                  </label>
                ))}
                <textarea
                  placeholder="Observações (opcional)"
                  value={problemForm.notes}
                  onChange={(e) => setProblemForm((f) => ({ ...f, notes: e.target.value }))}
                  maxLength={500}
                  rows={3}
                  className="w-full rounded-xl border border-[#DBEAFE] px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none"
                />
              </div>
              <div className="mt-5 flex gap-3">
                <button
                  disabled={submittingFeedback}
                  onClick={() => submitFeedback(problemModal, "problem")}
                  className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {submittingFeedback ? "Enviando…" : "Confirmar problema"}
                </button>
                <button
                  onClick={() => setProblemModal(null)}
                  className="flex-1 rounded-xl border border-[#DBEAFE] py-3 text-sm font-medium text-slate-500 hover:bg-[#F5F7FB]"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal — Preparo do Pedido */}
        {prepOrderId && (() => {
          const order = orders.find((o) => o.id === prepOrderId);
          if (!order) return null;

          const items = (order.items_snapshot as unknown as OrderItemSnapshot[]) || [];
          const totalItems = items.length;
          const preparedItems = items.filter((item: any) => item.prepared).length;
          const progressPercent = totalItems > 0 ? Math.round((preparedItems / totalItems) * 100) : 0;
          const allPrepared = preparedItems === totalItems;

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
              <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl max-h-[90vh] flex flex-col">
                
                {/* Header */}
                <div className="flex items-start justify-between border-b border-slate-100 pb-4 mb-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#2563EB] tracking-wider block mb-0.5">Etapa: Preparo</span>
                    <h3 className="text-base font-display font-semibold text-[#0F172A]">
                      Preparar Pedido - {order.client.company_name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Marque os itens conforme for separando as bebidas em estoque.
                    </p>
                  </div>
                  <button
                    onClick={() => setPrepOrderId(null)}
                    className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Progress bar */}
                <div className="mb-4 bg-[#F8FAFC] border border-slate-100 p-3.5 rounded-2xl">
                  <div className="flex items-center justify-between text-xs font-bold text-[#0F172A] mb-1.5">
                    <span>Progresso do Preparo</span>
                    <span className="font-mono">{preparedItems} de {totalItems} itens ({progressPercent}%)</span>
                  </div>
                  <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#22C55E] rounded-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Checklist */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-4 scrollbar-thin">
                  {items.map((item: any, idx: number) => (
                    <label 
                      key={idx} 
                      className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                        item.prepared 
                          ? "bg-green-50/50 border-green-200/80 text-[#16A34A]" 
                          : "bg-white border-slate-100 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={!!item.prepared}
                          onChange={() => handleToggleItemPrepared(order.id, idx)}
                          className="h-4.5 w-4.5 rounded border-slate-300 text-[#22C55E] focus:ring-[#22C55E]"
                        />
                        <div className="min-w-0">
                          <p className={`text-xs font-semibold truncate ${item.prepared ? "line-through opacity-75" : ""}`}>
                            {item.product_name}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {item.brand} {item.packaging ? `· ${item.packaging}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right ml-4">
                        <span className="text-xs font-bold font-mono block">
                          × {item.quantity}
                        </span>
                        <span className="text-[9px] text-slate-400 font-medium">unidades</span>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Comunique-se */}
                <div className="bg-[#EFF6FF] border border-[#DBEAFE] rounded-2xl p-4 mb-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-blue-900">Dúvidas ou falta de estoque?</p>
                    <p className="text-[10px] text-blue-700 mt-0.5">Fale com o cliente para negociar substituições.</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {order.client.whatsapp && (
                      <a
                        href={`https://wa.me/55${order.client.whatsapp.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-xl bg-white border border-[#DBEAFE] p-2 text-[#2563EB] hover:bg-blue-50 transition-colors shadow-sm flex items-center justify-center"
                        title="WhatsApp do Cliente"
                      >
                        <Phone size={14} />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleStartChat(order.client.id)}
                      disabled={chattingClientId === order.client.id}
                      className="rounded-xl bg-[#2563EB] text-white px-3 py-2 text-xs font-bold hover:bg-blue-700 transition-colors flex items-center gap-1 shadow-sm disabled:opacity-50"
                    >
                      {chattingClientId === order.client.id ? (
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border border-white border-t-transparent" />
                      ) : (
                        <>
                          <MessageSquare size={13} />
                          <span>Chat</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Action Footer */}
                <div className="flex gap-3 mt-auto">
                  <button
                    type="button"
                    disabled={updating === order.id}
                    onClick={async () => {
                      if (!allPrepared) {
                        const confirmLeave = confirm("Ainda faltam itens a serem preparados. Deseja prosseguir e enviar para entrega assim mesmo?");
                        if (!confirmLeave) return;
                      }
                      await updateStatus(order.id, "approved");
                      setPrepOrderId(null);
                    }}
                    className="flex-1 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 text-sm text-center transition-colors disabled:opacity-50"
                  >
                    Enviar para entrega
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrepOrderId(null)}
                    className="rounded-2xl border border-slate-200 px-5 py-3.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Fechar
                  </button>
                </div>

              </div>
            </div>
          );
        })()}

        {/* ── Modal: feedback rápido na entrega ────────────────────────────── */}
        {deliverModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
              <h3 className="mb-1 text-base font-bold text-[#0F172A]">Como foi o pagamento?</h3>
              <p className="mb-5 text-sm text-slate-500">
                {deliverModal.clientName} · {formatBRL(deliverModal.totalCents)}
              </p>

              <div className="flex flex-col gap-3">
                <button
                  disabled={submittingDeliver}
                  onClick={() => submitDeliverFeedback("ok")}
                  className="flex items-center gap-3 rounded-2xl border-2 border-green-200 bg-green-50 px-4 py-4 text-left font-bold text-green-800 hover:bg-green-100 disabled:opacity-50"
                >
                  <CheckCircle size={22} className="text-green-600" />
                  <span>Pagou em dia</span>
                </button>
                <button
                  disabled={submittingDeliver}
                  onClick={() => setDeliverProblemType(deliverProblemType === "late_payment" ? null : "late_payment")}
                  className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-4 text-left font-bold transition-all disabled:opacity-50 ${deliverProblemType === "late_payment" ? "border-amber-400 bg-amber-100 text-amber-900" : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"}`}
                >
                  <AlertTriangle size={22} className="text-amber-500" />
                  <span>Pagou com atraso</span>
                </button>
                <button
                  disabled={submittingDeliver}
                  onClick={() => setDeliverProblemType(deliverProblemType === "no_payment" ? null : "no_payment")}
                  className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-4 text-left font-bold transition-all disabled:opacity-50 ${deliverProblemType === "no_payment" ? "border-red-400 bg-red-100 text-red-900" : "border-red-200 bg-red-50 text-red-800 hover:bg-red-100"}`}
                >
                  <XCircle size={22} className="text-red-500" />
                  <span>Não pagou</span>
                </button>

                {deliverProblemType && (
                  <div className="mt-1">
                    <textarea
                      rows={2}
                      maxLength={100}
                      placeholder="Observação (opcional)"
                      value={deliverNotes}
                      onChange={(e) => setDeliverNotes(e.target.value)}
                      className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-[#0F172A] outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/20"
                    />
                    <button
                      disabled={submittingDeliver}
                      onClick={() => submitDeliverFeedback(deliverProblemType)}
                      className="mt-2 w-full rounded-xl bg-[#0F172A] py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      {submittingDeliver ? "Salvando…" : "Confirmar"}
                    </button>
                  </div>
                )}
              </div>

              <button
                disabled={submittingDeliver}
                onClick={() => submitDeliverFeedback("skip")}
                className="mt-4 w-full text-center text-xs font-medium text-slate-400 hover:text-slate-600 disabled:opacity-50"
              >
                Pular por agora
              </button>
            </div>
          </div>
        )}

        {/* Modal — visualizar detalhes do pedido */}
        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-4 mb-4">
                <div>
                  <h3 className="text-base font-display font-semibold text-[#0F172A]">
                    Detalhes do Pedido
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    ID: <span className="font-mono">{selectedOrder.id}</span>
                  </p>
                </div>
                <button
                  onClick={() => setViewOrderId(null)}
                  className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                {/* Status and Total */}
                <div className="flex items-center justify-between bg-[#F8FAFC] p-4 rounded-2xl border border-slate-100">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider block mb-1">Status</span>
                    <Badge variant={STATUS_BADGE[selectedOrder.status] ?? "gray"}>
                      {STATUS_LABEL[selectedOrder.status] ?? selectedOrder.status}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider block mb-1">Valor Total</span>
                    <span className="font-mono text-xl font-bold text-[#0F172A]">
                      {formatBRL(selectedOrder.total_cents)}
                    </span>
                  </div>
                </div>

                {/* Client Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="border border-[#DBEAFE]/60 bg-[#EFF6FF]/10 p-3.5 rounded-2xl">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Cliente
                    </h4>
                    <p className="text-sm font-semibold text-[#0F172A] truncate">
                      {selectedOrder.client.company_name}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      CNPJ: <span className="font-mono">{selectedOrder.client.cnpj}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      Tipo: {selectedOrder.client.establishment_type}
                    </p>
                  </div>

                  <div className="border border-slate-100 bg-slate-50/30 p-3.5 rounded-2xl">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Contato e Envio
                    </h4>
                    <p className="text-sm font-medium text-[#0F172A] truncate">
                      Responsável: {selectedOrder.client.responsible_name || "Não informado"}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Data: <span className="font-mono">{formatDateTime(selectedOrder.sent_at)}</span>
                    </p>
                    {selectedOrder.client.whatsapp && (
                      <a
                        href={`https://wa.me/55${selectedOrder.client.whatsapp.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-[#2563EB] hover:underline"
                      >
                        <Phone size={12} /> WhatsApp
                      </a>
                    )}
                  </div>
                </div>

                {/* Delivery Address */}
                <div className="border border-slate-100 p-3.5 rounded-2xl">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Endereço de Entrega
                  </h4>
                  <p className="text-xs text-slate-700 font-medium leading-relaxed">
                    {selectedOrder.client.delivery_address_full || "Não informado"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {selectedOrder.client.delivery_city} — {selectedOrder.client.delivery_state}
                  </p>
                </div>

                {/* Items List */}
                <div className="border border-slate-100 rounded-2xl overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2 border-b border-slate-100">
                    <h4 className="text-xs font-semibold text-slate-600">
                      Itens do Pedido
                    </h4>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-[220px] overflow-y-auto">
                    {((selectedOrder.items_snapshot as unknown as OrderItemSnapshot[]) || []).map((item, idx) => (
                      <div key={idx} className="px-4 py-3 flex items-center justify-between text-xs hover:bg-slate-50/50">
                        <div className="flex-1 min-w-0 pr-3">
                          <p className="font-semibold text-[#0F172A] truncate">
                            {item.product_name}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {item.brand} {item.packaging ? `· ${item.packaging}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 text-right">
                          <div>
                            <span className="text-[9px] text-slate-400 block font-medium">Qtd</span>
                            <span className="font-semibold text-[#0F172A]">{item.quantity}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 block font-medium">Preço</span>
                            <span className="font-mono text-slate-500">{formatBRL(item.unit_price_cents)}</span>
                          </div>
                          <div className="min-w-[65px]">
                            <span className="text-[9px] text-slate-400 block font-medium">Subtotal</span>
                            <span className="font-mono font-bold text-[#0F172A]">
                              {formatBRL((item.total_price_cents || (item.quantity * item.unit_price_cents)))}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action buttons footer */}
              <div className="border-t border-slate-100 pt-4 mt-4 flex gap-3">
                {selectedOrder.status === "sent" && (
                  <>
                    <button
                      disabled={updating === selectedOrder.id}
                      onClick={async () => {
                        await updateStatus(selectedOrder.id, "viewed");
                        setViewOrderId(null);
                      }}
                      className="flex-1 rounded-2xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      <Check size={16} /> Aceitar Pedido
                    </button>
                    <button
                      disabled={updating === selectedOrder.id}
                      onClick={async () => {
                        await updateStatus(selectedOrder.id, "rejected");
                        setViewOrderId(null);
                      }}
                      className="flex-1 rounded-2xl bg-red-600 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      <X size={16} /> Recusar Pedido
                    </button>
                  </>
                )}
                {selectedOrder.status === "viewed" && (
                  <button
                    onClick={() => {
                      setViewOrderId(null);
                      setPrepOrderId(selectedOrder.id);
                    }}
                    className="flex-1 rounded-2xl bg-[#2563EB] py-3 text-sm font-bold text-white hover:bg-blue-700 flex items-center justify-center gap-1.5"
                  >
                    <Check size={16} /> Preparar Pedido
                  </button>
                )}
                {selectedOrder.status === "approved" && (
                  <button
                    onClick={() => {
                      setViewOrderId(null);
                      setDeliverModal({
                        orderId: selectedOrder.id,
                        clientName: selectedOrder.client.company_name,
                        totalCents: selectedOrder.total_cents,
                      });
                    }}
                    className="flex-1 rounded-2xl bg-slate-900 py-3 text-sm font-bold text-white hover:bg-slate-800 flex items-center justify-center gap-1.5"
                  >
                    Marcar como entregue
                  </button>
                )}
                <button
                  onClick={() => setViewOrderId(null)}
                  className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Leads recentes */}
        <div className="rounded-3xl border border-[#DBEAFE] bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#DBEAFE] px-6 py-4">
            <h2 className="text-sm font-display font-semibold text-[#0F172A]">Pedidos e Acompanhamento</h2>
            <button
              onClick={() => router.push("/painel/pedidos")}
              className="text-xs text-[#2563EB] hover:underline"
            >
              Ver todos →
            </button>
          </div>

          {/* Sub-abas de status de pedido */}
          <div className="flex border-b border-slate-100 bg-[#F8FAFC] px-4 py-2 text-xs font-bold gap-2 overflow-x-auto">
            {[
              { id: "sent", label: "Aguardando", count: orders.filter((o) => o.status === "sent").length },
              { id: "viewed", label: "Em Preparo", count: orders.filter((o) => o.status === "viewed").length },
              { id: "approved", label: "Em Entrega", count: orders.filter((o) => o.status === "approved").length },
              { id: "completed", label: "Finalizados", count: orders.filter((o) => o.status === "delivered" || o.status === "rejected").length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setOrderFilterTab(tab.id as any)}
                className={`rounded-xl px-3 py-2 transition-all whitespace-nowrap ${
                  orderFilterTab === tab.id
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-700"
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    orderFilterTab === tab.id ? "bg-white/25 text-white" : "bg-slate-200 text-slate-700"
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {(() => {
            const filteredOrders = orders.filter((order) => {
              if (orderFilterTab === "sent") return order.status === "sent";
              if (orderFilterTab === "viewed") return order.status === "viewed";
              if (orderFilterTab === "approved") return order.status === "approved";
              return order.status === "delivered" || order.status === "rejected";
            });

            if (filteredOrders.length === 0) {
              return (
                <div className="px-6 py-12 text-center bg-white rounded-b-3xl">
                  <p className="text-sm text-slate-400">Nenhum pedido nesta etapa no momento.</p>
                </div>
              );
            }

            return (
              <ul className="divide-y divide-[#DBEAFE] bg-white rounded-b-3xl">
                {filteredOrders.map((order) => (
                  <li key={order.id} className="px-6 py-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-bold text-sm text-[#0F172A]">
                          {order.client.company_name}
                        </p>
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#22C55E]/10 px-2 py-0.5 text-[9px] font-bold text-[#16A34A]">
                          <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" aria-hidden>
                            <path d="M8 1.5L2 4v4c0 3.31 2.55 5.91 6 6.5 3.45-.59 6-3.19 6-6.5V4L8 1.5Z" fill="#16A34A" opacity=".2" stroke="#16A34A" strokeWidth="1.2" strokeLinejoin="round" />
                            <path d="M5.5 8l2 2 3-3" stroke="#16A34A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          CNPJ verificado pela Hubby
                        </span>
                        <p className="mt-1.5 text-xs text-slate-500">
                          {order.client.delivery_city} — {order.client.delivery_state} ·{" "}
                          <span className="font-mono font-medium">{formatDateTime(order.sent_at)}</span>
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-[#0F172A]">
                            {formatBRL(order.total_cents)}
                          </span>
                          <Badge variant={STATUS_BADGE[order.status] ?? "gray"}>
                            {STATUS_LABEL[order.status] ?? order.status}
                          </Badge>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => setViewOrderId(order.id)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1 shadow-sm"
                          >
                            <Eye size={12} /> Ver pedido
                          </button>

                          {order.status === "sent" && (
                            <div className="flex gap-2">
                              <button
                                disabled={updating === order.id}
                                onClick={() => updateStatus(order.id, "viewed")}
                                className="rounded-xl bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-1 shadow-sm"
                              >
                                <Check size={12} /> Aceitar
                              </button>
                              <button
                                disabled={updating === order.id}
                                onClick={() => updateStatus(order.id, "rejected")}
                                className="rounded-xl bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 text-xs font-bold hover:bg-red-100 disabled:opacity-50 flex items-center gap-1 shadow-sm"
                              >
                                <X size={12} /> Recusar
                              </button>
                            </div>
                          )}

                          {order.status === "viewed" && (
                            <button
                              onClick={() => setPrepOrderId(order.id)}
                              className="rounded-xl bg-[#2563EB] text-white px-4 py-1.5 text-xs font-bold hover:bg-blue-700 flex items-center gap-1 shadow-sm"
                            >
                              <Check size={12} /> Preparar
                            </button>
                          )}

                          {order.status === "approved" && (
                            <button
                              onClick={() => setDeliverModal({ orderId: order.id, clientName: order.client.company_name, totalCents: order.total_cents })}
                              className="rounded-xl bg-slate-900 text-white px-3 py-1.5 text-xs font-bold hover:bg-slate-800 shadow-sm"
                            >
                              Confirmar entrega
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            );
          })()}
        </div>
        </>
        )}

        {/* Aba Desempenho de Vendas */}
        {activeTab === "desempenho" && (
          <div className="space-y-6">
            {/* Filtro de Período */}
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Métricas de Período
              </h3>
              <div className="flex rounded-xl border border-[#DBEAFE] bg-white overflow-hidden shadow-sm">
                {([
                  { value: "7d", label: "7 dias" },
                  { value: "30d", label: "30 dias" },
                  { value: "90d", label: "90 dias" },
                  { value: "12m", label: "12 meses" }
                ] as const).map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setSalesPeriod(p.value)}
                    className={`px-4 py-2 text-xs font-semibold transition-colors ${
                      salesPeriod === p.value
                        ? "bg-[#2563EB] text-white"
                        : "text-slate-500 hover:bg-[#F5F7FB]"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {loadingReports ? (
              <div className="flex items-center justify-center py-24 bg-white border border-[#DBEAFE] rounded-3xl shadow-sm">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#2563EB] border-t-transparent" />
              </div>
            ) : !reportsData ? (
              <div className="text-center py-20 bg-white border border-[#DBEAFE] rounded-3xl shadow-sm">
                <p className="text-sm text-slate-400">Não foi possível carregar os relatórios de desempenho.</p>
              </div>
            ) : (
              <>
                {/* Grid de Métricas Principais */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                  <div className="rounded-3xl border border-[#DBEAFE] bg-white p-5 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Faturamento total</p>
                    <p className="mt-2 text-xl font-extrabold text-[#2563EB] font-mono leading-tight">
                      {formatBRL(reportsData.summary.revenue_cents)}
                    </p>
                    <p className="mt-1 text-[10px] font-medium text-slate-400">pedidos aprovados/entregues</p>
                  </div>

                  <div className="rounded-3xl border border-[#DBEAFE] bg-white p-5 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ticket médio</p>
                    <p className="mt-2 text-xl font-extrabold text-[#0F172A] font-mono leading-tight">
                      {reportsData.summary.avg_ticket_cents > 0 ? formatBRL(reportsData.summary.avg_ticket_cents) : "—"}
                    </p>
                    <p className="mt-1 text-[10px] font-medium text-slate-400">por pedido aprovado</p>
                  </div>

                  <div className="rounded-3xl border border-[#DBEAFE] bg-white p-5 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Taxa de aprovação</p>
                    <p className="mt-2 text-xl font-extrabold text-[#22C55E] font-mono leading-tight">
                      {reportsData.summary.total_orders > 0 
                        ? `${Math.round((reportsData.summary.approved_orders / reportsData.summary.total_orders) * 100)}%` 
                        : "0%"}
                      </p>
                      <p className="mt-1 text-[10px] font-medium text-slate-400">
                        {reportsData.summary.approved_orders} de {reportsData.summary.total_orders} pedidos
                      </p>
                    </div>

                    <div className="rounded-3xl border border-[#DBEAFE] bg-white p-5 shadow-sm">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Clientes ativos</p>
                      <p className="mt-2 text-xl font-extrabold text-[#0F172A] font-mono leading-tight">
                        {reportsData.summary.active_clients_count}
                      </p>
                      <p className="mt-1 text-[10px] font-medium text-slate-400">compras no período</p>
                    </div>

                    <div className="rounded-3xl border border-[#DBEAFE] bg-white p-5 shadow-sm col-span-2 sm:col-span-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ticket por cliente</p>
                      <p className="mt-2 text-xl font-extrabold text-[#0F172A] font-mono leading-tight">
                        {reportsData.summary.active_clients_count > 0 
                          ? formatBRL(Math.round(reportsData.summary.revenue_cents / reportsData.summary.active_clients_count)) 
                          : "—"}
                      </p>
                      <p className="mt-1 text-[10px] font-medium text-slate-400">gasto médio por cliente</p>
                    </div>
                  </div>

                  {/* Gráfico principal */}
                  <SalesChart data={reportsData.by_day} period={salesPeriod} />

                  {/* Detalhes de status & Top listagem */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Distribuição de Status */}
                    <div className="rounded-3xl border border-[#DBEAFE] bg-white p-5 shadow-sm flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                          Distribuição de Pedidos
                        </h4>
                        <div className="space-y-3">
                          {[
                            { 
                              label: "Aprovados/Entregues", 
                              count: reportsData.summary.approved_orders, 
                              color: "bg-[#22C55E]", 
                              percent: reportsData.summary.total_orders > 0 
                                ? (reportsData.summary.approved_orders / reportsData.summary.total_orders) * 100 
                                : 0 
                            },
                            { 
                              label: "Aguardando aprovação", 
                              count: reportsData.summary.pending_orders, 
                              color: "bg-amber-500", 
                              percent: reportsData.summary.total_orders > 0 
                                ? (reportsData.summary.pending_orders / reportsData.summary.total_orders) * 100 
                                : 0 
                            },
                            { 
                              label: "Recusados", 
                              count: reportsData.summary.rejected_orders, 
                              color: "bg-red-500", 
                              percent: reportsData.summary.total_orders > 0 
                                ? (reportsData.summary.rejected_orders / reportsData.summary.total_orders) * 100 
                                : 0 
                            }
                          ].map((item, idx) => (
                            <div key={idx} className="space-y-1">
                              <div className="flex items-center justify-between text-xs font-semibold text-[#0F172A]">
                                <span>{item.label}</span>
                                <span className="font-mono">{item.count} ({Math.round(item.percent)}%)</span>
                              </div>
                              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${item.color} transition-all duration-500`}
                                  style={{ width: `${item.percent}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="mt-4 border-t border-slate-100 pt-3 flex items-center justify-between text-xs font-semibold text-slate-500">
                        <span>Total recebido</span>
                        <span className="font-mono text-[#0F172A]">{reportsData.summary.total_orders} pedidos</span>
                      </div>
                    </div>

                    {/* Distribuição de Feedback */}
                    <div className="rounded-3xl border border-[#DBEAFE] bg-white p-5 shadow-sm flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                          Qualidade do Pagamento
                        </h4>
                        <div className="space-y-3">
                          {[
                            { 
                              label: "Pagamento OK", 
                              count: reportsData.feedback.ok + reportsData.feedback.auto_ok, 
                              color: "bg-[#22C55E]", 
                              percent: (reportsData.feedback.ok + reportsData.feedback.auto_ok + reportsData.feedback.problem) > 0
                                ? ((reportsData.feedback.ok + reportsData.feedback.auto_ok) / (reportsData.feedback.ok + reportsData.feedback.auto_ok + reportsData.feedback.problem)) * 100
                                : 0 
                            },
                            { 
                              label: "Com Problemas", 
                              count: reportsData.feedback.problem, 
                              color: "bg-red-500", 
                              percent: (reportsData.feedback.ok + reportsData.feedback.auto_ok + reportsData.feedback.problem) > 0
                                ? (reportsData.feedback.problem / (reportsData.feedback.ok + reportsData.feedback.auto_ok + reportsData.feedback.problem)) * 100
                                : 0 
                            }
                          ].map((item, idx) => (
                            <div key={idx} className="space-y-1">
                              <div className="flex items-center justify-between text-xs font-semibold text-[#0F172A]">
                                <span>{item.label}</span>
                                <span className="font-mono">{item.count} {idx === 0 && `(${Math.round(item.percent)}%)`}</span>
                              </div>
                              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${item.color} transition-all duration-500`}
                                  style={{ width: `${item.percent}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="mt-4 border-t border-slate-100 pt-3 flex items-center justify-between text-xs font-semibold text-slate-500">
                        <span>Aguardando feedback</span>
                        <span className="font-mono text-amber-500">{reportsData.feedback.pending} pendentes</span>
                      </div>
                    </div>

                    {/* Faturamento e Planos */}
                    <div className="rounded-3xl border border-[#DBEAFE] bg-white p-5 shadow-sm flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                          Status do Plano
                        </h4>
                        <div className="bg-[#EFF6FF] border border-[#DBEAFE] rounded-2xl p-4 mt-2">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Seu plano atual</p>
                          <p className="text-lg font-extrabold text-[#2563EB] mt-1 capitalize leading-none font-sans">
                            {dash?.plan ?? "Carregando..."}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-2 font-medium">
                            {reportsData.limited 
                              ? "Métricas limitadas a 7 dias no plano atual." 
                              : "Métricas completas disponíveis em tempo real."}
                          </p>
                        </div>
                      </div>
                      {reportsData.limited && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full mt-4"
                          onClick={() => router.push("/meu-plano")}
                        >
                          Fazer Upgrade
                        </Button>
                      )}
                    </div>
                  </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
