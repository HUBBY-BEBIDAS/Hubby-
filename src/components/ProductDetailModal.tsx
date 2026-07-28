"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  X, Minus, Plus, Package, Truck, AlertTriangle, Check,
  TrendingUp, TrendingDown, Minus as TrendFlat, Tag,
} from "lucide-react";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";
import { useQuotation } from "@/contexts/QuotationContext";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Promotion = {
  type: string;
  discount_percentage: number | null;
  promotional_price_cents: number | null;
  description: string | null;
};

type DistributorOffer = {
  product_id:               string;
  distributor_id:           string;
  company_name:             string;
  price_cents:              number;
  effective_price_cents:    number;
  promotion:                Promotion | null;
  delivery_date:            string;
  delivery_days:            number;
  minimum_order_cents:      number;
  freight_type:             string;
  freight_value_cents:      number | null;
  free_freight_above_cents: number | null;
  freight_notes:            string | null;
};

type PricePoint = { price_cents: number; recorded_at: string };

export type ProductVariantData = {
  key: string;
  variant_key: string;
  name: string;
  brand: string;
  category: string;
  packaging_type: string;
  packaging_volume_ml: number;
  label: string;
  min_price_cents: number;
  effective_price_cents: number;
  image_url: string | null;
  distributor_count: number;
  cheapest_product_id: string;
  cheapest_distributor_id: string;
  promotion: Promotion | null;
};

export type ProductModalData = {
  name:               string;
  brand:              string;
  category:           string;
  packaging_type:     string;
  packaging_volume_ml: number;
  image_url:          string | null;
  cheapest_product_id:     string;
  cheapest_distributor_id: string;
  promotion:          Promotion | null;
  variants?:          ProductVariantData[];
  selected_variant_key?: string;
};

interface Props {
  product:  ProductModalData;
  onClose:  () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

const PACKAGING_LABEL: Record<string, string> = {
  garrafa: "Garrafa", lata: "Lata", barril: "Barril",
  caixa: "Caixa", fardo: "Fardo", tetra_pak: "Tetra Pak", other: "Outro",
};
const CATEGORY_LABEL: Record<string, string> = {
  beer: "Cerveja", whisky: "Whisky", vodka: "Vodka", gin: "Gin", rum: "Rum",
  cachaca: "Cachaça", wine: "Vinho", sparkling: "Espumante", energy: "Energético",
  soft_drink: "Refrigerante", water: "Água", juice: "Suco", other: "Outro",
};

// ─── Frete Badge ──────────────────────────────────────────────────────────────

function FreightLine({
  freight_type, freight_value_cents, free_freight_above_cents, freight_notes, subtotal,
}: Pick<DistributorOffer, "freight_type" | "freight_value_cents" | "free_freight_above_cents" | "freight_notes"> & { subtotal: number }) {
  if (freight_type === "free") {
    return <span className="text-green-600 font-medium">Frete grátis</span>;
  }
  if (freight_type === "fixed" && freight_value_cents != null) {
    return <span className="text-slate-500">+ {formatBRL(freight_value_cents)} frete</span>;
  }
  if (freight_type === "by_value" && free_freight_above_cents != null) {
    if (subtotal >= free_freight_above_cents) {
      return <span className="text-green-600 font-medium">Frete grátis neste pedido</span>;
    }
    return (
      <span className="text-slate-500">
        Frete grátis acima de {formatBRL(free_freight_above_cents)}
      </span>
    );
  }
  return <span className="text-slate-400">{freight_notes ?? "Frete a combinar"}</span>;
}

// ─── Sparkline SVG ────────────────────────────────────────────────────────────

function PriceSparkline({ points }: { points: PricePoint[] }) {
  if (points.length < 2) {
    return <p className="text-xs text-slate-400">Histórico insuficiente para exibir gráfico</p>;
  }

  const values   = points.map((p) => p.price_cents);
  const minVal   = Math.min(...values);
  const maxVal   = Math.max(...values);
  const range    = maxVal - minVal || 1;
  const W        = 260;
  const H        = 56;
  const pad      = 4;

  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (W - pad * 2);
    const y = pad + ((maxVal - p.price_cents) / range) * (H - pad * 2);
    return { x, y, price: p.price_cents };
  });

  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  const fill = `${path} L ${coords.at(-1)!.x} ${H} L ${coords[0].x} ${H} Z`;

  const first = values[0];
  const last  = values[values.length - 1];
  const pct   = first > 0 ? Math.round(((last - first) / first) * 100) : 0;
  const trend: "up" | "down" | "flat" = Math.abs(pct) < 2 ? "flat" : pct > 0 ? "up" : "down";

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-semibold text-slate-500">Últimos {points.length} registros de preço</p>
        {trend === "up"   && <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600"><TrendingUp size={11} />Preço em alta ({pct > 0 ? "+" : ""}{pct}%)</span>}
        {trend === "down" && <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-600"><TrendingDown size={11} />Preço em queda ({pct}%)</span>}
        {trend === "flat" && <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500"><TrendFlat size={11} />Preço estável</span>}
      </div>
      <svg width={W} height={H} className="w-full" viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={trend === "up" ? "#ef4444" : "#22c55e"} stopOpacity="0.18" />
            <stop offset="100%" stopColor={trend === "up" ? "#ef4444" : "#22c55e"} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={fill} fill="url(#sparkGrad)" />
        <path d={path} fill="none" stroke={trend === "up" ? "#ef4444" : trend === "down" ? "#22c55e" : "#94a3b8"} strokeWidth="1.5" strokeLinejoin="round" />
        {/* Dots */}
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="2.5" fill={trend === "up" ? "#ef4444" : trend === "down" ? "#22c55e" : "#94a3b8"} />
        ))}
      </svg>
      <div className="flex items-center justify-between mt-0.5">
        <span className="text-[10px] text-slate-400">{formatBRL(minVal)}</span>
        <span className="text-[10px] text-slate-400">{formatBRL(maxVal)}</span>
      </div>
    </div>
  );
}

// ─── Modal principal ──────────────────────────────────────────────────────────

export function ProductDetailModal({ product, onClose }: Props) {
  const router  = useRouter();
  const token   = useApiToken();
  const { addItem, quotation } = useQuotation();

  const [activeVariantKey, setActiveVariantKey] = useState<string>(
    product.selected_variant_key || `${product.packaging_type}|${product.packaging_volume_ml}`
  );

  const activeVariant = (product.variants && product.variants.length > 0)
    ? product.variants.find((v) => v.variant_key === activeVariantKey) ?? product.variants[0]
    : null;

  const activeName = activeVariant?.name ?? product.name;
  const activeBrand = activeVariant?.brand ?? product.brand;
  const activeCategory = activeVariant?.category ?? product.category;
  const activeType = activeVariant?.packaging_type ?? product.packaging_type;
  const activeVolume = activeVariant?.packaging_volume_ml ?? product.packaging_volume_ml;
  const activeImage = activeVariant?.image_url ?? product.image_url;
  const activeCheapestProductId = activeVariant?.cheapest_product_id ?? product.cheapest_product_id;
  const activeCheapestDistributorId = activeVariant?.cheapest_distributor_id ?? product.cheapest_distributor_id;
  const activePromotion = activeVariant?.promotion ?? product.promotion;

  const [distributors, setDistributors] = useState<DistributorOffer[]>([]);
  const [loadingDist,  setLoadingDist]  = useState(true);

  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [quantity,     setQuantity]     = useState(1);

  const [adding,    setAdding]    = useState<string | null>(null); // distributor_id em progress
  const [addedIds,  setAddedIds]  = useState<Set<string>>(new Set());

  // Fecha ao pressionar Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Busca distribuidoras
  const fetchDistributors = useCallback(async () => {
    if (!token) return;
    setLoadingDist(true);
    try {
      const params = new URLSearchParams({
        name:               activeName,
        brand:              activeBrand,
        packaging_type:     activeType,
        packaging_volume_ml: String(activeVolume),
      });
      const res  = await apiFetch(`/api/catalog/product-distributors?${params}`, { method: "GET", token });
      const data = await res.json() as { distributors: DistributorOffer[] };
      setDistributors(data.distributors ?? []);
    } catch {
      // silencia
    } finally {
      setLoadingDist(false);
    }
  }, [token, activeName, activeBrand, activeType, activeVolume]);

  // Busca histórico de preço do produto mais barato da variante ativa
  useEffect(() => {
    if (!token || !activeCheapestProductId || !activeCheapestDistributorId) return;
    apiFetch(
      `/api/products/${activeCheapestProductId}/price-history?distributor_id=${activeCheapestDistributorId}`,
      { method: "GET", token }
    )
      .then((r) => r.json())
      .then((d: { history: PricePoint[] }) => {
        const sorted = [...(d.history ?? [])].reverse(); // cronológico
        setPriceHistory(sorted);
      })
      .catch(() => {});
  }, [token, activeCheapestProductId, activeCheapestDistributorId]);

  useEffect(() => { fetchDistributors(); }, [fetchDistributors]);

  async function handleAddToQuotation(offer: DistributorOffer) {
    if (!token || adding) return;
    setAdding(offer.distributor_id);
    try {
      const packagingLabel = `${PACKAGING_LABEL[activeType] ?? activeType} ${activeVolume}ml`;
      await addItem({
        product_name: activeName,
        brand:        activeBrand,
        category:     activeCategory,
        packaging:    packagingLabel,
        quantity,
      });
      setAddedIds((prev) => new Set(prev).add(offer.distributor_id));
    } finally {
      setAdding(null);
    }
  }

  const cheapest = distributors[0];
  const totalCents = (qty: number, offer: DistributorOffer) =>
    offer.effective_price_cents * qty;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Painel */}
      <div className="relative w-full max-w-2xl max-h-[95dvh] overflow-hidden rounded-t-3xl sm:rounded-3xl bg-[#F5F7FB] shadow-2xl flex flex-col">

        {/* Cabeçalho */}
        <div className="flex items-start gap-4 bg-white px-5 pb-4 pt-5 border-b border-[#DBEAFE]">
          {/* Foto */}
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[#F5F7FB]">
            {activeImage ? (
              <img src={activeImage} alt={activeName} className="h-18 w-18 object-contain" />
            ) : (
              <Package size={32} className="text-slate-300" />
            )}
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0 pt-0.5">
            <span className="rounded-full bg-[#DBEAFE] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#2563EB]">
              {CATEGORY_LABEL[activeCategory] ?? activeCategory}
            </span>
            <h2 className="mt-1 text-lg font-extrabold leading-tight text-[#0F172A]">{activeName}</h2>
            <p className="text-sm text-slate-500">
              {activeBrand} · {PACKAGING_LABEL[activeType] ?? activeType} {activeVolume}ml
            </p>
            {activePromotion?.description && (
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                <Tag size={10} />PROMO · {activePromotion.description}
              </span>
            )}
          </div>
          {/* Fechar */}
          <button onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F5F7FB] text-slate-400 hover:bg-slate-200 hover:text-[#0F172A]">
            <X size={16} />
          </button>
        </div>

        {/* Seletor de Variantes (Volume / Embalagem) */}
        {product.variants && product.variants.length > 1 && (
          <div className="bg-[#F5F7FB] px-5 py-2.5 border-b border-[#DBEAFE] flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Opções de tamanho / embalagem ({product.variants.length})
            </span>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((v) => {
                const isSelected = v.variant_key === activeVariantKey;
                return (
                  <button
                    key={v.variant_key}
                    onClick={() => setActiveVariantKey(v.variant_key)}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#2563EB] text-white shadow-md shadow-blue-500/20 scale-[1.02]"
                        : "bg-white text-slate-700 border border-[#DBEAFE] hover:border-blue-400 hover:text-blue-600"
                    }`}
                  >
                    <span>{v.label}</span>
                    <span className={`text-[10px] ${isSelected ? "text-blue-100" : "text-slate-400"}`}>
                      ({formatBRL(v.effective_price_cents)})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Quantidade */}
        <div className="flex items-center gap-4 bg-white border-b border-[#DBEAFE] px-5 py-3">
          <span className="text-sm font-semibold text-slate-600">Quantidade:</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[#DBEAFE] text-slate-500 hover:bg-[#F5F7FB] active:scale-95"
            >
              <Minus size={14} />
            </button>
            <span className="w-10 text-center text-base font-extrabold text-[#0F172A]">{quantity}</span>
            <button
              onClick={() => setQuantity((q) => Math.min(100_000, q + 1))}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[#DBEAFE] text-slate-500 hover:bg-[#F5F7FB] active:scale-95"
            >
              <Plus size={14} />
            </button>
          </div>
          {cheapest && (
            <span className="ml-auto text-xs text-slate-400">
              Total estimado: <span className="font-bold text-[#0F172A]">{formatBRL(totalCents(quantity, cheapest))}</span>
            </span>
          )}
        </div>

        {/* Conteúdo scrollável */}
        <div className="flex-1 overflow-y-auto">

          {/* Lista de distribuidoras */}
          <div className="px-4 pt-4">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Distribuidoras na sua região — {loadingDist ? "carregando…" : `${distributors.length} encontrada${distributors.length !== 1 ? "s" : ""}`}
            </p>

            {loadingDist ? (
              <div className="space-y-2">
                {[1,2,3].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-[#DBEAFE]/40" />)}
              </div>
            ) : distributors.length === 0 ? (
              <div className="rounded-2xl border border-[#DBEAFE] bg-white py-10 text-center">
                <p className="text-sm font-semibold text-slate-500">Nenhuma distribuidora disponível para este produto na sua região</p>
              </div>
            ) : (
              <div className="space-y-2">
                {distributors.map((offer, idx) => {
                  const isAdded    = addedIds.has(offer.distributor_id);
                  const isAdding   = adding === offer.distributor_id;
                  const subtotal   = totalCents(quantity, offer);
                  const meetMin    = offer.minimum_order_cents === 0 || subtotal >= offer.minimum_order_cents;
                  const isCheapest = idx === 0;

                  return (
                    <div
                      key={offer.distributor_id}
                      className={`overflow-hidden rounded-2xl border bg-white transition-all ${
                        isCheapest ? "border-[#22C55E] ring-1 ring-[#22C55E]/30" : "border-[#DBEAFE]"
                      }`}
                    >
                      <div className="flex items-start gap-3 px-4 py-3">
                        {/* Nome + entrega */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-[#0F172A]">{offer.company_name}</p>
                            {isCheapest && (
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                                Mais barato
                              </span>
                            )}
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                            {/* Entrega */}
                            <span className="flex items-center gap-1">
                              <Truck size={11} />{offer.delivery_date}
                            </span>

                            {/* Pedido mínimo */}
                            {offer.minimum_order_cents > 0 ? (
                              <span className={`flex items-center gap-1 ${meetMin ? "text-green-600" : "text-amber-600"}`}>
                                {meetMin
                                  ? <><Check size={11} />Min. {formatBRL(offer.minimum_order_cents)}</>
                                  : <><AlertTriangle size={11} />Min. {formatBRL(offer.minimum_order_cents)}</>
                                }
                              </span>
                            ) : (
                              <span className="text-green-600">Sem pedido mínimo</span>
                            )}

                            {/* Frete */}
                            <FreightLine
                              freight_type={offer.freight_type}
                              freight_value_cents={offer.freight_value_cents}
                              free_freight_above_cents={offer.free_freight_above_cents}
                              freight_notes={offer.freight_notes}
                              subtotal={subtotal}
                            />
                          </div>

                          {/* Alerta de pedido mínimo não atingido */}
                          {!meetMin && (
                            <p className="mt-1 text-[10px] font-medium text-amber-600">
                              Faltam {formatBRL(offer.minimum_order_cents - subtotal)} para o pedido mínimo
                            </p>
                          )}
                        </div>

                        {/* Preço + botão */}
                        <div className="shrink-0 text-right">
                          <div className="flex items-baseline justify-end gap-1">
                            {offer.promotion && (
                              <span className="text-xs text-slate-400 line-through">{formatBRL(offer.price_cents)}</span>
                            )}
                            <p className={`text-base font-extrabold ${offer.promotion ? "text-red-600" : "text-[#0F172A]"}`}>
                              {formatBRL(offer.effective_price_cents)}<span className="text-xs font-normal text-slate-400">/un</span>
                            </p>
                          </div>
                          <p className="text-xs font-bold text-[#2563EB]">
                            Total: {formatBRL(subtotal)}
                          </p>
                          <button
                            disabled={isAdding || isAdded}
                            onClick={() => handleAddToQuotation(offer)}
                            className={[
                              "mt-2 flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition active:scale-95",
                              isAdded
                                ? "bg-green-100 text-green-700"
                                : "bg-[#22C55E] text-white hover:bg-[#16A34A] disabled:opacity-60",
                            ].join(" ")}
                          >
                            {isAdding ? (
                              <><div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />Adicionando…</>
                            ) : isAdded ? (
                              <><Check size={12} />Adicionado</>
                            ) : (
                              "Adicionar à cotação"
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Histórico de preço */}
          {priceHistory.length > 0 && (
            <div className="mx-4 my-4 rounded-2xl border border-[#DBEAFE] bg-white p-4">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">Histórico de preço</p>
              <PriceSparkline points={priceHistory} />
            </div>
          )}

          {/* Espaçamento inferior */}
          <div className="h-4" />
        </div>

        {/* Rodapé: ações de cotação */}
        <div className="border-t border-[#DBEAFE] bg-white px-5 py-4">
          {quotation ? (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { onClose(); router.push(`/cotacao/${quotation.id}/ranking`); }}
                className="flex-1 rounded-2xl border border-[#DBEAFE] bg-[#F5F7FB] py-2.5 text-sm font-bold text-[#0F172A] hover:bg-[#DBEAFE]/60"
              >
                Ver cotação atual ({quotation.items.length} produto{quotation.items.length !== 1 ? "s" : ""})
              </button>
            </div>
          ) : (
            <p className="text-center text-xs text-slate-400">
              Clique em "Adicionar à cotação" em qualquer distribuidora para começar.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
