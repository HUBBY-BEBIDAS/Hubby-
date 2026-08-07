"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/ui/Badge";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";
import {
  ArrowLeft, Search, Eye, Check, X, CheckCircle, AlertTriangle, XCircle, Volume2, Clock, Filter,
} from "lucide-react";

type OrderItemSnapshot = {
  product_name: string;
  brand: string;
  category?: string;
  packaging?: string;
  quantity: number;
  unit_price_cents: number;
  total_price_cents?: number;
  prepared?: boolean;
};

type OrderItem = {
  id: string;
  group_id: string;
  status: "sent" | "viewed" | "approved" | "rejected" | "delivered";
  total_cents: number;
  items_snapshot: OrderItemSnapshot[] | null;
  estimated_delivery_date: string | null;
  sent_at: string;
  updated_at: string;
  client: {
    id: string;
    company_name: string;
    cnpj: string;
    establishment_type: string;
    responsible_name: string | null;
    whatsapp: string;
    delivery_city: string;
    delivery_state: string;
    delivery_address_full: string | null;
  };
};

const STATUS_LABEL: Record<string, string> = {
  sent: "Aguardando",
  viewed: "Em preparo",
  approved: "Em entrega",
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

function getOrderElapsedBadge(sentAtIso: string, status: string) {
  if (status !== "sent") return null;
  const elapsedMs = Date.now() - new Date(sentAtIso).getTime();
  const minutes = Math.floor(elapsedMs / 60_000);

  if (minutes < 5) {
    return {
      label: `⏱️ Recebido há ${minutes < 1 ? "menos de 1 min" : `${minutes} min`} — Responda rápido para nota 5⭐`,
      color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  } else if (minutes < 30) {
    return {
      label: `⏱️ Recebido há ${minutes} min — Responda para manter boa avaliação ⭐`,
      color: "bg-amber-50 text-amber-800 border-amber-200",
    };
  } else {
    return {
      label: `⚠️ Recebido há ${minutes >= 60 ? `${Math.floor(minutes / 60)}h` : `${minutes} min`} — Resposta pendente`,
      color: "bg-rose-50 text-rose-700 border-rose-200",
    };
  }
}

export default function DistribuidorPedidosPage() {
  useSession({ required: true });
  const router = useRouter();
  const token = useApiToken();

  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusTab, setStatusTab] = useState<"all" | "sent" | "viewed" | "approved" | "delivered" | "rejected">("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);

  const fetchOrders = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiFetch("/api/distributor/orders?limit=100", { method: "GET", token });
      if (res.ok) {
        const json = await res.json();
        setOrders(json.data || []);
      }
    } catch (err) {
      console.error("Erro ao carregar pedidos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [token]);

  const updateStatus = async (orderId: string, newStatus: string) => {
    if (!token || updatingId) return;
    setUpdatingId(orderId);
    try {
      const res = await apiFetch(`/api/distributor/orders/${orderId}/status`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: newStatus as any } : o))
        );
        if (selectedOrder?.id === orderId) {
          setSelectedOrder((prev) => (prev ? { ...prev, status: newStatus as any } : null));
        }
      }
    } catch (err) {
      console.error("Erro ao atualizar status:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchesStatus = statusTab === "all" ? true : o.status === statusTab;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        o.client.company_name.toLowerCase().includes(q) ||
        o.client.cnpj.includes(q) ||
        o.client.delivery_city.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [orders, statusTab, searchQuery]);

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F7FB]">
      <Navbar />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {/* Cabeçalho */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <button
              onClick={() => router.push("/painel")}
              className="mb-2 flex items-center gap-1 text-xs font-bold text-[#2563EB] hover:underline"
            >
              <ArrowLeft size={14} /> Voltar ao Painel
            </button>
            <h1 className="text-2xl font-black text-[#0F172A]">Todos os Pedidos Recebidos</h1>
            <p className="text-xs text-slate-500">
              Gerencie e atualize os status dos pedidos de cotação dos seus clientes.
            </p>
          </div>
        </div>

        {/* Filtros e Busca */}
        <div className="mb-6 rounded-3xl border border-[#DBEAFE] bg-white p-4 shadow-sm space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Campo de busca */}
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por cliente, CNPJ ou cidade..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl border border-[#DBEAFE] bg-[#F5F7FB] pl-10 pr-4 py-2.5 text-sm text-[#0F172A] placeholder:text-slate-400 outline-none focus:border-[#2563EB] focus:bg-white transition-colors"
              />
            </div>
          </div>

          {/* Abas de status */}
          <div className="flex border-t border-slate-100 pt-3 gap-2 overflow-x-auto scrollbar-none">
            {[
              { id: "all", label: "Todos", count: orders.length },
              { id: "sent", label: "Aguardando", count: orders.filter((o) => o.status === "sent").length },
              { id: "viewed", label: "Em Preparo", count: orders.filter((o) => o.status === "viewed").length },
              { id: "approved", label: "Em Entrega", count: orders.filter((o) => o.status === "approved").length },
              { id: "delivered", label: "Entregues", count: orders.filter((o) => o.status === "delivered").length },
              { id: "rejected", label: "Recusados", count: orders.filter((o) => o.status === "rejected").length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusTab(tab.id as any)}
                className={`rounded-xl px-3 py-2 text-xs font-bold transition-all whitespace-nowrap ${
                  statusTab === tab.id
                    ? "bg-[#0F172A] text-white shadow-sm"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.label}
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  statusTab === tab.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Lista de Pedidos */}
        {loading ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-3xl border border-[#DBEAFE] bg-white">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2563EB] border-t-transparent mb-3" />
            <p className="text-xs font-semibold text-slate-500">Carregando pedidos...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-3xl border border-[#DBEAFE] bg-white p-8 text-center">
            <Clock size={36} className="text-slate-300 mb-2" />
            <p className="text-base font-bold text-[#0F172A]">Nenhum pedido encontrado</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Não há pedidos correspondentes ao filtro selecionado.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const elapsed = getOrderElapsedBadge(order.sent_at, order.status);
              const items = (order.items_snapshot as unknown as OrderItemSnapshot[]) || [];

              return (
                <div
                  key={order.id}
                  className="rounded-3xl border border-[#DBEAFE] bg-white p-6 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-base font-bold text-[#0F172A]">{order.client.company_name}</h3>
                        <span className="text-xs text-slate-400">· CNPJ {order.client.cnpj}</span>
                      </div>

                      <p className="text-xs text-slate-500">
                        {order.client.delivery_city} — {order.client.delivery_state} · Recebido em{" "}
                        <span className="font-mono font-medium">{formatDateTime(order.sent_at)}</span>
                      </p>

                      {elapsed && (
                        <div className="mt-2">
                          <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-bold ${elapsed.color}`}>
                            {elapsed.label}
                          </span>
                        </div>
                      )}

                      {/* Lista resumida de itens */}
                      <div className="mt-3 rounded-2xl bg-[#F8FAFC] p-3 border border-slate-100">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                          {items.length} produto(s) no pedido
                        </p>
                        <div className="space-y-1">
                          {items.slice(0, 3).map((item, idx) => (
                            <p key={idx} className="text-xs text-slate-700 font-medium">
                              • {item.product_name} <span className="text-slate-400">× {item.quantity} ({formatBRL(item.unit_price_cents)}/un)</span>
                            </p>
                          ))}
                          {items.length > 3 && (
                            <p className="text-[11px] font-semibold text-[#2563EB]">
                              + e mais {items.length - 3} item(ns)...
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Preço e Ações */}
                    <div className="flex flex-col items-end gap-3 shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-lg font-extrabold text-[#0F172A]">
                          {formatBRL(order.total_cents)}
                        </span>
                        <Badge variant={STATUS_BADGE[order.status] ?? "gray"}>
                          {STATUS_LABEL[order.status] ?? order.status}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition flex items-center gap-1 shadow-xs"
                        >
                          <Eye size={13} /> Ver detalhes
                        </button>

                        {order.status === "sent" && (
                          <>
                            <button
                              disabled={updatingId === order.id}
                              onClick={() => updateStatus(order.id, "viewed")}
                              className="rounded-xl bg-green-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-1 shadow-xs"
                            >
                              <Check size={13} /> Aceitar
                            </button>
                            <button
                              disabled={updatingId === order.id}
                              onClick={() => updateStatus(order.id, "rejected")}
                              className="rounded-xl bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 text-xs font-bold hover:bg-red-100 disabled:opacity-50 flex items-center gap-1 shadow-xs"
                            >
                              <X size={13} /> Recusar
                            </button>
                          </>
                        )}

                        {order.status === "viewed" && (
                          <button
                            disabled={updatingId === order.id}
                            onClick={() => updateStatus(order.id, "approved")}
                            className="rounded-xl bg-[#2563EB] text-white px-3.5 py-1.5 text-xs font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1 shadow-xs"
                          >
                            <Check size={13} /> Em Entrega
                          </button>
                        )}

                        {order.status === "approved" && (
                          <button
                            disabled={updatingId === order.id}
                            onClick={() => updateStatus(order.id, "delivered")}
                            className="rounded-xl bg-slate-900 text-white px-3.5 py-1.5 text-xs font-bold hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1 shadow-xs"
                          >
                            <CheckCircle size={13} /> Confirmar Entregue
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal de Detalhes do Pedido */}
        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl max-h-[90vh] flex flex-col">
              <div className="flex items-start justify-between border-b border-slate-100 pb-4 mb-4">
                <div>
                  <h3 className="text-base font-bold text-[#0F172A]">Detalhes do Pedido</h3>
                  <p className="text-xs text-slate-400 mt-0.5">ID: {selectedOrder.id}</p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                <div className="flex items-center justify-between bg-[#F8FAFC] p-4 rounded-2xl border border-slate-100">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Status</span>
                    <Badge variant={STATUS_BADGE[selectedOrder.status] ?? "gray"}>
                      {STATUS_LABEL[selectedOrder.status] ?? selectedOrder.status}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Total</span>
                    <span className="font-mono text-xl font-bold text-[#0F172A]">
                      {formatBRL(selectedOrder.total_cents)}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Comprador e Entrega</p>
                  <p className="text-sm font-bold text-[#0F172A]">{selectedOrder.client.company_name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">CNPJ: {selectedOrder.client.cnpj}</p>
                  <p className="text-xs text-slate-500 mt-0.5">WhatsApp: {selectedOrder.client.whatsapp}</p>
                  <div className="mt-2 rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Endereço de Entrega do Estabelecimento</p>
                    <p className="text-xs font-semibold text-[#0F172A] mt-0.5">
                      {selectedOrder.client.delivery_address_full || `${selectedOrder.client.delivery_city} - ${selectedOrder.client.delivery_state}`}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Produtos</p>
                  <div className="divide-y divide-slate-100">
                    {((selectedOrder.items_snapshot as unknown as OrderItemSnapshot[]) || []).map((item, idx) => (
                      <div key={idx} className="py-2 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-semibold text-[#0F172A]">{item.product_name}</p>
                          <p className="text-slate-400">{item.brand} {item.packaging ? `· ${item.packaging}` : ""}</p>
                        </div>
                        <div className="text-right font-mono">
                          <p className="font-bold">{item.quantity}x {formatBRL(item.unit_price_cents)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 mt-4 flex justify-end">
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="rounded-2xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
