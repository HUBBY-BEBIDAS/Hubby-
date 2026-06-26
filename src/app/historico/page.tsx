"use client";

import { useEffect, useState, FormEvent } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Navbar } from "@/components/Navbar";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";
import { Star, X, Check } from "lucide-react";

// ─── Modal de avaliação ───────────────────────────────────────────────────────

type ReviewTarget = {
  order_id: string;
  distributor_id: string;
  distributor_name: string;
};

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          className="leading-none transition-transform hover:scale-110"
        >
          <Star size={22} className={s <= (hover || value) ? "fill-amber-400 text-amber-400" : "text-slate-200"} />
        </button>
      ))}
    </div>
  );
}

function ReviewModal({
  target,
  onClose,
  onSubmit,
}: {
  target: ReviewTarget;
  onClose: () => void;
  onSubmit: (data: ReviewPayload) => Promise<void>;
}) {
  const [rating, setRating] = useState(0);
  const [responseTime, setResponseTime] = useState(0);
  const [serviceQuality, setServiceQuality] = useState(0);
  const [priceFairness, setPriceFairness] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (rating === 0) { setError("Selecione a nota geral."); return; }
    setSubmitting(true);
    setError("");
    try {
      await onSubmit({
        distributor_id: target.distributor_id,
        order_id: target.order_id,
        rating,
        rating_response_time:   responseTime   || undefined,
        rating_service_quality: serviceQuality || undefined,
        rating_price_fairness:  priceFairness  || undefined,
        comment: comment.trim() || undefined,
      });
    } catch {
      setError("Erro ao enviar avaliação. Tente novamente.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-3xl border border-[#DBEAFE] bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-display font-bold text-[#0F172A]">Avaliar atendimento</h2>
            <p className="mt-0.5 text-sm text-slate-500">{target.distributor_name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-[#F5F7FB] hover:text-slate-600"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Nota geral */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[#0F172A]">
              Nota geral <span className="text-red-500">*</span>
            </label>
            <StarRating value={rating} onChange={setRating} />
          </div>

          {/* Categorias */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Prazo de resposta", value: responseTime, set: setResponseTime },
              { label: "Qualidade do atendimento", value: serviceQuality, set: setServiceQuality },
              { label: "Preço justo", value: priceFairness, set: setPriceFairness },
            ].map(({ label, value, set }) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <p className="text-center text-[11px] font-medium text-slate-500">{label}</p>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => set(s)}
                      className="leading-none"
                    >
                      <Star size={16} className={s <= value ? "fill-amber-400 text-amber-400" : "text-slate-200"} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Comentário */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#0F172A]">
              Comentário <span className="text-slate-400">(opcional)</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 300))}
              placeholder="Conte como foi a experiência…"
              rows={3}
              className="w-full resize-none rounded-xl border border-[#DBEAFE] px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-[#22C55E] focus:outline-none"
            />
            <p className="mt-1 text-right text-[11px] text-slate-400">{comment.length}/300</p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <Button type="button" variant="secondary" fullWidth onClick={onClose}>Cancelar</Button>
            <Button type="submit" fullWidth loading={submitting}>Enviar avaliação</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

type ReviewPayload = {
  distributor_id: string;
  order_id: string;
  rating: number;
  rating_response_time?: number;
  rating_service_quality?: number;
  rating_price_fairness?: number;
  comment?: string;
};

type OrderSummary = {
  id: string;
  distributor_id: string;
  distributor_name: string;
  status: "sent" | "viewed" | "approved" | "rejected";
  total_cents: number;
  estimated_delivery_date: string | null;
  updated_at: string;
};

type OrderGroup = {
  group_id: string;
  quotation_id: string;
  delivery_city: string;
  delivery_state: string;
  sent_at: string;
  orders: OrderSummary[];
  total_cents: number;
};

const STATUS_LABEL: Record<string, string> = {
  sent:     "Enviado",
  viewed:   "Visualizado",
  approved: "Aprovado",
  rejected: "Recusado",
};

const STATUS_BADGE: Record<string, "gray" | "blue" | "green" | "red"> = {
  sent:     "gray",
  viewed:   "blue",
  approved: "green",
  rejected: "red",
};

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export default function HistoricoPage() {
  useSession({ required: true });
  const router = useRouter();
  const token = useApiToken();

  const [groups, setGroups] = useState<OrderGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reordering, setReordering] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null);
  const [reviewedOrders, setReviewedOrders] = useState<Set<string>>(new Set());
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (!token) return;

    setLoading(true);
    apiFetch(`/api/orders?page=${page}&limit=10`, { method: "GET", token })
      .then((r) => r.json())
      .then((data: { data: OrderGroup[]; pagination: { total_pages: number } }) => {
        setGroups(data.data ?? []);
        setTotalPages(data.pagination?.total_pages ?? 1);
      })
      .catch(() => setError("Erro ao carregar histórico."))
      .finally(() => setLoading(false));
  }, [token, page]);

  const [reorderWarning, setReorderWarning] = useState<{ groupId: string; unavailable: string[] } | null>(null);

  async function handleReorder(groupId: string) {
    if (!token) return;
    setReordering(groupId);
    setReorderWarning(null);

    const res = await apiFetch(`/api/orders/${groupId}/reorder`, { method: "POST", token });
    const data = await res.json() as {
      quotation?: { id: string };
      unavailable_items?: string[];
      error?: string;
    };
    setReordering(null);

    if (!res.ok) {
      setError(data.error ?? "Erro ao repetir pedido.");
      return;
    }

    // Avisa sobre produtos indisponíveis mas redireciona mesmo assim
    if (data.unavailable_items && data.unavailable_items.length > 0) {
      setReorderWarning({ groupId, unavailable: data.unavailable_items });
      // Aguarda 2s para o usuário ler o aviso antes de redirecionar
      setTimeout(() => {
        router.push(`/cotacao/${data.quotation!.id}/ranking`);
      }, 2500);
    } else {
      router.push(`/cotacao/${data.quotation!.id}/ranking`);
    }
  }

  async function submitReview(payload: ReviewPayload) {
    if (!token) throw new Error("Sem token");
    const res = await apiFetch("/api/reviews", {
      method: "POST", token, body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Erro ao enviar");
    setReviewedOrders((prev) => new Set([...prev, payload.order_id]));
    setReviewTarget(null);
  }

  function canReview(order: OrderSummary, sentAt: string): boolean {
    if (reviewedOrders.has(order.id)) return false;
    if (["viewed", "approved", "rejected"].includes(order.status)) return true;
    // Após 24h do envio
    const elapsed = Date.now() - new Date(sentAt).getTime();
    return elapsed > 24 * 60 * 60 * 1000;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-[#F5F7FB]">
        <Navbar />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
          <div className="mb-6 h-8 w-40 animate-pulse rounded bg-[#DBEAFE]" />
          {[1, 2, 3].map((n) => (
            <div key={n} className="mb-4 h-28 animate-pulse rounded-3xl bg-[#DBEAFE]/50" />
          ))}
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F7FB]">
      {reviewTarget && (
        <ReviewModal
          target={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onSubmit={submitReview}
        />
      )}
      <Navbar />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-[#0F172A]">
          Histórico de pedidos
        </h1>
        <p className="mb-6 text-sm font-medium text-slate-500">Seus pedidos enviados, agrupados por data.</p>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {reorderWarning && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="font-semibold">
              {reorderWarning.unavailable.length} produto{reorderWarning.unavailable.length !== 1 ? "s" : ""} não disponível{reorderWarning.unavailable.length !== 1 ? "is" : ""} — removido{reorderWarning.unavailable.length !== 1 ? "s" : ""} do ranking:
            </p>
            <ul className="mt-1 list-disc pl-4">
              {reorderWarning.unavailable.map((p) => (
                <li key={p} className="text-xs">{p}</li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-amber-600">Redirecionando para o ranking em instantes…</p>
          </div>
        )}

        {groups.length === 0 && !error && (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-300 mx-auto mb-3"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
            <p className="mb-1 text-base font-semibold text-[#0F172A]">Nenhum pedido ainda</p>
            <p className="mb-4 text-sm font-medium text-slate-500">Você ainda não enviou nenhum pedido.</p>
            <Button onClick={() => router.push("/cotacao")}>Fazer primeira cotação</Button>
          </div>
        )}

        {groups.map((group) => (
          <div key={group.group_id} className="mb-4 rounded-3xl border border-[#DBEAFE] bg-white shadow-sm">
            {/* Header do grupo */}
            <div className="flex items-start justify-between border-b border-[#DBEAFE] px-6 py-4">
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">
                  {group.delivery_city} — {group.delivery_state}
                </p>
                <p className="text-xs text-slate-500">{formatDate(group.sent_at)}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-[#22C55E]">
                  {formatBRL(group.total_cents)}
                </p>
                <p className="text-xs text-slate-400">{group.orders.length} distribuidora(s)</p>
              </div>
            </div>

            {/* Pedidos do grupo */}
            <ul className="divide-y divide-[#DBEAFE]">
              {group.orders.map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-3 px-6 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#0F172A]">{order.distributor_name}</p>
                    {order.estimated_delivery_date && (
                      <p className="text-xs text-slate-500">
                        Entrega: {formatDate(order.estimated_delivery_date)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#0F172A]">
                      {formatBRL(order.total_cents)}
                    </span>
                    <Badge variant={STATUS_BADGE[order.status] ?? "gray"}>
                      {STATUS_LABEL[order.status] ?? order.status}
                    </Badge>
                    {canReview(order, group.sent_at) && (
                      <button
                        onClick={() => setReviewTarget({
                          order_id: order.id,
                          distributor_id: order.distributor_id,
                          distributor_name: order.distributor_name,
                        })}
                        className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 transition hover:bg-amber-100"
                      >
                        Avaliar
                      </button>
                    )}
                    {reviewedOrders.has(order.id) && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#22C55E]"><Check size={11} />Avaliado</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {/* Ação */}
            <div className="px-6 py-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleReorder(group.group_id)}
                loading={reordering === group.group_id}
              >
                Repetir pedido
              </Button>
            </div>
          </div>
        ))}

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-4">
            <Button
              variant="secondary"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Anterior
            </Button>
            <span className="text-sm text-slate-500">{page} / {totalPages}</span>
            <Button
              variant="secondary"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima →
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
