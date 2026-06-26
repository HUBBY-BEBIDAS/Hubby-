"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { Navbar } from "@/components/Navbar";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";
import { ProductAutocomplete, formatPackaging } from "@/components/ui/ProductAutocomplete";
import type { ProductSearchResult } from "@/app/api/products/search/route";

type Category =
  | "beer" | "whisky" | "vodka" | "gin" | "rum" | "cachaca"
  | "wine" | "sparkling" | "energy" | "soft_drink" | "water" | "juice" | "other";

type QuotationItem = {
  id: string;
  product_name: string;
  brand: string;
  category: Category;
  packaging: string;
  quantity: number;
};

type QuotationStatus = "draft" | "open" | "closed" | "expired";

let idCounter = 100;
function newId() { return `item-edit-${idCounter++}`; }

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

// ─── Tela de cotação já enviada ───────────────────────────────────────────────

function AlreadySentScreen({
  quotationId,
  items,
  onReorder,
  reordering,
}: {
  quotationId: string;
  items: QuotationItem[];
  onReorder: () => void;
  reordering: boolean;
}) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen flex-col bg-[#F5F7FB]">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <button
          onClick={() => router.push(`/cotacao/${quotationId}/ranking`)}
          className="mb-6 flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-[#0F172A]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Ver ranking
        </button>

        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100">
              <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-amber-900">Esta cotação já foi enviada</h2>
              <p className="mt-1 text-sm text-amber-700">
                Pedidos foram enviados a partir desta cotação e ela está fechada para edição.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-amber-200 bg-white p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">
              {items.length} produto(s) nesta cotação
            </p>
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-[#0F172A]">{item.product_name} <span className="font-normal text-slate-500">— {item.brand}</span></span>
                  <span className="font-mono text-xs text-slate-500">× {item.quantity}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              onClick={onReorder}
              loading={reordering}
              className="bg-[#22C55E] hover:bg-[#16A34A] font-bold"
            >
              Criar nova cotação com os mesmos produtos
            </Button>
            <button
              onClick={() => router.push(`/cotacao/${quotationId}/ranking`)}
              className="rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-50"
            >
              Ver ranking desta cotação
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function EditQuotationPage() {
  useSession({ required: true });
  const router = useRouter();
  const { id: quotationId } = useParams<{ id: string }>();
  const token = useApiToken();
  const quantityRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<QuotationStatus | null>(null);
  const [loadingQuotation, setLoadingQuotation] = useState(true);
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [maxDays, setMaxDays] = useState<number | "">("");

  const [searchValue, setSearchValue] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ProductSearchResult | null>(null);
  const [quantity, setQuantity] = useState(1);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reordering, setReordering] = useState(false);

  // Load existing quotation
  useEffect(() => {
    if (!token || !quotationId) return;
    apiFetch(`/api/quotations/${quotationId}`, { method: "GET", token })
      .then(async (r) => {
        if (!r.ok) { router.replace("/cotacao"); return; }
        const d = await r.json() as { quotation: { status: QuotationStatus; max_delivery_days: number | null; items: QuotationItem[] } };
        setStatus(d.quotation.status);
        setItems(d.quotation.items.map((i) => ({ ...i, id: newId() })));
        if (d.quotation.max_delivery_days) setMaxDays(d.quotation.max_delivery_days);
      })
      .catch(() => router.replace("/cotacao"))
      .finally(() => setLoadingQuotation(false));
  }, [token, quotationId, router]);

  // Reorder: create new quotation with same items
  async function handleReorder() {
    if (!token) return;
    setReordering(true);
    const res = await apiFetch("/api/quotations", {
      method: "POST",
      token,
      body: JSON.stringify({
        items: items.map(({ product_name, brand, category, packaging, quantity: qty }) => ({
          product_name, brand, category, packaging, quantity: qty,
        })),
        max_delivery_days: maxDays !== "" ? Number(maxDays) : null,
      }),
    });
    const data = await res.json();
    setReordering(false);
    if (res.ok) {
      router.push(`/cotacao/${data.quotation.id}/ranking`);
    }
  }

  function handleProductSelect(result: ProductSearchResult) {
    setSelectedProduct(result);
    setSearchValue("");
    setTimeout(() => quantityRef.current?.focus(), 0);
  }

  function clearSelection() {
    setSelectedProduct(null);
    setSearchValue("");
    setQuantity(1);
  }

  function addItem(e: FormEvent) {
    e.preventDefault();
    if (!selectedProduct) return;
    setItems((prev) => [
      ...prev,
      {
        id: newId(),
        product_name: selectedProduct.name,
        brand: selectedProduct.brand,
        category: selectedProduct.category as Category,
        packaging: formatPackaging(selectedProduct.packaging_type, selectedProduct.packaging_volume_ml),
        quantity,
      },
    ]);
    clearSelection();
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function updateQuantity(id: string, qty: number) {
    if (qty < 1) return;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: qty } : i)));
  }

  async function submitQuotation() {
    if (items.length === 0) { setError("Adicione ao menos um produto."); return; }
    if (!token) { setError("Sessão expirada."); return; }
    setError("");
    setSaving(true);

    const res = await apiFetch(`/api/quotations/${quotationId}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({
        items: items.map(({ product_name, brand, category, packaging, quantity: qty }) => ({
          product_name, brand, category, packaging, quantity: qty,
        })),
        max_delivery_days: maxDays !== "" ? Number(maxDays) : null,
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Erro ao atualizar cotação.");
      return;
    }

    router.push(`/cotacao/${quotationId}/ranking?refresh=1`);
  }

  const packagingLabel = selectedProduct
    ? formatPackaging(selectedProduct.packaging_type, selectedProduct.packaging_volume_ml)
    : null;

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loadingQuotation) {
    return (
      <div className="flex min-h-screen flex-col bg-[#F5F7FB]">
        <Navbar />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
          <div className="h-8 w-48 animate-pulse rounded bg-slate-200 mb-4" />
          <div className="h-40 animate-pulse rounded-3xl bg-slate-200" />
        </main>
      </div>
    );
  }

  // ── Cotação fechada ───────────────────────────────────────────────────────────
  if (status && status !== "open") {
    return (
      <AlreadySentScreen
        quotationId={quotationId}
        items={items}
        onReorder={handleReorder}
        reordering={reordering}
      />
    );
  }

  // ── Edição ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col bg-[#F5F7FB]">
      <Navbar />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">

        {/* Back link */}
        <button
          onClick={() => router.push(`/cotacao/${quotationId}/ranking`)}
          className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-[#0F172A]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Voltar ao ranking
        </button>

        <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-[#0F172A]">
          Editar cotação
        </h1>
        <p className="mb-6 text-sm font-medium text-slate-500">
          Altere os produtos ou quantidades e clique em <strong>Ver ranking</strong> para recalcular.
        </p>

        {/* Search + Add */}
        <div className="mb-6 rounded-3xl border border-[#DBEAFE] bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
            Adicionar produto
          </h2>
          <form onSubmit={addItem} className="flex flex-col gap-3">
            <ProductAutocomplete
              token={token}
              value={searchValue}
              onChange={(v) => setSearchValue(v)}
              onSelect={handleProductSelect}
            />

            {selectedProduct && (
              <div className="flex items-center gap-3 rounded-2xl border border-[#DBEAFE] bg-[#F5F7FB] px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-bold text-[#0F172A]">{selectedProduct.name}</p>
                  <p className="text-xs text-slate-500">{selectedProduct.brand} · {packagingLabel}</p>
                </div>
                <input
                  ref={quantityRef}
                  type="number"
                  min={1}
                  max={100000}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-20 rounded-xl border border-[#DBEAFE] bg-white px-3 py-2 text-center text-sm font-bold text-[#0F172A] outline-none focus:border-[#22C55E]"
                />
                <button type="submit" className="rounded-xl bg-[#22C55E] px-4 py-2 text-sm font-bold text-white hover:bg-[#16A34A]">
                  Adicionar
                </button>
                <button type="button" onClick={clearSelection} className="text-slate-400 hover:text-slate-600">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Items list */}
        {items.length > 0 ? (
          <div className="mb-6 rounded-3xl border border-[#DBEAFE] bg-white shadow-sm">
            <div className="border-b border-[#DBEAFE] px-6 py-4">
              <h2 className="text-sm font-bold text-[#0F172A]">
                {items.length} produto(s) na cotação
              </h2>
            </div>
            <ul className="divide-y divide-[#DBEAFE]">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-6 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-bold text-[#0F172A]">{item.product_name}</p>
                    <p className="text-xs text-slate-500">{item.brand} · {item.packaging}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-[#DBEAFE] text-slate-500 hover:bg-[#F5F7FB] disabled:opacity-30"
                    >
                      −
                    </button>
                    <span className="w-10 text-center text-sm font-bold text-[#0F172A]">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-[#DBEAFE] text-slate-500 hover:bg-[#F5F7FB]"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="ml-2 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="mb-6 rounded-3xl border border-dashed border-[#DBEAFE] py-12 text-center">
            <p className="text-sm text-slate-400">Nenhum produto adicionado.</p>
          </div>
        )}

        {/* Prazo opcional */}
        <div className="mb-6 rounded-3xl border border-[#DBEAFE] bg-white p-5 shadow-sm">
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-slate-400">
            Prazo máximo de entrega <span className="ml-1 font-medium normal-case tracking-normal text-slate-300">opcional</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={90}
              placeholder="Ex: 3"
              value={maxDays}
              onChange={(e) => setMaxDays(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-24 rounded-xl border border-[#DBEAFE] bg-[#F5F7FB] px-3 py-2.5 text-sm text-[#0F172A] outline-none focus:border-[#22C55E]"
            />
            <span className="text-sm text-slate-500">dias úteis</span>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <Button
          fullWidth
          size="lg"
          loading={saving}
          disabled={items.length === 0}
          onClick={submitQuotation}
          className="bg-[#22C55E] hover:bg-[#16A34A] font-bold"
        >
          Ver ranking de preços
        </Button>
      </main>
    </div>
  );
}
