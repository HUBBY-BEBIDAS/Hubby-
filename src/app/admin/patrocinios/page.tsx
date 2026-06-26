"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Navbar } from "@/components/Navbar";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";
import { Megaphone, Eye, MousePointer, CheckCircle, Clock, XCircle, TrendingUp } from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type AdminSlot = {
  id: string;
  slot_type: "top_ranking" | "category_highlight" | "search_boost";
  region_city: string;
  region_state: string;
  starts_at: string;
  ends_at: string;
  budget_cents: number;
  impressions: number;
  clicks: number;
  active: boolean;
  created_at: string;
  distributor: { id: string; company_name: string; plan: string };
  product: { id: string; name: string; brand: string } | null;
};

const SLOT_LABELS = {
  top_ranking:        "Destaque no ranking",
  category_highlight: "Destaque por categoria",
  search_boost:       "Destaque por produto",
};

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function AdminPatrociniosPage() {
  useSession({ required: true });
  const token = useApiToken();

  const [slots,    setSlots]    = useState<AdminSlot[]>([]);
  const [revenue,  setRevenue]  = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [filter,   setFilter]   = useState<"all" | "active" | "pending">("all");

  useEffect(() => {
    if (!token) return;
    apiFetch("/api/admin/patrocinios", { method: "GET", token })
      .then(async (res) => {
        const data = await res.json() as { slots: AdminSlot[]; revenue_this_month_cents: number };
        setSlots(data.slots ?? []);
        setRevenue(data.revenue_this_month_cents ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  async function toggleActive(id: string, active: boolean) {
    if (!token) return;
    setToggling(id);
    try {
      const res = await apiFetch(`/api/admin/patrocinios/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ active }),
      });
      const data = await res.json() as { slot: AdminSlot };
      if (res.ok) setSlots((prev) => prev.map((s) => s.id === id ? { ...s, active: data.slot.active } : s));
    } catch { /* silencia */ }
    finally { setToggling(null); }
  }

  const now           = new Date();
  const filtered      = slots.filter((s) => {
    if (filter === "active")  return s.active && new Date(s.ends_at) > now;
    if (filter === "pending") return !s.active && new Date(s.ends_at) > now;
    return true;
  });

  const activeCount  = slots.filter((s) => s.active && new Date(s.ends_at) > now).length;
  const pendingCount = slots.filter((s) => !s.active && new Date(s.ends_at) > now).length;

  return (
    <div className="min-h-screen bg-[#F5F7FB]">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#0F172A]">
            <Megaphone size={22} className="text-[#2563EB]" />Patrocínios
          </h1>
          <p className="mt-1 text-sm text-slate-500">Gerencie os slots patrocinados de todas as distribuidoras.</p>
        </div>

        {/* Métricas resumo */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-[#DBEAFE] bg-white p-4 text-center shadow-sm">
            <p className="text-2xl font-black text-[#0F172A]">{activeCount}</p>
            <p className="mt-0.5 text-xs text-slate-500">slots ativos</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center shadow-sm">
            <p className="text-2xl font-black text-amber-700">{pendingCount}</p>
            <p className="mt-0.5 text-xs text-slate-500">aguardando ativação</p>
          </div>
          <div className="rounded-2xl border border-[#DBEAFE] bg-white p-4 text-center shadow-sm">
            <p className="text-2xl font-black text-[#0F172A]">
              {slots.reduce((s, sl) => s + sl.impressions, 0).toLocaleString("pt-BR")}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">impressões totais</p>
          </div>
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-center shadow-sm">
            <p className="text-lg font-black text-green-700">{formatBRL(revenue)}</p>
            <p className="mt-0.5 text-xs text-slate-500">receita este mês</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="mb-4 flex gap-2">
          {(["all", "active", "pending"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={[
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                filter === f ? "bg-[#2563EB] text-white" : "border border-[#DBEAFE] bg-white text-slate-600 hover:bg-[#EFF6FF]",
              ].join(" ")}
            >
              {f === "all" ? "Todos" : f === "active" ? `Ativos (${activeCount})` : `Pendentes (${pendingCount})`}
            </button>
          ))}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-[#DBEAFE]/40" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-[#DBEAFE] bg-white px-6 py-14 text-center">
            <Megaphone size={32} className="mx-auto text-slate-200" />
            <p className="mt-3 text-sm text-slate-400">Nenhum patrocínio encontrado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((slot) => {
              const ended = new Date(slot.ends_at) < now;
              return (
                <div key={slot.id} className="rounded-2xl border border-[#DBEAFE] bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[#0F172A]">{slot.distributor.company_name}</p>
                        <span className="rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-bold text-[#2563EB]">
                          {slot.distributor.plan}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{SLOT_LABELS[slot.slot_type]}</p>
                      <p className="text-[11px] text-slate-400">
                        {slot.region_city}, {slot.region_state} · {formatDate(slot.starts_at)} → {formatDate(slot.ends_at)}
                      </p>
                      {slot.product && (
                        <p className="text-[11px] text-slate-400">Produto: {slot.product.name} — {slot.product.brand}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Status */}
                      {slot.active && !ended ? (
                        <span className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-bold text-green-700">
                          <CheckCircle size={11} />Ativo
                        </span>
                      ) : ended ? (
                        <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-500">
                          <XCircle size={11} />Expirado
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                          <Clock size={11} />Pendente
                        </span>
                      )}

                      {/* Toggle */}
                      {!ended && (
                        <button
                          onClick={() => toggleActive(slot.id, !slot.active)}
                          disabled={toggling === slot.id}
                          className={[
                            "relative h-6 w-11 rounded-full transition-colors disabled:opacity-60",
                            slot.active ? "bg-green-500" : "bg-slate-300",
                          ].join(" ")}
                        >
                          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${slot.active ? "translate-x-5 left-0.5" : "left-0.5"}`} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Métricas */}
                  <div className="mt-4 flex flex-wrap gap-5 border-t border-[#DBEAFE] pt-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Eye size={12} className="text-[#2563EB]" />
                      <strong className="text-[#0F172A]">{slot.impressions.toLocaleString("pt-BR")}</strong> impressões
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <MousePointer size={12} className="text-[#2563EB]" />
                      <strong className="text-[#0F172A]">{slot.clicks.toLocaleString("pt-BR")}</strong> cliques
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <TrendingUp size={12} className="text-[#2563EB]" />
                      CTR: <strong className="text-[#0F172A]">{slot.impressions > 0 ? ((slot.clicks / slot.impressions) * 100).toFixed(1) : "0.0"}%</strong>
                    </div>
                    <div className="ml-auto text-xs font-semibold text-green-700">
                      {formatBRL(slot.budget_cents)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </main>
    </div>
  );
}
