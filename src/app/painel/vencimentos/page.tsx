"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";
import {
  Lock, Clock, AlertTriangle, CheckCircle, XCircle,
  Calendar, Percent, ChevronDown, ChevronUp, RefreshCw,
  Package,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ExpiryProduct = {
  id: string;
  name: string;
  brand: string;
  category: string;
  packaging_type: string;
  packaging_volume_ml: number;
  price_cents: number;
  available: boolean;
  image_url: string | null;
  expiry_date: string | null;
  expiry_alert_days: number;
  expiry_discount_pct: number | null;
  is_near_expiry: boolean;
  days_left: number | null;
  expiry_status: "ok" | "attention" | "urgent" | "expired";
};

type EditingState = {
  expiry_date: string;
  expiry_alert_days: number;
  expiry_discount_pct: number;
  auto_discount: boolean;
};

type PlanData = {
  plan: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function statusConfig(status: ExpiryProduct["expiry_status"]) {
  switch (status) {
    case "urgent":
      return { label: "Urgente", icon: <XCircle size={14} />, cls: "bg-red-100 text-red-700" };
    case "attention":
      return { label: "Atenção", icon: <AlertTriangle size={14} />, cls: "bg-amber-100 text-amber-700" };
    case "expired":
      return { label: "Vencido", icon: <XCircle size={14} />, cls: "bg-slate-100 text-slate-600" };
    default:
      return { label: "OK", icon: <CheckCircle size={14} />, cls: "bg-green-100 text-green-700" };
  }
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function VencimentosPage() {
  useSession({ required: true });
  const token  = useRouter();
  const apiToken = useApiToken();
  void token;

  const [plan, setPlan]         = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [products, setProducts] = useState<ExpiryProduct[]>([]);
  const [loading, setLoading]   = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing]   = useState<Record<string, EditingState>>({});
  const [saving, setSaving]     = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Carrega plano da distribuidora
  useEffect(() => {
    if (!apiToken) return;
    apiFetch("/api/distributor/dashboard", { method: "GET", token: apiToken })
      .then((r: Response) => r.json())
      .then((d: PlanData) => setPlan(d.plan ?? null))
      .catch(() => setPlan(null))
      .finally(() => setPlanLoading(false));
  }, [apiToken]);

  const fetchProducts = () => {
    if (!apiToken || plan !== "enterprise") return;
    setLoading(true);
    apiFetch("/api/distributor/products/expiry", { method: "GET", token: apiToken })
      .then((r: Response) => r.json())
      .then((d: { products: ExpiryProduct[] }) => setProducts(d.products ?? []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProducts(); }, [apiToken, plan]); // eslint-disable-line react-hooks/exhaustive-deps

  function startEditing(p: ExpiryProduct) {
    setEditing((prev) => ({
      ...prev,
      [p.id]: {
        expiry_date:        toDateInputValue(p.expiry_date),
        expiry_alert_days:  p.expiry_alert_days,
        expiry_discount_pct: p.expiry_discount_pct ?? 10,
        auto_discount:      p.expiry_discount_pct !== null,
      },
    }));
    setExpanded(p.id);
  }

  async function saveExpiry(productId: string) {
    if (!apiToken) return;
    const form = editing[productId];
    if (!form) return;

    setSaving(productId);
    try {
      const body: Record<string, unknown> = {
        expiry_date:       form.expiry_date ? new Date(form.expiry_date).toISOString() : null,
        expiry_alert_days: form.expiry_alert_days,
        expiry_discount_pct: form.auto_discount ? form.expiry_discount_pct : null,
      };

      const res = await apiFetch(`/api/distributor/products/${productId}/expiry`, {
        method: "PATCH",
        token: apiToken,
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Erro ao salvar");

      setSuccessId(productId);
      if (successTimer.current) clearTimeout(successTimer.current);
      successTimer.current = setTimeout(() => setSuccessId(null), 2500);

      setExpanded(null);
      fetchProducts();
    } catch {
      // silencia — usuário tenta novamente
    } finally {
      setSaving(null);
    }
  }

  // ── Gating ──────────────────────────────────────────────────────────────────

  if (planLoading) {
    return (
      <div className="min-h-screen bg-[#F5F7FB]">
        <Navbar />
        <main className="mx-auto w-full max-w-5xl px-4 py-10">
          <div className="h-8 w-64 animate-pulse rounded-xl bg-slate-200" />
        </main>
      </div>
    );
  }

  if (plan !== "enterprise") {
    return (
      <div className="min-h-screen bg-[#F5F7FB]">
        <Navbar />
        <main className="mx-auto w-full max-w-3xl px-4 py-16">
          <div className="flex flex-col items-center gap-6 rounded-2xl border border-[#DBEAFE] bg-white px-8 py-14 text-center shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F5F7FB]">
              <Lock size={28} className="text-slate-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#0F172A]">Gestão automática de vencimentos</h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-500">
                Integra com seu ERP e cria promoções automaticamente antes do estoque vencer.
                Nunca mais perca dinheiro com produto vencido.
              </p>
            </div>
            <ul className="mt-2 space-y-2.5 text-left text-sm text-slate-600">
              {[
                "Cron diário detecta vencimentos e ativa descontos automaticamente",
                "Notifica compradores da região quando urgente",
                "Integração via webhook com seu sistema de gestão (ERP)",
                "Controle total: data, janela de alerta e percentual de desconto por produto",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <CheckCircle size={14} className="mt-0.5 shrink-0 text-[#22C55E]" />
                  {f}
                </li>
              ))}
            </ul>
            <a
              href="mailto:comercial@hubby.com.br?subject=Interesse no plano Enterprise"
              className="mt-2 rounded-xl bg-[#0F172A] px-8 py-3 text-sm font-bold text-white transition hover:bg-[#1E293B]"
            >
              Conhecer o plano Enterprise →
            </a>
          </div>
        </main>
      </div>
    );
  }

  // ── Contadores de status ─────────────────────────────────────────────────────
  const urgentCount    = products.filter((p) => p.expiry_status === "urgent").length;
  const attentionCount = products.filter((p) => p.expiry_status === "attention").length;
  const withDateCount  = products.filter((p) => p.expiry_date !== null).length;

  return (
    <div className="min-h-screen bg-[#F5F7FB]">
      <Navbar />

      <main className="mx-auto w-full max-w-5xl px-4 py-8">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]">Gestão de Vencimentos</h1>
            <p className="mt-1 text-sm text-slate-500">
              Configure datas de vencimento e descontos automáticos por produto.
            </p>
          </div>
          <button
            onClick={fetchProducts}
            className="flex items-center gap-1.5 rounded-xl border border-[#DBEAFE] bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-[#2563EB]/40 hover:text-[#2563EB]"
          >
            <RefreshCw size={13} />Atualizar
          </button>
        </div>

        {/* Cards de resumo */}
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="rounded-2xl border border-[#DBEAFE] bg-white p-4 text-center shadow-sm">
            <p className="text-2xl font-black text-[#0F172A]">{withDateCount}</p>
            <p className="mt-0.5 text-xs text-slate-500">com data cadastrada</p>
          </div>
          <div className={`rounded-2xl border p-4 text-center shadow-sm ${attentionCount > 0 ? "border-amber-200 bg-amber-50" : "border-[#DBEAFE] bg-white"}`}>
            <p className={`text-2xl font-black ${attentionCount > 0 ? "text-amber-700" : "text-[#0F172A]"}`}>{attentionCount}</p>
            <p className="mt-0.5 text-xs text-slate-500">em atenção</p>
          </div>
          <div className={`rounded-2xl border p-4 text-center shadow-sm ${urgentCount > 0 ? "border-red-200 bg-red-50" : "border-[#DBEAFE] bg-white"}`}>
            <p className={`text-2xl font-black ${urgentCount > 0 ? "text-red-700" : "text-[#0F172A]"}`}>{urgentCount}</p>
            <p className="mt-0.5 text-xs text-slate-500">urgentes</p>
          </div>
        </div>

        {/* Lista de produtos */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-[#DBEAFE]/40" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-2xl border border-[#DBEAFE] bg-white px-6 py-16 text-center">
            <Package size={32} className="mx-auto text-slate-200" />
            <p className="mt-3 font-semibold text-slate-700">Nenhum produto cadastrado</p>
            <p className="mt-1 text-sm text-slate-400">Cadastre produtos para gerenciar seus vencimentos.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {products.map((p) => {
              const sc = statusConfig(p.expiry_status);
              const isExpanded = expanded === p.id;
              const form = editing[p.id];
              const isSaving = saving === p.id;
              const isSuccess = successId === p.id;

              return (
                <div
                  key={p.id}
                  className="rounded-2xl border border-[#DBEAFE] bg-white shadow-sm transition-all"
                >
                  {/* Linha principal */}
                  <button
                    onClick={() => isExpanded ? setExpanded(null) : startEditing(p)}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left"
                  >
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="h-12 w-12 shrink-0 rounded-xl object-contain bg-[#F5F7FB]" />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F5F7FB] text-slate-300">
                        <Package size={20} />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#0F172A]">{p.name}</p>
                      <p className="text-xs text-slate-400">{p.brand} · {formatBRL(p.price_cents)}</p>
                    </div>

                    {/* Status badge */}
                    <div className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${sc.cls}`}>
                      {sc.icon}
                      {sc.label}
                      {p.days_left !== null && p.days_left > 0 && (
                        <span className="ml-0.5">· {p.days_left}d</span>
                      )}
                    </div>

                    {/* Data de vencimento */}
                    {p.expiry_date ? (
                      <div className="hidden shrink-0 text-right sm:block">
                        <p className="text-[11px] text-slate-400">Vence em</p>
                        <p className="text-xs font-semibold text-[#0F172A]">
                          {new Date(p.expiry_date).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    ) : (
                      <span className="hidden shrink-0 text-[11px] text-slate-400 sm:block">sem data</span>
                    )}

                    {/* Desconto badge */}
                    {p.expiry_discount_pct !== null && (
                      <span className="hidden shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700 sm:block">
                        -{p.expiry_discount_pct}%
                      </span>
                    )}

                    {isExpanded ? <ChevronUp size={16} className="shrink-0 text-slate-400" /> : <ChevronDown size={16} className="shrink-0 text-slate-400" />}
                  </button>

                  {/* Painel de edição */}
                  {isExpanded && form && (
                    <div className="border-t border-[#DBEAFE] px-5 py-5">
                      <div className="grid gap-4 sm:grid-cols-2">

                        {/* Data de vencimento */}
                        <div>
                          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                            <Calendar size={13} />Data de vencimento do lote atual
                          </label>
                          <input
                            type="date"
                            value={form.expiry_date}
                            onChange={(e) => setEditing((prev) => ({ ...prev, [p.id]: { ...prev[p.id], expiry_date: e.target.value } }))}
                            className="w-full rounded-xl border border-[#DBEAFE] bg-[#F5F7FB] px-3 py-2.5 text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                          />
                        </div>

                        {/* Dias de alerta */}
                        <div>
                          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                            <Clock size={13} />Alertar com antecedência (dias)
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={365}
                            value={form.expiry_alert_days}
                            onChange={(e) => setEditing((prev) => ({ ...prev, [p.id]: { ...prev[p.id], expiry_alert_days: parseInt(e.target.value) || 30 } }))}
                            className="w-full rounded-xl border border-[#DBEAFE] bg-[#F5F7FB] px-3 py-2.5 text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                          />
                        </div>

                        {/* Auto-desconto toggle */}
                        <div className="sm:col-span-2">
                          <label className="flex cursor-pointer items-center gap-3">
                            <div
                              onClick={() => setEditing((prev) => ({ ...prev, [p.id]: { ...prev[p.id], auto_discount: !prev[p.id].auto_discount } }))}
                              className={`relative h-5 w-9 rounded-full transition-colors ${form.auto_discount ? "bg-[#22C55E]" : "bg-slate-200"}`}
                            >
                              <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.auto_discount ? "translate-x-4" : "translate-x-0.5"}`} />
                            </div>
                            <span className="text-xs font-semibold text-slate-700">
                              Ativar desconto automático quando próximo ao vencimento
                            </span>
                          </label>
                        </div>

                        {/* Slider de desconto */}
                        {form.auto_discount && (
                          <div className="sm:col-span-2">
                            <label className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-600">
                              <span className="flex items-center gap-1.5"><Percent size={13} />Percentual de desconto</span>
                              <span className="text-base font-black text-[#22C55E]">{form.expiry_discount_pct}%</span>
                            </label>
                            <input
                              type="range"
                              min={5}
                              max={50}
                              step={5}
                              value={form.expiry_discount_pct}
                              onChange={(e) => setEditing((prev) => ({ ...prev, [p.id]: { ...prev[p.id], expiry_discount_pct: parseInt(e.target.value) } }))}
                              className="w-full accent-[#22C55E]"
                            />
                            <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                              <span>5%</span><span>25%</span><span>50%</span>
                            </div>
                            <p className="mt-2 text-[11px] text-slate-500">
                              Preview: produto aparecerá por{" "}
                              <strong>{formatBRL(Math.round(p.price_cents * (1 - form.expiry_discount_pct / 100)))}</strong>
                              {" "}no catálogo (de {formatBRL(p.price_cents)})
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <button
                          onClick={() => setExpanded(null)}
                          className="rounded-xl border border-[#DBEAFE] px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-[#F5F7FB]"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => saveExpiry(p.id)}
                          disabled={isSaving}
                          className="flex items-center gap-1.5 rounded-xl bg-[#0F172A] px-5 py-2 text-xs font-bold text-white transition hover:bg-[#1E293B] disabled:opacity-60"
                        >
                          {isSaving ? <><RefreshCw size={12} className="animate-spin" />Salvando…</> : isSuccess ? <><CheckCircle size={12} />Salvo!</> : "Salvar configuração"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Rodapé: info sobre ERP */}
        <div className="mt-8 rounded-2xl border border-[#DBEAFE] bg-white p-5">
          <p className="text-xs font-bold text-[#0F172A]">Integração com ERP</p>
          <p className="mt-1 text-xs text-slate-500">
            Quando seu ERP recebe um novo lote, atualize a data de vencimento automaticamente via API:
          </p>
          <code className="mt-2 block rounded-lg bg-[#F5F7FB] px-3 py-2.5 text-[11px] text-slate-600 font-mono">
            POST /api/integrations/erp/batch{"\n"}
            Authorization: Bearer {"<sua-api-key>"}{"\n"}
            {"{"}"product_id": "…", "batch_number": "…", "expiry_date": "YYYY-MM-DD", "quantity": 100{"}"}
          </code>
          <p className="mt-2 text-[11px] text-slate-400">
            Configure sua API key em: Painel → Integrações → ERP
          </p>
        </div>

      </main>
    </div>
  );
}
