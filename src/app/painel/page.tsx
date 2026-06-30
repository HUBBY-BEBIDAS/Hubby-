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
  Building2, CheckCircle, AlertTriangle, XCircle, Check, X,
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

type OrderItem = {
  id: string;
  group_id: string;
  status: "sent" | "viewed" | "approved" | "rejected" | "delivered";
  total_cents: number;
  sent_at: string;
  client: {
    id: string;
    company_name: string;
    establishment_type: string;
    delivery_city: string;
    delivery_state: string;
    whatsapp: string;
  };
};


const STATUS_LABEL: Record<string, string> = {
  sent: "Aguardando",
  viewed: "Visualizado",
  approved: "Aprovado",
  rejected: "Recusado",
  delivered: "Entregue",
};

const STATUS_BADGE: Record<string, "yellow" | "blue" | "green" | "red" | "gray"> = {
  sent: "yellow",
  viewed: "blue",
  approved: "green",
  rejected: "red",
  delivered: "gray",
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

  const [dash, setDash] = useState<DashboardData | null>(null);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [feedbacks, setFeedbacks] = useState<PendingFeedback[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [problemModal, setProblemModal] = useState<string | null>(null); // orderId
  const [problemForm, setProblemForm] = useState<ProblemForm>({
    problem_type: "late_payment",
    notes: "",
  });
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // ── Deliver feedback modal (ao entregar) ──────────────────────────────────
  const [deliverModal, setDeliverModal] = useState<{
    orderId: string;
    clientName: string;
    totalCents: number;
  } | null>(null);
  const [deliverProblemType, setDeliverProblemType] = useState<"late_payment" | "no_payment" | null>(null);
  const [deliverNotes, setDeliverNotes] = useState("");
  const [submittingDeliver, setSubmittingDeliver] = useState(false);

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
        ])
          .then(([dashData, ordersData]) => {
            setDash(dashData as DashboardData);
            setOrders((ordersData as { data: OrderItem[] }).data ?? []);
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

        {/* Métricas */}
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

        {/* Leads recentes */}
        <div className="rounded-3xl border border-[#DBEAFE] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#DBEAFE] px-6 py-4">
            <h2 className="text-sm font-display font-semibold text-[#0F172A]">Pedidos recentes</h2>
            <button
              onClick={() => router.push("/painel/pedidos")}
              className="text-xs text-[#2563EB] hover:underline"
            >
              Ver todos →
            </button>
          </div>

          {orders.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm text-slate-400">Nenhum pedido recebido ainda.</p>
            </div>
          ) : (
            <ul className="divide-y divide-[#DBEAFE]">
              {orders.map((order) => (
                <li key={order.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium text-[#0F172A]">
                        {order.client.company_name}
                      </p>
                      <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-[#22C55E]/10 px-2 py-0.5 text-[10px] font-bold text-[#16A34A]">
                        <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" aria-hidden>
                          <path d="M8 1.5L2 4v4c0 3.31 2.55 5.91 6 6.5 3.45-.59 6-3.19 6-6.5V4L8 1.5Z" fill="#16A34A" opacity=".2" stroke="#16A34A" strokeWidth="1.2" strokeLinejoin="round" />
                          <path d="M5.5 8l2 2 3-3" stroke="#16A34A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        CNPJ verificado pela Hubby
                      </span>
                      <p className="mt-1 text-xs text-slate-500">
                        {order.client.delivery_city} — {order.client.delivery_state} ·{" "}
                        <span className="font-mono font-medium">{formatDateTime(order.sent_at)}</span>
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[15px] font-medium text-[#0F172A]">
                          {formatBRL(order.total_cents)}
                        </span>
                        <Badge variant={STATUS_BADGE[order.status] ?? "gray"}>
                          {STATUS_LABEL[order.status] ?? order.status}
                        </Badge>
                      </div>

                      {order.status === "sent" && (
                        <div className="flex gap-2">
                          <button
                            disabled={updating === order.id}
                            onClick={() => updateStatus(order.id, "approved")}
                            className="rounded-xl bg-green-100 px-3 py-1 text-xs font-medium text-green-800 hover:bg-green-200 disabled:opacity-50"
                          >
                            <Check size={12} className="inline mr-1" />Aprovar
                          </button>
                          <button
                            disabled={updating === order.id}
                            onClick={() => updateStatus(order.id, "rejected")}
                            className="rounded-xl bg-red-100 px-3 py-1 text-xs font-medium text-red-800 hover:bg-red-200 disabled:opacity-50"
                          >
                            <X size={12} className="inline mr-1" />Recusar
                          </button>
                        </div>
                      )}
                      {order.status === "approved" && (
                        <button
                          onClick={() => setDeliverModal({ orderId: order.id, clientName: order.client.company_name, totalCents: order.total_cents })}
                          className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                        >
                          Marcar como entregue
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
