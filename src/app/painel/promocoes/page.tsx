"use client";

import { useEffect, useState, FormEvent } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";
import { Tag } from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ProductRef = {
  id: string;
  name: string;
  brand: string;
  packaging_type: string;
  packaging_volume_ml: number;
  price_cents: number;
  image_url: string | null;
};

type Promotion = {
  id: string;
  product_id: string;
  product: ProductRef;
  type: "percentage" | "fixed_price";
  discount_percentage: number | null;
  promotional_price_cents: number | null;
  starts_at: string;
  ends_at: string;
  description: string | null;
  active: boolean;
  is_active: boolean;
  is_scheduled: boolean;
  is_expired: boolean;
  created_at: string;
};

type PromoForm = {
  product_id: string;
  type: "percentage" | "fixed_price";
  discount_percentage: string;
  promotional_price_reais: string;
  starts_at: string;
  ends_at: string;
  description: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function toLocalDatetimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const EMPTY_FORM: PromoForm = {
  product_id: "",
  type: "percentage",
  discount_percentage: "",
  promotional_price_reais: "",
  starts_at: toLocalDatetimeString(new Date()),
  ends_at: toLocalDatetimeString(new Date(Date.now() + 7 * 86400_000)),
  description: "",
};

// ─── Modal nova promoção ──────────────────────────────────────────────────────

function PromoModal({ products, form, setForm, onSave, onClose, saving, error }: {
  products: ProductRef[];
  form: PromoForm;
  setForm: (f: PromoForm) => void;
  onSave: (e: FormEvent) => void;
  onClose: () => void;
  saving: boolean;
  error: string;
}) {
  const selectedProduct = products.find((p) => p.id === form.product_id);
  const previewCents = selectedProduct
    ? form.type === "percentage" && form.discount_percentage
      ? Math.round(selectedProduct.price_cents * (1 - parseFloat(form.discount_percentage) / 100))
      : form.type === "fixed_price" && form.promotional_price_reais
        ? Math.round(parseFloat(form.promotional_price_reais) * 100)
        : null
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-base font-display font-semibold text-[#0F172A]">Nova promoção</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={onSave} className="space-y-4">

          {/* Produto */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Produto *</label>
            <select
              required
              value={form.product_id}
              onChange={(e) => setForm({ ...form, product_id: e.target.value })}
              className="rounded-xl border border-[#DBEAFE] bg-white px-3 py-2.5 text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
            >
              <option value="">Selecione um produto</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.brand} — {p.name} {p.packaging_volume_ml}ml ({formatBRL(p.price_cents)})
                </option>
              ))}
            </select>
          </div>

          {/* Tipo */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-slate-600">Tipo de promoção *</label>
            <div className="grid grid-cols-2 gap-2">
              <label className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 ${form.type === "percentage" ? "border-[#2563EB] bg-[#EFF6FF]" : "border-[#DBEAFE]"}`}>
                <input type="radio" value="percentage" checked={form.type === "percentage"}
                  onChange={() => setForm({ ...form, type: "percentage", promotional_price_reais: "" })}
                  className="accent-[#2563EB]" />
                <span className="text-sm font-medium">Desconto %</span>
              </label>
              <label className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 ${form.type === "fixed_price" ? "border-[#2563EB] bg-[#EFF6FF]" : "border-[#DBEAFE]"}`}>
                <input type="radio" value="fixed_price" checked={form.type === "fixed_price"}
                  onChange={() => setForm({ ...form, type: "fixed_price", discount_percentage: "" })}
                  className="accent-[#2563EB]" />
                <span className="text-sm font-medium">Preço fixo</span>
              </label>
            </div>
          </div>

          {/* Valor */}
          {form.type === "percentage" ? (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">Desconto (%) *</label>
              <input
                type="number" min="0.1" max="99" step="0.1" required
                value={form.discount_percentage}
                onChange={(e) => setForm({ ...form, discount_percentage: e.target.value })}
                placeholder="Ex: 15.5"
                className="rounded-xl border border-[#DBEAFE] px-3 py-2.5 text-sm focus:border-[#2563EB] focus:outline-none"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">Preço promocional (R$) *</label>
              <input
                type="number" min="0.01" step="0.01" required
                value={form.promotional_price_reais}
                onChange={(e) => setForm({ ...form, promotional_price_reais: e.target.value })}
                placeholder="Ex: 4.16"
                className="rounded-xl border border-[#DBEAFE] px-3 py-2.5 text-sm focus:border-[#2563EB] focus:outline-none"
              />
            </div>
          )}

          {/* Preview */}
          {selectedProduct && previewCents != null && (
            <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <Tag size={16} />
              <div className="text-sm">
                <span className="text-slate-400 line-through mr-2">{formatBRL(selectedProduct.price_cents)}</span>
                <span className="font-black text-red-600">{formatBRL(previewCents)}</span>
                {form.type === "percentage" && form.discount_percentage && (
                  <span className="ml-2 text-xs text-red-500">(-{parseFloat(form.discount_percentage).toFixed(1)}%)</span>
                )}
              </div>
            </div>
          )}

          {/* Período */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">Início *</label>
              <input type="datetime-local" required value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                className="rounded-xl border border-[#DBEAFE] px-3 py-2.5 text-sm focus:border-[#2563EB] focus:outline-none" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">Fim *</label>
              <input type="datetime-local" required value={form.ends_at}
                onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                className="rounded-xl border border-[#DBEAFE] px-3 py-2.5 text-sm focus:border-[#2563EB] focus:outline-none" />
            </div>
          </div>

          {/* Descrição */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Descrição (opcional)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Ex: Promoção de verão — estoque limitado"
              rows={2}
              maxLength={300}
              className="rounded-xl border border-[#DBEAFE] px-3 py-2 text-sm placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none resize-none"
            />
          </div>

          {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="flex-1 rounded-xl bg-[#2563EB] py-3 text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50">
              {saving ? "Criando…" : "Criar promoção"}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-[#DBEAFE] py-3 text-sm font-medium text-slate-500 hover:bg-[#F5F7FB]">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function PromocoesPage() {
  useSession({ required: true });
  const router = useRouter();
  const token  = useApiToken();

  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts]     = useState<ProductRef[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [form, setForm]             = useState<PromoForm>(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [tab, setTab]               = useState<"active" | "scheduled" | "expired">("active");

  async function load() {
    if (!token) return;
    const [promoRes, prodRes] = await Promise.all([
      apiFetch("/api/distributor/promotions", { method: "GET", token }),
      apiFetch("/api/distributor/products?limit=500", { method: "GET", token }),
    ]);
    if (promoRes.ok) {
      const d = await promoRes.json() as { promotions: Promotion[] };
      setPromotions(d.promotions ?? []);
    }
    if (prodRes.ok) {
      const d = await prodRes.json() as { products: ProductRef[] };
      setProducts(d.products ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { if (token) load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function savePromo(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true); setFormError("");
    const payload = {
      product_id:              form.product_id,
      type:                    form.type,
      discount_percentage:     form.type === "percentage" ? parseFloat(form.discount_percentage) : undefined,
      promotional_price_cents: form.type === "fixed_price" ? Math.round(parseFloat(form.promotional_price_reais) * 100) : undefined,
      starts_at:               new Date(form.starts_at).toISOString(),
      ends_at:                 new Date(form.ends_at).toISOString(),
      description:             form.description || undefined,
    };
    const res = await apiFetch("/api/distributor/promotions", { method: "POST", token, body: JSON.stringify(payload) });
    if (res.ok) {
      await load();
      setShowModal(false);
      setForm(EMPTY_FORM);
    } else {
      const d = await res.json() as { error?: string };
      setFormError(d.error ?? "Erro ao criar promoção");
    }
    setSaving(false);
  }

  async function toggleActive(promo: Promotion) {
    if (!token) return;
    await apiFetch(`/api/distributor/promotions/${promo.id}`, {
      method: "PATCH", token, body: JSON.stringify({ active: !promo.active }),
    });
    await load();
  }

  async function deletePromo(id: string) {
    if (!token) return;
    setDeletingId(id);
    await apiFetch(`/api/distributor/promotions/${id}`, { method: "DELETE", token });
    setPromotions((prev) => prev.filter((p) => p.id !== id));
    setDeletingId(null);
  }

  const activePromos    = promotions.filter((p) => p.is_active);
  const scheduledPromos = promotions.filter((p) => p.is_scheduled);
  const expiredPromos   = promotions.filter((p) => p.is_expired);

  const tabData = tab === "active" ? activePromos : tab === "scheduled" ? scheduledPromos : expiredPromos;

  return (
    <div className="min-h-screen bg-[#F5F7FB]">
      <Navbar />
      <main className="mx-auto w-full max-w-4xl px-4 py-8">

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <button onClick={() => router.push("/painel")} className="mb-1 text-xs text-slate-400 hover:text-slate-600">
              ← Painel
            </button>
            <h1 className="text-2xl font-display font-semibold text-[#0F172A]">Promoções</h1>
            <p className="text-sm text-slate-500">
              {activePromos.length} ativa{activePromos.length !== 1 ? "s" : ""} · {scheduledPromos.length} agendada{scheduledPromos.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Button size="sm" onClick={() => { setForm(EMPTY_FORM); setFormError(""); setShowModal(true); }}>
            + Nova promoção
          </Button>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-1 rounded-2xl border border-[#DBEAFE] bg-[#F5F7FB] p-1">
          {([
            { key: "active",    label: `Ativas (${activePromos.length})` },
            { key: "scheduled", label: `Agendadas (${scheduledPromos.length})` },
            { key: "expired",   label: `Encerradas (${expiredPromos.length})` },
          ] as { key: typeof tab; label: string }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-all ${tab === t.key ? "bg-white text-[#0F172A] shadow-sm" : "text-slate-500 hover:text-[#0F172A]"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="space-y-3">{[1,2,3].map((n) => <div key={n} className="h-24 animate-pulse rounded-2xl bg-[#DBEAFE]/40" />)}</div>
        ) : tabData.length === 0 ? (
          <div className="rounded-2xl border border-[#DBEAFE] bg-white px-6 py-12 text-center">
            <Tag size={24} className="text-slate-300" />
            <p className="mt-2 text-sm text-slate-500">
              {tab === "active" ? "Nenhuma promoção ativa no momento." : tab === "scheduled" ? "Nenhuma promoção agendada." : "Nenhuma promoção encerrada."}
            </p>
            {tab === "active" && (
              <button onClick={() => { setForm(EMPTY_FORM); setShowModal(true); }}
                className="mt-3 text-sm font-semibold text-[#2563EB] hover:underline">
                Criar primeira promoção
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {tabData.map((promo) => {
              const effectiveCents = promo.type === "fixed_price" && promo.promotional_price_cents != null
                ? promo.promotional_price_cents
                : promo.type === "percentage" && promo.discount_percentage != null
                  ? Math.round(promo.product.price_cents * (1 - promo.discount_percentage / 100))
                  : promo.product.price_cents;

              return (
                <div key={promo.id} className="flex items-center gap-4 rounded-2xl border border-[#DBEAFE] bg-white p-4 shadow-sm">
                  {/* Imagem */}
                  {promo.product.image_url ? (
                    <img src={promo.product.image_url} alt={promo.product.name} className="h-12 w-12 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><Tag size={20} /></div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[#0F172A] truncate">
                        {promo.product.brand} — {promo.product.name}
                      </p>
                      {promo.is_active && <Badge variant="green">Ativa</Badge>}
                      {promo.is_scheduled && <Badge variant="yellow">Agendada</Badge>}
                      {promo.is_expired && <Badge variant="gray">Encerrada</Badge>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="line-through">{formatBRL(promo.product.price_cents)}</span>
                      <span className="font-bold text-red-600">{formatBRL(effectiveCents)}</span>
                      {promo.type === "percentage" && promo.discount_percentage != null && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 font-bold text-red-600">
                          -{promo.discount_percentage.toFixed(0)}%
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {formatDate(promo.starts_at)} → {formatDate(promo.ends_at)}
                      {promo.description && <span className="ml-2 italic">"{promo.description}"</span>}
                    </p>
                  </div>

                  {/* Ações */}
                  <div className="flex shrink-0 items-center gap-2">
                    {!promo.is_expired && (
                      <button
                        onClick={() => toggleActive(promo)}
                        className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${promo.active ? "border border-slate-200 text-slate-500 hover:bg-slate-50" : "border border-[#2563EB] text-[#2563EB] hover:bg-[#EFF6FF]"}`}
                      >
                        {promo.active ? "Pausar" : "Ativar"}
                      </button>
                    )}
                    <button
                      onClick={() => deletePromo(promo.id)}
                      disabled={deletingId === promo.id}
                      className="rounded-lg border border-red-100 px-3 py-1 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-40"
                    >
                      {deletingId === promo.id ? "…" : "Remover"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {showModal && (
        <PromoModal
          products={products}
          form={form}
          setForm={setForm}
          onSave={savePromo}
          onClose={() => setShowModal(false)}
          saving={saving}
          error={formError}
        />
      )}
    </div>
  );
}
