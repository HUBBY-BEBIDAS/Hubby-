"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Navbar } from "@/components/Navbar";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";
import {
  Megaphone, Star, TrendingUp, Package, BarChart2,
  Plus, Trash2, Eye, MousePointer, CheckCircle, Clock, XCircle,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type SponsoredSlot = {
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
  payment_status: "ativo" | "pendente_pagamento" | "expirado";
  product: { id: string; name: string; brand: string } | null;
};

type Region = { city: string; state: string };

type NewSlotForm = {
  slot_type: "top_ranking" | "category_highlight" | "search_boost";
  region_city: string;
  region_state: string;
  days: number;
  budget_cents: number;
};

// ─── Constantes ───────────────────────────────────────────────────────────────

const SLOT_LABELS = {
  top_ranking:        { label: "Destaque no ranking",    icon: <TrendingUp size={16} />, price: 299 },
  category_highlight: { label: "Destaque por categoria", icon: <Star size={16} />,       price: 199 },
  search_boost:       { label: "Destaque por produto",   icon: <Package size={16} />,    price: 99  },
};

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function PatrocinioPage() {
  useSession({ required: true });
  const token = useApiToken();

  const [slots,    setSlots]    = useState<SponsoredSlot[]>([]);
  const [regions,  setRegions]  = useState<Region[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [form, setForm] = useState<NewSlotForm>({
    slot_type:    "top_ranking",
    region_city:  "",
    region_state: "",
    days:         30,
    budget_cents: 29900,
  });

  useEffect(() => {
    if (!token) return;
    Promise.all([
      apiFetch("/api/distributor/sponsored-slots", { method: "GET", token }),
      apiFetch("/api/distributor/delivery-regions", { method: "GET", token }),
    ]).then(async ([sRes, rRes]) => {
      const sData = await sRes.json() as { slots: SponsoredSlot[] };
      const rData = await rRes.json() as { regions: { city: string; state: string }[] };
      setSlots(sData.slots ?? []);
      setRegions(rData.regions ?? []);
      if (rData.regions?.length > 0) {
        setForm((f) => ({ ...f, region_city: rData.regions[0].city, region_state: rData.regions[0].state }));
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  async function handleCreate() {
    if (!token || !form.region_city) return;
    setSaving(true);
    try {
      const now      = new Date();
      const starts   = now.toISOString();
      const ends     = new Date(now.getTime() + form.days * 24 * 3600 * 1000).toISOString();
      const res = await apiFetch("/api/distributor/sponsored-slots", {
        method: "POST",
        token,
        body: JSON.stringify({
          slot_type:    form.slot_type,
          region_city:  form.region_city,
          region_state: form.region_state,
          starts_at:    starts,
          ends_at:      ends,
          budget_cents: form.budget_cents,
        }),
      });
      const data = await res.json() as { slot: SponsoredSlot };
      if (res.ok) {
        setSlots((prev) => [{ ...data.slot, payment_status: "pendente_pagamento" }, ...prev]);
        setShowForm(false);
      }
    } catch { /* silencia */ }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    setDeleting(id);
    try {
      await apiFetch(`/api/distributor/sponsored-slots/${id}`, { method: "DELETE", token });
      setSlots((prev) => prev.filter((s) => s.id !== id));
    } catch { /* silencia */ }
    finally { setDeleting(null); }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#F5F7FB]">
      <Navbar />
      <main className="mx-auto w-full max-w-4xl px-4 py-8">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-[#0F172A]">
              <Megaphone size={22} className="text-[#2563EB]" />Promover minha distribuidora
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Apareça em destaque para compradores da sua região e aumente suas cotações recebidas.
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1D4ED8]"
          >
            <Plus size={15} />Novo patrocínio
          </button>
        </div>

        {/* Tabela de preços */}
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {(Object.entries(SLOT_LABELS) as [keyof typeof SLOT_LABELS, typeof SLOT_LABELS[keyof typeof SLOT_LABELS]][]).map(([key, val]) => (
            <div key={key} className="rounded-2xl border border-[#DBEAFE] bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-[#2563EB]">{val.icon}<p className="text-xs font-bold">{val.label}</p></div>
              <p className="mt-2 text-2xl font-black text-[#0F172A]">R$ {val.price}<span className="text-xs font-normal text-slate-400">/mês</span></p>
              <p className="mt-0.5 text-[11px] text-slate-400">por região de entrega</p>
            </div>
          ))}
        </div>

        {/* Formulário de criação */}
        {showForm && (
          <div className="mb-6 rounded-2xl border border-[#DBEAFE] bg-white p-5 shadow-sm">
            <p className="mb-4 text-sm font-semibold text-[#0F172A]">Configurar novo patrocínio</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Tipo de destaque</label>
                <select
                  value={form.slot_type}
                  onChange={(e) => {
                    const t = e.target.value as NewSlotForm["slot_type"];
                    setForm((f) => ({ ...f, slot_type: t, budget_cents: SLOT_LABELS[t].price * 100 }));
                  }}
                  className="w-full rounded-xl border border-[#DBEAFE] bg-[#F5F7FB] px-3 py-2.5 text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                >
                  {Object.entries(SLOT_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label} — R$ {v.price}/mês</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Região de exibição</label>
                <select
                  value={`${form.region_city}|${form.region_state}`}
                  onChange={(e) => {
                    const [city, state] = e.target.value.split("|");
                    setForm((f) => ({ ...f, region_city: city, region_state: state }));
                  }}
                  className="w-full rounded-xl border border-[#DBEAFE] bg-[#F5F7FB] px-3 py-2.5 text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                >
                  {regions.map((r) => (
                    <option key={`${r.city}|${r.state}`} value={`${r.city}|${r.state}`}>{r.city}, {r.state}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Período</label>
                <select
                  value={form.days}
                  onChange={(e) => {
                    const days  = parseInt(e.target.value);
                    const month = Math.round(days / 30);
                    setForm((f) => ({ ...f, days, budget_cents: SLOT_LABELS[f.slot_type].price * 100 * month }));
                  }}
                  className="w-full rounded-xl border border-[#DBEAFE] bg-[#F5F7FB] px-3 py-2.5 text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                >
                  <option value={7}>7 dias</option>
                  <option value={15}>15 dias</option>
                  <option value={30}>30 dias</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Investimento total</label>
                <div className="rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] px-3 py-2.5 text-sm font-black text-[#2563EB]">
                  {formatBRL(form.budget_cents)}
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleCreate}
                disabled={saving || !form.region_city}
                className="rounded-xl bg-[#0F172A] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#1E293B] disabled:opacity-60"
              >
                {saving ? "Solicitando…" : "Solicitar patrocínio"}
              </button>
              <button onClick={() => setShowForm(false)} className="text-sm text-slate-400 hover:text-slate-600">Cancelar</button>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Após solicitar, nossa equipe entrará em contato via e-mail para confirmar o pagamento e ativar o destaque.
            </p>
          </div>
        )}

        {/* Lista de slots */}
        {loading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-[#DBEAFE]/40" />)}</div>
        ) : slots.length === 0 ? (
          <div className="rounded-2xl border border-[#DBEAFE] bg-white px-6 py-14 text-center">
            <Megaphone size={32} className="mx-auto text-slate-200" />
            <p className="mt-3 font-semibold text-slate-700">Nenhum patrocínio ainda</p>
            <p className="mt-1 text-sm text-slate-400">Crie seu primeiro destaque para aparecer no topo do ranking.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {slots.map((slot) => {
              const meta  = SLOT_LABELS[slot.slot_type];
              const ended = new Date(slot.ends_at) < new Date();
              return (
                <div key={slot.id} className="rounded-2xl border border-[#DBEAFE] bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">{meta.icon}</div>
                      <div>
                        <p className="text-sm font-semibold text-[#0F172A]">{meta.label}</p>
                        <p className="text-xs text-slate-400">{slot.region_city}, {slot.region_state}</p>
                        <p className="text-[11px] text-slate-400">{formatDate(slot.starts_at)} → {formatDate(slot.ends_at)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Status badge */}
                      {slot.active && !ended ? (
                        <span className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-bold text-green-700">
                          <CheckCircle size={11} />Ativo
                        </span>
                      ) : slot.payment_status === "pendente_pagamento" ? (
                        <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                          <Clock size={11} />Aguardando pagamento
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">
                          <XCircle size={11} />Expirado
                        </span>
                      )}

                      {!slot.active && (
                        <button
                          onClick={() => handleDelete(slot.id)}
                          disabled={deleting === slot.id}
                          className="text-slate-300 hover:text-red-500 disabled:opacity-50"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Métricas */}
                  {slot.active && (
                    <div className="mt-4 flex gap-5 border-t border-[#DBEAFE] pt-4">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Eye size={13} className="text-[#2563EB]" />
                        <strong className="text-[#0F172A]">{slot.impressions.toLocaleString("pt-BR")}</strong> impressões
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <MousePointer size={13} className="text-[#2563EB]" />
                        <strong className="text-[#0F172A]">{slot.clicks.toLocaleString("pt-BR")}</strong> cliques
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <BarChart2 size={13} className="text-[#2563EB]" />
                        CTR: <strong className="text-[#0F172A]">{slot.impressions > 0 ? ((slot.clicks / slot.impressions) * 100).toFixed(1) : "0.0"}%</strong>
                      </div>
                      <div className="ml-auto text-xs text-slate-500">
                        Investimento: <strong className="text-[#0F172A]">{formatBRL(slot.budget_cents)}</strong>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* CTA para falar com vendas */}
        <div className="mt-8 rounded-2xl border border-[#DBEAFE] bg-white p-5 text-center">
          <p className="text-sm font-semibold text-[#0F172A]">Quer um pacote personalizado?</p>
          <p className="mt-1 text-xs text-slate-400">Nossa equipe comercial pode criar uma proposta sob medida para o seu volume.</p>
          <a
            href="mailto:comercial@hubby.com.br?subject=Patrocínio Hubby"
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#1D4ED8]"
          >
            Falar com a equipe comercial →
          </a>
        </div>

      </main>
    </div>
  );
}
