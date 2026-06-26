"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/Button";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";
import {
  ShoppingCart, FileText, CheckCircle, Clock, XCircle,
  Package, TrendingDown, Bell,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  data: Record<string, string | number | boolean | null> | null;
  created_at: string;
};

type Pagination = {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
};

// ─── Constantes ───────────────────────────────────────────────────────────────

const LIMIT = 20;

function NotifIcon({ type }: { type: string }) {
  const props = { size: 18, className: "shrink-0" };
  switch (type) {
    case "new_order":                 return <ShoppingCart {...props} />;
    case "new_credential_request":    return <FileText {...props} />;
    case "credential_auto_approved":  return <CheckCircle {...props} className="shrink-0 text-green-600" />;
    case "credential_pending_review": return <Clock {...props} className="shrink-0 text-amber-500" />;
    case "credential_approved":       return <CheckCircle {...props} className="shrink-0 text-green-600" />;
    case "credential_rejected":       return <XCircle {...props} className="shrink-0 text-red-500" />;
    case "order_status_updated":      return <Package {...props} />;
    case "price_drop":                return <TrendingDown {...props} className="shrink-0 text-green-600" />;
    default:                          return <Bell {...props} />;
  }
}

const TYPE_OPTIONS = [
  { value: "",                        label: "Todos os tipos" },
  { value: "new_order",               label: "Nova cotação" },
  { value: "new_credential_request",  label: "Ficha cadastral" },
  { value: "credential_auto_approved",label: "Cliente aprovado" },
  { value: "credential_pending_review",label: "Revisão manual" },
  { value: "order_status_updated",    label: "Status do pedido" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return "agora mesmo";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function NotificacoesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const token = useApiToken();

  const role = (session?.user as { role?: string })?.role ?? "";

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  // Filtros
  const [filterType, setFilterType] = useState("");
  const [filterUnread, setFilterUnread] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/login");
    if (status === "authenticated" && role &&
        !["distributor_admin", "distributor_collaborator"].includes(role)) {
      router.push("/painel");
    }
  }, [status, role, router]);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page:  String(page),
        limit: String(LIMIT),
        ...(filterUnread ? { unread_only: "true" } : {}),
        ...(filterType   ? { type: filterType }    : {}),
      });
      const res = await apiFetch(`/api/notifications?${params}`, { method: "GET", token });
      if (!res.ok) return;
      const json = await res.json() as {
        data: Notification[];
        unread_count: number;
        pagination: Pagination;
      };
      setNotifications(json.data);
      setUnreadCount(json.unread_count);
      setPagination(json.pagination);
    } finally {
      setLoading(false);
    }
  }, [token, page, filterType, filterUnread]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Reset para página 1 ao mudar filtros
  useEffect(() => { setPage(1); }, [filterType, filterUnread]);

  async function markAllRead() {
    if (!token || markingAll) return;
    setMarkingAll(true);
    try {
      await apiFetch("/api/notifications", {
        method: "PATCH", token, body: JSON.stringify({ all: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } finally {
      setMarkingAll(false);
    }
  }

  async function markOneRead(id: string) {
    if (!token) return;
    apiFetch("/api/notifications", {
      method: "PATCH", token, body: JSON.stringify({ ids: [id] }),
    }).catch(() => {});
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  if (status === "loading") {
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

      <main className="mx-auto w-full max-w-2xl px-4 py-10">

        {/* Cabeçalho */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-display font-bold text-[#0F172A]">Notificações</h1>
            {unreadCount > 0 && (
              <p className="mt-0.5 text-sm text-slate-500">
                {unreadCount} não lida{unreadCount !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          {unreadCount > 0 && (
            <Button variant="secondary" size="sm" loading={markingAll} onClick={markAllRead}>
              Marcar todas como lidas
            </Button>
          )}
        </div>

        {/* Filtros */}
        <div className="mb-5 flex flex-wrap gap-3">
          {/* Tipo */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-xl border border-[#DBEAFE] bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Lida / Não lida */}
          <div className="flex gap-1 rounded-xl border border-[#DBEAFE] bg-white p-1">
            {[
              { label: "Todas", value: false },
              { label: "Não lidas", value: true },
            ].map((opt) => (
              <button
                key={String(opt.value)}
                onClick={() => setFilterUnread(opt.value)}
                className={[
                  "rounded-lg px-3 py-1 text-sm font-medium transition-all",
                  filterUnread === opt.value
                    ? "bg-[#0F172A] text-white"
                    : "text-slate-500 hover:text-[#0F172A]",
                ].join(" ")}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-7 w-7 animate-spin rounded-full border-4 border-[#22C55E] border-t-transparent" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-2xl border border-[#DBEAFE] bg-white px-6 py-16 text-center">
            <Bell size={32} className="text-slate-300" />
            <p className="mt-3 font-medium text-slate-700">
              {filterType || filterUnread ? "Nenhuma notificação para este filtro" : "Nenhuma notificação ainda"}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Novas notificações aparecem aqui em tempo real.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#DBEAFE] bg-white divide-y divide-[#DBEAFE]">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={[
                  "flex items-start gap-4 px-5 py-4 transition-colors",
                  !n.read ? "border-l-4 border-[#2563EB] bg-[#EFF6FF]/40" : "border-l-4 border-transparent",
                ].join(" ")}
              >
                {/* Ícone */}
                <span className="mt-0.5 shrink-0 text-slate-500">
                  <NotifIcon type={n.type} />
                </span>

                {/* Conteúdo */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-semibold leading-snug ${n.read ? "text-slate-700" : "text-[#0F172A]"}`}>
                      {n.title}
                    </p>
                    {!n.read && (
                      <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[#2563EB]" />
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">{n.body}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="text-[11px] text-slate-400">{formatDate(n.created_at)}</span>
                    {!n.read && (
                      <button
                        onClick={() => markOneRead(n.id)}
                        className="text-[11px] font-medium text-[#2563EB] hover:underline"
                      >
                        Marcar lida
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Paginação */}
        {pagination && pagination.total_pages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-3">
            <Button
              variant="secondary" size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Anterior
            </Button>
            <span className="text-sm text-slate-500">
              {page} / {pagination.total_pages}
            </span>
            <Button
              variant="secondary" size="sm"
              disabled={page === pagination.total_pages}
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
