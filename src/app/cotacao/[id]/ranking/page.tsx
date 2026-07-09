"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Navbar } from "@/components/Navbar";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";
import { Tooltip } from "@/components/ui/Tooltip";
import { Heart, Star, MapPin, Check, X, Sparkles, ShoppingCart } from "lucide-react";
import { useCart } from "@/contexts/CartContext";

// ─── Tipos da API ─────────────────────────────────────────────────────────────

type ItemPromotion = {
  type: string;
  discount_percentage: number | null;
  promotional_price_cents: number | null;
  description: string | null;
};

type MatchedItem = {
  product_id: string;
  quotation_item_name: string;
  quotation_item_brand: string;
  product_name: string;
  quantity: number;
  unit_price_cents: number;         // preço efetivo (com desconto)
  original_price_cents: number;     // preço original sem promoção
  total_price_cents: number;
  price_change_pct: number | null;
  image_url: string | null;
  promotion: ItemPromotion | null;
};

type RankingEntry = {
  distributor_id: string;
  company_name: string;
  whatsapp_commercial: string;
  email_commercial: string;
  total_cents: number;
  total_brl: string;
  all_items_available: boolean;
  matched_items: MatchedItem[];
  unmatched_items: string[];
  estimated_delivery_date: string;
  total_business_days: number;
  within_deadline: boolean;
  price_updated_at: string;
  status: "within_deadline" | "out_of_deadline";
  average_rating: number | null;
  review_count: number;
  freight_type: string;
  freight_value_cents: number | null;
  free_freight_above_cents: number | null;
  freight_notes: string | null;
  business_hours: Record<string, string | null> | null;
  accepts_orders_outside_hours: boolean;
  distance_km: number | null;
  is_nearby: boolean;
  minimum_order_cents: number;
  is_sponsored?: boolean;
};

type RestrictedDistributor = {
  distributor_id: string;
  company_name: string;
  total_cents: number;
  total_brl: string;
  all_items_available: boolean;
  savings_vs_best_cents: number;
  matched_item_names: string[];
};

type RankingResult = {
  within_deadline: RankingEntry[];
  out_of_deadline: RankingEntry[];
  quotation_id: string;
  delivery_city: string;
  delivery_state: string;
  from_cache: boolean;
  client_plan: string;
  restricted_distributors: RestrictedDistributor[];
};

// ─── Tipos da view por produto ────────────────────────────────────────────────

type ProductOffer = {
  key: string; // "distributorId:itemIndex" — chave de seleção
  product_id: string;
  distributor_id: string;
  company_name: string;
  whatsapp_commercial: string;
  unit_price_cents: number;         // preço efetivo
  original_price_cents: number;     // preço sem desconto
  total_price_cents: number;
  quantity: number;
  product_name: string;
  quotation_item_name: string;
  estimated_delivery_date: string;
  total_business_days: number;
  within_deadline: boolean;
  average_rating: number | null;
  review_count: number;
  price_change_pct: number | null;
  image_url: string | null;
  promotion: ItemPromotion | null;
  freight_type: string;
  freight_value_cents: number | null;
  free_freight_above_cents: number | null;
  freight_notes: string | null;
  business_hours: Record<string, string | null> | null;
  accepts_orders_outside_hours: boolean;
  distance_km: number | null;
  is_nearby: boolean;
  minimum_order_cents: number;
  is_sponsored?: boolean;
};

type ProductGroup = {
  quotation_item_name: string;
  quantity: number;
  offers: ProductOffer[];       // ordenadas conforme filtro ativo
  cheapestCents: number;        // menor preço entre todas as ofertas
  image_url: string | null;     // imagem do primeiro produto encontrado
};

type SortBy = "cheapest" | "most_expensive" | "fastest";

type QuotationItemAPI = {
  id: string;
  product_name: string;
  brand: string;
  category: string;
  packaging: string;
  quantity: number;
};

// ─── Tipos do algoritmo de sugestão ──────────────────────────────────────────

type AllocItem = { offer: ProductOffer; productName: string };

type ComboDistributor = {
  entry: RankingEntry;
  items: AllocItem[];
  subtotalCents: number;
  freightCents: number;
};

type ValidCombo = {
  distributors: ComboDistributor[];
  grandTotalCents: number;
};

type SmartResult =
  | { scenario: "none" }
  | { scenario: "A"; combo: ValidCombo; distributorCount: number; latestDeliveryDate: string }
  | { scenario: "B"; combo: ValidCombo; latestDeliveryDate: string }
  | {
      scenario: "C";
      noMinimumEntries: RankingEntry[];
      nearestEntry: { entry: RankingEntry; shortfall: number; cheapestOffer: ProductOffer | null } | null;
    };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function buildWhatsAppUrl(
  entry: RankingEntry,
  items: MatchedItem[],
  totalCents: number,
  city: string
): string {
  const lines = items.map(
    (item) =>
      `• ${item.product_name} x ${item.quantity} — ${formatBRL(item.unit_price_cents)}/un`
  );
  const message = [
    `Olá, ${entry.company_name}! Quero fazer o seguinte pedido:`,
    ...lines,
    `Total: ${formatBRL(totalCents)}`,
    ``,
    `Poderia confirmar disponibilidade e prazo para ${city}? Obrigado!`,
  ].join("\n");
  const phone = entry.whatsapp_commercial.replace(/\D/g, "");
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function buildEmailUrl(
  entry: RankingEntry,
  items: MatchedItem[],
  totalCents: number,
  city: string
): string {
  const subject = `Cotação de bebidas — ${items.map((i) => i.product_name).join(", ")}`;
  const body = [
    `Olá, ${entry.company_name}!`,
    ``,
    `Gostaria de fazer o seguinte pedido:`,
    ...items.map(
      (i) => `• ${i.product_name} × ${i.quantity} — ${formatBRL(i.unit_price_cents)}/un`
    ),
    ``,
    `Total: ${formatBRL(totalCents)}`,
    ``,
    `Poderia confirmar disponibilidade e prazo de entrega para ${city}?`,
    ``,
    `Obrigado!`,
  ].join("\n");
  return `mailto:${encodeURIComponent(entry.email_commercial)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// ─── Horário de funcionamento ─────────────────────────────────────────────────

function isDistributorOpen(businessHours: Record<string, string | null> | null): boolean {
  if (!businessHours) return true;
  const dayNames = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  const now = new Date();
  const brtMin = now.getUTCHours() * 60 + now.getUTCMinutes() - 180; // UTC-3
  const brtAdjusted = ((brtMin % 1440) + 1440) % 1440;
  const brtHour = Math.floor(brtAdjusted / 60);
  const brtMinute = brtAdjusted % 60;
  const dayOffset = brtAdjusted < 0 ? -1 : 0;
  const dayIdx = ((now.getUTCDay() + dayOffset) + 7) % 7;
  const dayKey = dayNames[dayIdx];
  const hours = businessHours[dayKey];
  if (!hours) return false;
  const [openStr, closeStr] = hours.split("-");
  const [oh, om] = openStr.split(":").map(Number);
  const [ch, cm] = closeStr.split(":").map(Number);
  const cur = brtHour * 60 + brtMinute;
  return cur >= oh * 60 + om && cur < ch * 60 + cm;
}

function businessHoursToday(businessHours: Record<string, string | null> | null): string | null {
  if (!businessHours) return null;
  const dayNames = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  const now = new Date();
  const brtMin = now.getUTCHours() * 60 + now.getUTCMinutes() - 180;
  const brtAdjusted = ((brtMin % 1440) + 1440) % 1440;
  const dayIdx = Math.floor(brtAdjusted / 60) < 0 ? (now.getUTCDay() + 6) % 7 : now.getUTCDay();
  return businessHours[dayNames[dayIdx]] ?? null;
}

// ─── Preço em mono ────────────────────────────────────────────────────────────

function PriceMono({ cents, className = "", crossed = false }: { cents: number; className?: string; crossed?: boolean }) {
  const formatted = formatBRL(cents);
  return crossed
    ? <span className={`font-mono font-medium text-slate-400 line-through ${className}`}>{formatted}</span>
    : <span className={`font-mono font-medium ${className}`}>{formatted}</span>;
}

// ─── Badge + tooltip de frete ─────────────────────────────────────────────────

function FreightBadge({
  freight_type,
  freight_value_cents,
  free_freight_above_cents,
  freight_notes,
  orderTotalCents,
}: {
  freight_type: string;
  freight_value_cents: number | null;
  free_freight_above_cents: number | null;
  freight_notes: string | null;
  orderTotalCents?: number;
}) {
  let label = "";
  let tooltipText = "";
  let colorClass = "bg-slate-100 text-slate-500";

  if (freight_type === "free") {
    label = "Frete grátis";
    tooltipText = "Frete grátis para esta região";
    colorClass = "bg-green-100 text-green-700";
  } else if (freight_type === "fixed" && freight_value_cents != null) {
    label = `Frete ${formatBRL(freight_value_cents)}`;
    tooltipText = `Frete fixo: ${formatBRL(freight_value_cents)}`;
    colorClass = "bg-slate-100 text-slate-600";
  } else if (freight_type === "by_value" && free_freight_above_cents != null) {
    const qualifies = orderTotalCents != null && orderTotalCents >= free_freight_above_cents;
    const missing   = free_freight_above_cents - (orderTotalCents ?? 0);
    colorClass = qualifies ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700";
    label = qualifies ? "Frete grátis" : `Grátis acima de ${formatBRL(free_freight_above_cents)}`;
    tooltipText = qualifies
      ? `Frete grátis neste pedido (acima de ${formatBRL(free_freight_above_cents)})`
      : `Faltam ${formatBRL(missing)} para frete grátis (mín. ${formatBRL(free_freight_above_cents)})`;
  } else if (freight_type === "by_weight") {
    label = freight_notes ?? "Frete por peso";
    tooltipText = freight_notes ?? "Frete calculado por peso — perguntar no WhatsApp";
  } else {
    label = freight_notes ?? "Frete a combinar";
    tooltipText = "Frete a combinar — perguntar no WhatsApp";
  }

  return (
    <Tooltip text={tooltipText} position="top" maxWidth={240}>
      <span className={`inline-flex cursor-help items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${colorClass}`}>
        {label}
      </span>
    </Tooltip>
  );
}

// ─── Indicador de variação de preço ──────────────────────────────────────────

function PriceChangeIndicator({ pct }: { pct: number | null }) {
  if (pct === null || pct === 0) return null;

  const isUp = pct > 0;
  const abs  = Math.abs(pct);
  const label = `${isUp ? "+" : "-"}${abs.toFixed(1)}%`;

  return (
    <span
      title={`${isUp ? "Alta" : "Queda"} de ${abs.toFixed(1)}% em relação à última consulta`}
      className={[
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
        isUp ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700",
      ].join(" ")}
    >
      {isUp ? (
        <svg className="h-2.5 w-2.5" viewBox="0 0 10 10" fill="currentColor">
          <path d="M5 1l4 8H1z" />
        </svg>
      ) : (
        <svg className="h-2.5 w-2.5" viewBox="0 0 10 10" fill="currentColor">
          <path d="M5 9L1 1h8z" />
        </svg>
      )}
      {label}
    </span>
  );
}

// ─── Pedido mínimo ───────────────────────────────────────────────────────────

type MinScenario = "ok" | "close" | "below" | "none";

function minOrderScenario(totalCents: number, minimumCents: number): MinScenario {
  if (minimumCents === 0) return "none";
  if (totalCents >= minimumCents) return "ok";
  if (totalCents >= minimumCents * 0.7) return "close";
  return "below";
}


// ─── Estado vazio: sem distribuidoras na região ───────────────────────────────

type EmptyRegionProps = {
  city: string;
  state: string;
  email: string;
  onEmailChange: (v: string) => void;
  status: "idle" | "sending" | "done" | "error";
  onSubmit: () => void;
};

function EmptyRegion({ city, state, email, onEmailChange, status, onSubmit }: EmptyRegionProps) {
  return (
    <div className="rounded-3xl border border-[#DBEAFE] bg-white p-8">
      {/* Ícone */}
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F0FDF4]">
        <svg className="h-7 w-7 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>

      <h2 className="mb-1 text-center text-lg font-bold text-[#0F172A]">
        Ainda sem distribuidoras em {city} / {state}
      </h2>
      <p className="mb-6 text-center text-sm text-slate-500">
        Ainda não temos distribuidoras cadastradas na sua região. Entre na lista de espera
        e avise quando novas distribuidoras chegarem.
      </p>

      {status === "done" ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-green-50 px-5 py-4">
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm font-bold text-green-700">Você entrou na lista de espera!</p>
          <p className="text-xs text-green-600">Te avisaremos quando uma distribuidora chegar em {city}.</p>
        </div>
      ) : (
        <form
          onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
          className="flex flex-col gap-3"
        >
          <div className="flex gap-2">
            <input
              type="email"
              required
              placeholder="Seu melhor e-mail"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              disabled={status === "sending"}
              className="flex-1 rounded-xl border border-[#DBEAFE] bg-[#F5F7FB] px-4 py-2.5 text-sm text-[#0F172A] placeholder-slate-400 outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#DBEAFE] disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={status === "sending" || !email}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[#22C55E] px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {status === "sending" ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                "Entrar na lista"
              )}
            </button>
          </div>

          {status === "error" && (
            <p className="text-xs text-red-600">Erro ao registrar. Tente novamente.</p>
          )}

          <p className="text-center text-xs text-slate-400">
            Sem spam. Só um aviso quando uma distribuidora chegar na sua cidade.
          </p>
        </form>
      )}
    </div>
  );
}

// ─── Tela de lista de espera (cidade fora da cobertura) ──────────────────────

function CoverageWaitlistScreen({ city, state }: { city: string; state: string }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#F5F7FB]">
      <Navbar />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#22C55E]/10">
          <svg className="h-8 w-8 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/>
          </svg>
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#0F172A]">
          Estamos chegando em {city}
        </h1>
        <p className="mt-3 max-w-sm text-sm font-medium leading-relaxed text-slate-500">
          Ainda não temos distribuidoras cadastradas para sua região, mas estamos expandindo. Você será um dos primeiros a saber quando chegar!
        </p>
        <div className="mt-6 rounded-2xl border border-[#22C55E]/30 bg-[#22C55E]/5 px-5 py-4 text-sm font-semibold text-[#16A34A]">
          Você já está na lista de espera para {city}/{state}.
        </div>
        <p className="mt-4 text-xs text-slate-400">
          Enquanto isso, você pode atualizar seus produtos preferidos ou explorar a plataforma.
        </p>
      </main>
    </div>
  );
}

// ─── Algoritmo de sugestão inteligente ───────────────────────────────────────

function freightCentsFor(entry: RankingEntry, subtotalCents: number): number {
  if (entry.freight_type === "free") return 0;
  if (entry.freight_type === "fixed") return entry.freight_value_cents ?? 0;
  if (entry.freight_type === "by_value" && entry.free_freight_above_cents != null) {
    return subtotalCents >= entry.free_freight_above_cents ? 0 : 0;
  }
  return 0;
}

function trySubsetCombo(
  subset: RankingEntry[],
  productGroups: ProductGroup[],
  offerMap: Map<string, Map<string, ProductOffer>>
): ValidCombo | null {
  const subsetIdSet = new Set(subset.map((e) => e.distributor_id));

  // Alocação inicial gulosa: cada produto → distribuidora mais barata do subset
  const alloc = new Map<string, { distId: string; offer: ProductOffer }>();
  for (const group of productGroups) {
    const distOffers = offerMap.get(group.quotation_item_name);
    if (!distOffers) continue;
    let cheapest: { distId: string; offer: ProductOffer } | null = null;
    for (const distId of subsetIdSet) {
      const o = distOffers.get(distId);
      if (!o) continue;
      if (!cheapest || o.unit_price_cents < cheapest.offer.unit_price_cents) cheapest = { distId, offer: o };
    }
    if (cheapest) alloc.set(group.quotation_item_name, cheapest);
  }

  // Totais correntes por distribuidora
  const totals = new Map<string, number>();
  for (const { distId, offer } of alloc.values()) {
    totals.set(distId, (totals.get(distId) ?? 0) + offer.total_price_cents);
  }

  // Corrige violações de pedido mínimo por realocação iterativa
  let changed = true;
  let iter = 0;
  while (changed && iter++ < 60) {
    changed = false;
    for (const dist of subset) {
      const total = totals.get(dist.distributor_id) ?? 0;
      if (dist.minimum_order_cents === 0 || total >= dist.minimum_order_cents) continue;

      // Candidatos: produtos alocados em outras distribuidoras que esta também tem
      const candidates: Array<{
        productName: string;
        newOffer: ProductOffer;
        currentDistId: string;
        currentOffer: ProductOffer;
        extraCost: number;
      }> = [];

      for (const [productName, { distId, offer }] of alloc) {
        if (distId === dist.distributor_id) continue;
        const newOffer = offerMap.get(productName)?.get(dist.distributor_id);
        if (!newOffer) continue;
        candidates.push({
          productName, newOffer, currentDistId: distId, currentOffer: offer,
          extraCost: newOffer.total_price_cents - offer.total_price_cents,
        });
      }
      // Ordena por menor custo extra de realocação
      candidates.sort((a, b) => a.extraCost - b.extraCost);

      let deficit = dist.minimum_order_cents - total;
      for (const c of candidates) {
        if (deficit <= 0) break;
        alloc.set(c.productName, { distId: dist.distributor_id, offer: c.newOffer });
        totals.set(dist.distributor_id, (totals.get(dist.distributor_id) ?? 0) + c.newOffer.total_price_cents);
        totals.set(c.currentDistId, (totals.get(c.currentDistId) ?? 0) - c.currentOffer.total_price_cents);
        deficit -= c.newOffer.total_price_cents;
        changed = true;
      }
      if (deficit > 0) return null; // Não consegue atingir o mínimo
    }
  }

  // Validação final: todas as distribuidoras usadas atingem o mínimo
  for (const dist of subset) {
    const total = totals.get(dist.distributor_id) ?? 0;
    if (total > 0 && dist.minimum_order_cents > 0 && total < dist.minimum_order_cents) return null;
  }

  const distResults: ComboDistributor[] = subset
    .filter((d) => (totals.get(d.distributor_id) ?? 0) > 0)
    .map((d) => {
      const subtotal = totals.get(d.distributor_id) ?? 0;
      const items: AllocItem[] = [];
      for (const [productName, { distId, offer }] of alloc) {
        if (distId === d.distributor_id) items.push({ productName, offer });
      }
      return { entry: d, items, subtotalCents: subtotal, freightCents: freightCentsFor(d, subtotal) };
    });

  return {
    distributors: distResults,
    grandTotalCents: distResults.reduce((s, d) => s + d.subtotalCents + d.freightCents, 0),
  };
}

function computeBestCombo(
  allEntries: RankingEntry[],
  productGroups: ProductGroup[]
): ValidCombo | null {
  if (productGroups.length === 0 || allEntries.length === 0) return null;

  const offerMap = new Map<string, Map<string, ProductOffer>>();
  for (const group of productGroups) {
    const m = new Map<string, ProductOffer>();
    for (const offer of group.offers) m.set(offer.distributor_id, offer);
    offerMap.set(group.quotation_item_name, m);
  }

  const N = Math.min(allEntries.length, 12);
  // Limita subsets a tamanho 4 quando há muitas distribuidoras
  const MAX_SIZE = allEntries.length <= 4 ? allEntries.length : 4;
  let best: ValidCombo | null = null;

  for (let mask = 1; mask < (1 << N); mask++) {
    let bits = 0;
    for (let b = mask; b; b >>= 1) bits += b & 1;
    if (bits > MAX_SIZE) continue;
    const subset = allEntries.filter((_, i) => (mask >> i) & 1);
    const result = trySubsetCombo(subset, productGroups, offerMap);
    if (result && (!best || result.grandTotalCents < best.grandTotalCents)) best = result;
  }

  return best;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function RankingPage() {
  useSession({ required: true });
  const { id: quotationId } = useParams<{ id: string }>();
  const router = useRouter();
  const token = useApiToken();
  const { addItem: addToCart, isInCart, openDrawer: openCartDrawer } = useCart();

  const [ranking, setRanking] = useState<RankingResult | null>(null);
  const [loadingRanking, setLoadingRanking] = useState(true);
  const [rankingError, setRankingError] = useState("");
  const [cityIsCovered, setCityIsCovered] = useState<boolean | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("cheapest");
  const [lockedModal, setLockedModal] = useState<RestrictedDistributor | null>(null);

  // Favoritos
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiFetch("/api/favorites", { method: "GET", token })
      .then(async (r) => {
        if (!r.ok) return;
        const d = await r.json() as { favorites: { distributor_id: string }[] };
        setFavoriteIds(new Set(d.favorites.map((f) => f.distributor_id)));
      })
      .catch(() => {});
  }, [token]);

  async function toggleFavorite(distId: string) {
    if (!token) return;
    const isFav = favoriteIds.has(distId);
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      isFav ? next.delete(distId) : next.add(distId);
      return next;
    });
    await apiFetch(`/api/favorites/${distId}`, {
      method: isFav ? "DELETE" : "POST", token,
    }).catch(() => {
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        isFav ? next.add(distId) : next.delete(distId);
        return next;
      });
    });
  }

  // Seleção: chave "distributorId:itemIndex"
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // ── Waitlist ──────────────────────────────────────────────────────────────
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistState, setWaitlistState] = useState<"idle" | "sending" | "done" | "error">("idle");

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchRanking = useCallback(async () => {
    if (!token) return;
    setLoadingRanking(true);
    setRankingError("");
    setSelectedKeys(new Set());

    const res = await apiFetch(`/api/quotations/${quotationId}/ranking`, {
      method: "GET",
      token,
    });
    const data = await res.json();
    setLoadingRanking(false);

    if (!res.ok) {
      setRankingError(data.error ?? "Erro ao carregar ranking.");
      return;
    }
    const result = data as RankingResult;
    setRanking(result);

    // Verifica cobertura da cidade (não bloqueia o render)
    fetch(`/api/coverage/check?city=${encodeURIComponent(result.delivery_city)}&state=${encodeURIComponent(result.delivery_state)}`)
      .then((r) => r.json())
      .then((d: { covered: boolean }) => setCityIsCovered(d.covered))
      .catch(() => setCityIsCovered(true)); // fail open
  }, [token, quotationId]);

  useEffect(() => {
    fetchRanking();
  }, [fetchRanking]);

  // ── Todas as entradas (flat, sem ordenação) ───────────────────────────────

  const allEntries = useMemo(
    () => [
      ...(ranking?.within_deadline ?? []),
      ...(ranking?.out_of_deadline ?? []),
    ],
    [ranking]
  );

  // ── Grupos por produto, com ofertas ordenadas pelo filtro ativo ───────────

  const productGroups = useMemo((): ProductGroup[] => {
    const map = new Map<string, ProductGroup>();

    for (const entry of allEntries) {
      entry.matched_items.forEach((item, itemIndex) => {
        const name = item.quotation_item_name;
        if (!map.has(name)) {
          map.set(name, {
            quotation_item_name: name,
            quantity: item.quantity,
            offers: [],
            cheapestCents: Infinity,
            image_url: item.image_url ?? null,
          });
        }
        const group = map.get(name)!;
        // Usa a primeira imagem disponível para o grupo
        if (!group.image_url && item.image_url) group.image_url = item.image_url;
        group.offers.push({
          key: `${entry.distributor_id}:${itemIndex}`,
          product_id: item.product_id,
          distributor_id: entry.distributor_id,
          company_name: entry.company_name,
          whatsapp_commercial: entry.whatsapp_commercial,
          unit_price_cents: item.unit_price_cents,
          original_price_cents: item.original_price_cents ?? item.unit_price_cents,
          total_price_cents: item.total_price_cents,
          quantity: item.quantity,
          product_name: item.product_name,
          quotation_item_name: item.quotation_item_name,
          estimated_delivery_date: entry.estimated_delivery_date,
          total_business_days: entry.total_business_days,
          within_deadline: entry.within_deadline,
          average_rating: entry.average_rating,
          review_count:   entry.review_count,
          price_change_pct: item.price_change_pct,
          image_url: item.image_url ?? null,
          promotion: item.promotion ?? null,
          freight_type: entry.freight_type,
          freight_value_cents: entry.freight_value_cents,
          free_freight_above_cents: entry.free_freight_above_cents,
          freight_notes: entry.freight_notes,
          business_hours: entry.business_hours,
          accepts_orders_outside_hours: entry.accepts_orders_outside_hours,
          distance_km: entry.distance_km,
          is_nearby: entry.is_nearby,
          minimum_order_cents: entry.minimum_order_cents,
          is_sponsored: entry.is_sponsored,
        });
        if (item.unit_price_cents < group.cheapestCents) {
          group.cheapestCents = item.unit_price_cents;
        }
      });
    }

    // Ordena as ofertas: favoritas primeiro em empate de preço
    for (const group of map.values()) {
      group.offers.sort((a, b) => {
        if (sortBy === "cheapest") {
          if (a.unit_price_cents !== b.unit_price_cents) return a.unit_price_cents - b.unit_price_cents;
          const aFav = favoriteIds.has(a.distributor_id) ? 0 : 1;
          const bFav = favoriteIds.has(b.distributor_id) ? 0 : 1;
          return aFav - bFav;
        }
        if (sortBy === "most_expensive") return b.unit_price_cents - a.unit_price_cents;
        if (sortBy === "fastest")        return a.total_business_days - b.total_business_days;
        return 0;
      });
      // Filtro de favoritas
      if (onlyFavorites) {
        group.offers = group.offers.filter((o) => favoriteIds.has(o.distributor_id));
      }
    }

    // Remove grupos sem ofertas após filtragem
    return [...map.values()].filter((g) => g.offers.length > 0);
  }, [allEntries, sortBy, favoriteIds, onlyFavorites]);

  // Produtos sem nenhuma oferta (constam apenas nos unmatched_items)
  const unavailableProducts = useMemo(() => {
    const available = new Set(productGroups.map((g) => g.quotation_item_name));
    const unavailable = new Set<string>();
    for (const entry of allEntries) {
      entry.unmatched_items.forEach((name) => {
        if (!available.has(name)) unavailable.add(name);
      });
    }
    return [...unavailable];
  }, [productGroups, allEntries]);

  // ── Sugestão inteligente (algoritmo com pedido mínimo obrigatório) ──────────

  const smartSuggestion = useMemo((): SmartResult => {
    if (productGroups.length === 0 || allEntries.length === 0) return { scenario: "none" };

    const combo = computeBestCombo(allEntries, productGroups);

    if (combo) {
      const latest = combo.distributors.reduce((a, b) =>
        a.entry.total_business_days >= b.entry.total_business_days ? a : b
      );
      if (combo.distributors.length >= 2) {
        return {
          scenario: "A",
          combo,
          distributorCount: combo.distributors.length,
          latestDeliveryDate: latest.entry.estimated_delivery_date,
        };
      }
      return { scenario: "B", combo, latestDeliveryDate: latest.entry.estimated_delivery_date };
    }

    // Cenário C: nenhuma combinação válida
    const noMinimumEntries = allEntries.filter((e) => e.minimum_order_cents === 0);

    let nearestEntry: { entry: RankingEntry; shortfall: number; cheapestOffer: ProductOffer | null } | null = null;
    for (const entry of allEntries) {
      if (entry.minimum_order_cents === 0) continue;
      const potentialCents = productGroups.reduce((sum, g) => {
        const o = g.offers.find((o) => o.distributor_id === entry.distributor_id);
        return sum + (o?.total_price_cents ?? 0);
      }, 0);
      const shortfall = entry.minimum_order_cents - potentialCents;
      if (shortfall <= 0) continue;
      const cheapestOffer =
        productGroups
          .flatMap((g) => g.offers.filter((o) => o.distributor_id === entry.distributor_id))
          .sort((a, b) => a.unit_price_cents - b.unit_price_cents)[0] ?? null;
      if (!nearestEntry || shortfall < nearestEntry.shortfall) {
        nearestEntry = { entry, shortfall, cheapestOffer };
      }
    }

    return { scenario: "C", noMinimumEntries, nearestEntry };
  }, [productGroups, allEntries]);

  // ── Total potencial por distribuidora (todos os produtos que ela oferece) ──

  const distributorPotentialTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const group of productGroups) {
      for (const offer of group.offers) {
        map.set(offer.distributor_id, (map.get(offer.distributor_id) ?? 0) + offer.total_price_cents);
      }
    }
    return map;
  }, [productGroups]);

  // Oferta mais barata por distribuidora (para sugestão de "adicionar à cotação")
  const distributorCheapestOffer = useMemo(() => {
    const map = new Map<string, ProductOffer>();
    for (const group of productGroups) {
      for (const offer of group.offers) {
        const cur = map.get(offer.distributor_id);
        if (!cur || offer.unit_price_cents < cur.unit_price_cents) map.set(offer.distributor_id, offer);
      }
    }
    return map;
  }, [productGroups]);

  // ── Funções de seleção ────────────────────────────────────────────────────

  function toggleItem(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
    setConfirmPhase(false);
  }

  function applySmartSuggestion() {
    if (smartSuggestion.scenario === "none" || smartSuggestion.scenario === "C") return;
    setSelectedKeys(
      new Set(smartSuggestion.combo.distributors.flatMap((d) => d.items.map((i) => i.offer.key)))
    );
    setConfirmPhase(false);
  }

  const suggestionApplied: boolean = (() => {
    if (smartSuggestion.scenario !== "A" && smartSuggestion.scenario !== "B") return false;
    const keys = smartSuggestion.combo.distributors.flatMap((d) => d.items.map((i) => i.offer.key));
    return keys.every((k) => selectedKeys.has(k)) && selectedKeys.size === keys.length;
  })();

  // ── Agrupamento por distribuidora ─────────────────────────────────────────

  const selectedByDistributor = useMemo(() => {
    const map = new Map<
      string,
      { entry: RankingEntry; items: MatchedItem[]; totalCents: number }
    >();

    for (const key of selectedKeys) {
      const colon = key.indexOf(":");
      const distId = key.slice(0, colon);
      const idx = Number(key.slice(colon + 1));

      const entry = allEntries.find((e) => e.distributor_id === distId);
      if (!entry) continue;
      const item = entry.matched_items[idx];
      if (!item) continue;

      if (!map.has(distId)) map.set(distId, { entry, items: [], totalCents: 0 });
      const group = map.get(distId)!;
      group.items.push(item);
      group.totalCents += item.total_price_cents;
    }

    return map;
  }, [selectedKeys, allEntries]);

  const totalSelectedCents = useMemo(
    () => [...selectedByDistributor.values()].reduce((s, g) => s + g.totalCents, 0),
    [selectedByDistributor]
  );

  // ── Fase do fluxo: seleção → confirmação ─────────────────────────────────

  const [confirmPhase, setConfirmPhase] = useState(false);

  // ── Estado por distribuidora: idle | sending | sent ───────────────────────

  const [distState, setDistState] = useState<Map<string, "idle" | "sending" | "sent">>(
    new Map()
  );
  const [distError, setDistError] = useState<Map<string, string>>(new Map());

  function getDistState(id: string): "idle" | "sending" | "sent" {
    return distState.get(id) ?? "idle";
  }

  // ── Modal de envio ────────────────────────────────────────────────────────

  const [sendModal, setSendModal] = useState<{ distId: string } | null>(null);

  // Distribuidoras com credencial já confirmada como aprovada nesta sessão
  const [approvedCredentials, setApprovedCredentials] = useState<Set<string>>(new Set());

  // ── Registra o pedido na API ──────────────────────────────────────────────
  // send_channel controla se email/whatsapp server-side disparam.
  // Retorna o resultado da API ou null em caso de erro.

  async function registerOrder(
    distId: string,
    send_channel: "whatsapp" | "email" | "both"
  ): Promise<{ credential_status: string } | null> {
    if (!token || !ranking) return null;
    const group = selectedByDistributor.get(distId);
    if (!group) return null;

    setDistState((prev) => new Map(prev).set(distId, "sending"));
    setDistError((prev) => { const n = new Map(prev); n.delete(distId); return n; });

    try {
      const res = await apiFetch(`/api/quotations/${quotationId}/send`, {
        method: "POST",
        token,
        body: JSON.stringify({
          orders: [
            {
              distributor_id: distId,
              items: group.items.map((i) => ({
                product_name: i.product_name,
                brand: i.quotation_item_brand,
                category: "other",
                packaging: "",
                quantity: i.quantity,
                unit_price_cents: i.unit_price_cents,
              })),
              total_cents: group.totalCents,
              estimated_delivery_date: group.entry.estimated_delivery_date,
              send_channel,
            },
          ],
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setDistState((prev) => new Map(prev).set(distId, "idle"));
        setDistError((prev) =>
          new Map(prev).set(distId, data.error ?? "Erro ao registrar pedido.")
        );
        return null;
      }

      setDistState((prev) => new Map(prev).set(distId, "sent"));

      // Atualiza mapa de credenciais aprovadas
      const orderResult = data.orders?.[0];
      if (orderResult?.credential_status === "existing" || orderResult?.credential_status === "approved") {
        setApprovedCredentials((prev) => new Set(prev).add(distId));
      }

      return orderResult ?? {};
    } catch {
      setDistState((prev) => new Map(prev).set(distId, "idle"));
      setDistError((prev) =>
        new Map(prev).set(distId, "Erro de conexão. Tente novamente.")
      );
      return null;
    }
  }

  // ── Envia por canal escolhido ─────────────────────────────────────────────
  // Na primeira chamada registra o pedido; nas seguintes só reabre o link.

  async function handleSend(distId: string, channel: "whatsapp" | "email" | "both") {
    if (!ranking) return;
    const group = selectedByDistributor.get(distId);
    if (!group) return;

    const state = getDistState(distId);
    if (state === "sending") return;

    // Registra o pedido apenas uma vez
    if (state === "idle") {
      const result = await registerOrder(distId, channel);
      if (!result) return;
    }

    // WhatsApp: abre wa.me no navegador do comprador
    if (channel === "whatsapp" || channel === "both") {
      window.open(
        buildWhatsAppUrl(group.entry, group.items, group.totalCents, ranking.delivery_city),
        "_blank",
        "noopener,noreferrer"
      );
    }
    // Email: já disparado server-side — sem ação adicional no cliente
  }

  const allSent =
    selectedByDistributor.size > 0 &&
    [...selectedByDistributor.keys()].every((id) => getDistState(id) === "sent");

  // ── Skeleton ──────────────────────────────────────────────────────────────

  if (loadingRanking) {
    return (
      <div className="flex min-h-screen flex-col bg-[#F5F7FB]">
        <Navbar />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
          <div className="mb-4 h-8 w-48 animate-pulse rounded bg-[#DBEAFE]" />
          <div className="mb-6 h-36 animate-pulse rounded-3xl bg-[#22C55E]/20" />
          {[1, 2, 3].map((n) => (
            <div key={n} className="mb-4 h-40 animate-pulse rounded-3xl bg-[#DBEAFE]/50" />
          ))}
        </main>
      </div>
    );
  }

  // ── Cidade fora de cobertura ──────────────────────────────────────────────

  if (ranking && cityIsCovered === false) {
    return <CoverageWaitlistScreen city={ranking.delivery_city} state={ranking.delivery_state} />;
  }

  const selectedCount = selectedKeys.size;

  // ── Fase de confirmação: substitui o conteúdo principal ───────────────────

  if (confirmPhase) {
    return (
      <div className="flex min-h-screen flex-col bg-[#F5F7FB]">
        <Navbar />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-12 pt-8">

          {/* Cabeçalho da fase de confirmação */}
          <div className="mb-6 flex items-center gap-3">
            <button
              onClick={() => setConfirmPhase(false)}
              className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-[#DBEAFE] hover:text-[#0F172A] transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Editar seleção
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-display font-semibold text-[#0F172A]">
                Resumo do pedido
              </h1>
              <p className="text-sm text-slate-500">
                {selectedByDistributor.size} distribuidora(s) · {selectedCount} item(ns) selecionado(s)
              </p>
            </div>
          </div>

          {/* Blocos por distribuidora */}
          {[...selectedByDistributor.entries()].map(([distId, group]) => {
            const state = getDistState(distId);
            const err = distError.get(distId);
            const isSent = state === "sent";
            const isSending = state === "sending";

            return (
              <div
                key={distId}
                className={[
                  "mb-4 overflow-hidden rounded-3xl border shadow-sm transition-all",
                  isSent ? "border-green-200 bg-green-50/40" : "border-[#DBEAFE] bg-white",
                ].join(" ")}
              >
                {/* Header */}
                <div className={["border-b px-5 py-3", isSent ? "border-green-200" : "border-[#DBEAFE]"].join(" ")}>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Distribuidora</p>
                  <p className="font-semibold text-[#0F172A]">{group.entry.company_name}</p>
                </div>

                {/* Itens */}
                <ul className="divide-y divide-[#DBEAFE] px-5">
                  {group.items.map((item, i) => (
                    <li key={i} className="flex items-center justify-between py-3 text-sm">
                      <span className="text-[#0F172A]">
                        {item.product_name}{" "}
                        <span className="text-slate-400">× {item.quantity}</span>
                      </span>
                      <span className="font-medium text-[#0F172A]">
                        {formatBRL(item.total_price_cents)}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Footer */}
                <div className={["flex items-center justify-between border-t px-5 py-4", isSent ? "border-green-200" : "border-[#DBEAFE]"].join(" ")}>
                  <div>
                    <p className="text-sm font-bold text-[#0F172A]">
                      Subtotal: <span className="text-[#22C55E]">{formatBRL(group.totalCents)}</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      Entrega {group.entry.estimated_delivery_date}
                    </p>
                    {group.entry.minimum_order_cents > 0 && group.totalCents < group.entry.minimum_order_cents && (
                      <p className="mt-1 text-xs font-semibold text-orange-600">
                        Adicione {formatBRL(group.entry.minimum_order_cents - group.totalCents)} para atingir o pedido mínimo de {formatBRL(group.entry.minimum_order_cents)}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {err && <p className="text-xs text-red-600">{err}</p>}
                    {isSent ? (
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="flex items-center gap-1.5 rounded-xl bg-green-100 px-4 py-2 text-sm font-bold text-green-700">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          Cotação enviada
                        </span>
                        <button
                          onClick={() => setSendModal({ distId })}
                          className="text-xs text-slate-400 underline hover:text-slate-600"
                        >
                          Reenviar por outro canal
                        </button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        loading={isSending}
                        onClick={() => setSendModal({ distId })}
                      >
                        Confirmar cotação
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Total geral */}
          <div className="mb-6 flex items-center justify-between rounded-2xl border border-[#DBEAFE] bg-white px-5 py-4 shadow-sm">
            <p className="font-bold text-[#0F172A]">Total geral</p>
            <p className="text-2xl font-semibold text-[#22C55E]">{formatBRL(totalSelectedCents)}</p>
          </div>

          {/* Ver histórico quando tudo for enviado */}
          {allSent && (
            <Button
              fullWidth
              variant="secondary"
              size="lg"
              onClick={() => router.push("/historico")}
            >
              Ver histórico de pedidos →
            </Button>
          )}
        </main>

        {/* ── Modal de envio ──────────────────────────────────────────────── */}
        {sendModal && (() => {
          const { distId } = sendModal;
          const group = selectedByDistributor.get(distId);
          if (!group) return null;
          const state = getDistState(distId);
          const err = distError.get(distId);
          const isSending = state === "sending";
          const isSent = state === "sent";

          return (
            <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
              {/* Overlay */}
              <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={() => { if (!isSending) setSendModal(null); }}
              />

              {/* Painel */}
              <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">

                {/* Header */}
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                      Enviar cotação para
                    </p>
                    <p className="text-lg font-bold text-[#0F172A]">
                      {group.entry.company_name}
                    </p>
                    <p className="text-xs text-slate-400">
                      Entrega {group.entry.estimated_delivery_date}
                    </p>
                  </div>
                  {!isSending && (
                    <button
                      onClick={() => setSendModal(null)}
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F5F7FB] text-slate-400 hover:bg-[#DBEAFE] hover:text-[#0F172A]"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Itens */}
                <ul className="mb-4 divide-y divide-[#DBEAFE] rounded-2xl border border-[#DBEAFE]">
                  {group.items.map((item, i) => (
                    <li key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span className="text-[#0F172A]">
                        {item.product_name}{" "}
                        <span className="text-slate-400">× {item.quantity}</span>
                      </span>
                      <span className="font-medium">{formatBRL(item.total_price_cents)}</span>
                    </li>
                  ))}
                  <li className="flex items-center justify-between rounded-b-2xl bg-[#F5F7FB] px-4 py-2.5 text-sm font-bold">
                    <span>Total</span>
                    <span className="text-[#22C55E]">{formatBRL(group.totalCents)}</span>
                  </li>
                </ul>

                {/* Aviso de credencial — exibe quando não há credencial confirmada */}
                {!approvedCredentials.has(distId) && !isSent && (
                  <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <p className="text-xs text-amber-800">
                      Sua ficha cadastral será enviada junto com a cotação para análise de crédito desta distribuidora.
                    </p>
                  </div>
                )}

                {/* Feedback */}
                {err && (
                  <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>
                )}
                {isSent && (
                  <div className="mb-3 flex items-center gap-2 rounded-xl bg-green-50 px-3 py-2 text-xs font-bold text-green-700">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                    </svg>
                    Pedido enviado com sucesso por e-mail!
                  </div>
                )}

                {/* Botão de envio por E-mail */}
                <button
                  onClick={() => handleSend(distId, "email")}
                  disabled={isSending}
                  className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white transition disabled:opacity-50 ${
                    isSent 
                      ? "bg-[#0B1220] hover:opacity-90" 
                      : "bg-[#22C55E] hover:bg-[#16A34A]"
                  }`}
                >
                  {isSending ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"/>
                      Enviando…
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4 text-white" viewBox="0 0 24 18" fill="none">
                        <rect x="1" y="1" width="22" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.6"/>
                        <path d="M1.5 2L12 10.5 22.5 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                      </svg>
                      {isSent ? "Reenviar pedido por E-mail" : "Enviar pedido por E-mail"}
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  // ── Fase de seleção ───────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F7FB]">
      <Navbar />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-36 pt-8">

        {/* Voltar e editar */}
        <button
          onClick={() => router.push(`/cotacao/${quotationId}`)}
          className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-[#0F172A] transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Voltar e editar
        </button>

        {/* Cabeçalho */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#0F172A]">
              Ranking de preços
            </h1>
            <p className="text-sm text-slate-500">
              {productGroups.length} produto(s) · {allEntries.length} distribuidora(s)
              {ranking?.from_cache && (
                <span className="ml-2 text-xs text-slate-400">(cache)</span>
              )}
            </p>
          </div>
          <button
            onClick={fetchRanking}
            className="rounded-xl p-2 text-slate-400 hover:bg-[#DBEAFE] hover:text-[#0F172A]"
            title="Atualizar ranking"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Filtros */}
        <div className="mb-5 flex flex-wrap gap-2">
          {(
            [
              { key: "cheapest",       label: "Mais barato" },
              { key: "most_expensive", label: "Mais caro" },
              { key: "fastest",        label: "Entrega mais rápida" },
            ] as { key: SortBy; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                sortBy === key
                  ? "bg-[#22C55E] text-white"
                  : "border border-[#DBEAFE] bg-white text-slate-600 hover:bg-[#F0FDF4]"
              }`}
            >
              {label}
            </button>
          ))}

          {/* Filtro de favoritas */}
          {favoriteIds.size > 0 && (
            <button
              onClick={() => setOnlyFavorites((v) => !v)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                onlyFavorites
                  ? "bg-red-500 text-white"
                  : "border border-[#DBEAFE] bg-white text-slate-600 hover:bg-red-50"
              }`}
            >
              <Heart size={14} className={onlyFavorites ? "fill-current" : ""} /> Só favoritas
            </button>
          )}
        </div>

        {rankingError && (
          <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {rankingError}
          </div>
        )}

        {productGroups.length === 0 && !rankingError && ranking && (
          <EmptyRegion
            city={ranking.delivery_city}
            state={ranking.delivery_state}
            email={waitlistEmail}
            onEmailChange={setWaitlistEmail}
            status={waitlistState}
            onSubmit={async () => {
              if (!waitlistEmail || waitlistState !== "idle") return;
              setWaitlistState("sending");
              try {
                const res = await fetch("/api/waitlist", {
                  method:  "POST",
                  headers: { "Content-Type": "application/json" },
                  body:    JSON.stringify({
                    email: waitlistEmail,
                    city:  ranking.delivery_city,
                    state: ranking.delivery_state,
                  }),
                });
                setWaitlistState(res.ok ? "done" : "error");
              } catch {
                setWaitlistState("error");
              }
            }}
          />
        )}

        {/* ── Sugestão inteligente ──────────────────────────────────────────── */}
        {smartSuggestion.scenario !== "none" && (
          <>
            {/* Cenário A: combinação multi-distribuidora */}
            {smartSuggestion.scenario === "A" && (
              <div className="mb-6 overflow-hidden rounded-3xl bg-[#2563EB] shadow-lg">
                <div className="px-5 pt-5 pb-3">
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                    <Sparkles size={12} className="inline mr-1" />Sugestão inteligente
                  </span>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    Melhor combinação: {smartSuggestion.distributorCount} distribuidoras
                  </h2>
                  <p className="mt-0.5 text-sm text-white/70">
                    Todos os pedidos mínimos atendidos — menor custo total com frete.
                  </p>
                </div>

                {smartSuggestion.combo.distributors.map((dist) => (
                  <div key={dist.entry.distributor_id} className="mx-5 mb-3 overflow-hidden rounded-2xl bg-white/10">
                    <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
                      <span className="text-sm font-bold text-white">{dist.entry.company_name}</span>
                      <span className="text-xs text-white/60">{dist.entry.estimated_delivery_date}</span>
                    </div>
                    {dist.items.map(({ offer, productName }) => (
                      <div key={offer.key} className="flex items-center justify-between border-b border-white/5 px-4 py-2 text-sm">
                        <span className="min-w-0 truncate text-white/80">{productName}</span>
                        <span className="ml-3 shrink-0 font-bold text-white">
                          {formatBRL(offer.total_price_cents)}
                          <span className="ml-1 font-normal text-white/50">×{offer.quantity}</span>
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between bg-white/5 px-4 py-2">
                      <span className="text-xs font-semibold text-white/60">Subtotal</span>
                      <span className="text-sm font-bold text-white">{formatBRL(dist.subtotalCents)}</span>
                    </div>
                    {dist.freightCents > 0 && (
                      <div className="flex items-center justify-between border-t border-white/5 bg-white/5 px-4 py-1.5">
                        <span className="text-xs text-white/50">+ Frete</span>
                        <span className="text-xs text-white/70">{formatBRL(dist.freightCents)}</span>
                      </div>
                    )}
                  </div>
                ))}

                <div className="flex items-center justify-between border-t border-white/20 px-5 py-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-white/60">Total com frete</p>
                    <p className="text-2xl font-semibold text-white">{formatBRL(smartSuggestion.combo.grandTotalCents)}</p>
                    <p className="mt-0.5 text-xs text-white/60">Chegará tudo até {smartSuggestion.latestDeliveryDate}</p>
                  </div>
                  {suggestionApplied ? (
                    <button
                      onClick={() => { setSelectedKeys(new Set()); setConfirmPhase(false); }}
                      className="rounded-xl border border-white/40 bg-transparent px-5 py-2.5 text-sm font-bold text-white/80 transition-all hover:bg-white/10 active:scale-95"
                    >
                      Desfazer sugestão
                    </button>
                  ) : (
                    <button
                      onClick={applySmartSuggestion}
                      className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-[#2563EB] transition-all hover:bg-white/90 active:scale-95"
                    >
                      Usar esta sugestão
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Cenário B: apenas 1 distribuidora viável */}
            {smartSuggestion.scenario === "B" && (
              <div className="mb-6 overflow-hidden rounded-3xl bg-[#2563EB] shadow-lg">
                <div className="px-5 pt-5 pb-3">
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                    <Sparkles size={12} className="inline mr-1" />Melhor opção para seu pedido
                  </span>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    {smartSuggestion.combo.distributors[0]?.entry.company_name}
                  </h2>
                  <p className="mt-0.5 text-sm text-white/70">
                    Outras distribuidoras exigem pedido mínimo que seu pedido não atinge.
                  </p>
                </div>

                <div className="mx-5 mb-3 overflow-hidden rounded-2xl bg-white/10">
                  {smartSuggestion.combo.distributors[0]?.items.map(({ offer, productName }) => (
                    <div key={offer.key} className="flex items-center justify-between border-b border-white/5 px-4 py-2.5 text-sm">
                      <span className="min-w-0 truncate text-white/80">{productName}</span>
                      <span className="ml-3 shrink-0 font-bold text-white">{formatBRL(offer.total_price_cents)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t border-white/20 px-5 py-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-white/60">Total</p>
                    <p className="text-2xl font-semibold text-white">{formatBRL(smartSuggestion.combo.grandTotalCents)}</p>
                    <p className="mt-0.5 text-xs text-white/60">Entrega {smartSuggestion.latestDeliveryDate}</p>
                  </div>
                  {suggestionApplied ? (
                    <button
                      onClick={() => { setSelectedKeys(new Set()); setConfirmPhase(false); }}
                      className="rounded-xl border border-white/40 bg-transparent px-5 py-2.5 text-sm font-bold text-white/80 transition-all hover:bg-white/10 active:scale-95"
                    >
                      Desfazer sugestão
                    </button>
                  ) : (
                    <button
                      onClick={applySmartSuggestion}
                      className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-[#2563EB] transition-all hover:bg-white/90 active:scale-95"
                    >
                      Usar esta sugestão
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Cenário C: nenhuma distribuidora fecha o mínimo */}
            {smartSuggestion.scenario === "C" && (
              <div className="mb-6 rounded-3xl border border-amber-200 bg-amber-50 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                    <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-amber-900">Pedido abaixo do mínimo exigido</p>
                    <p className="mt-0.5 text-sm text-amber-700">
                      Seu pedido atual não atinge o pedido mínimo das distribuidoras disponíveis.
                    </p>
                  </div>
                </div>

                {smartSuggestion.nearestEntry && (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-white px-4 py-3">
                    <p className="text-sm font-semibold text-[#0F172A]">
                      Adicione{" "}
                      <span className="font-bold text-[#22C55E]">
                        {formatBRL(smartSuggestion.nearestEntry.shortfall)}
                      </span>{" "}
                      para atingir o mínimo de{" "}
                      <span className="font-bold">{smartSuggestion.nearestEntry.entry.company_name}</span>.
                    </p>
                    {smartSuggestion.nearestEntry.cheapestOffer && (
                      <p className="mt-1 text-xs text-slate-500">
                        Dica: adicione{" "}
                        <strong>
                          {Math.ceil(
                            smartSuggestion.nearestEntry.shortfall /
                            smartSuggestion.nearestEntry.cheapestOffer.unit_price_cents
                          )}{" "}
                          unidade(s) de{" "}
                          {smartSuggestion.nearestEntry.cheapestOffer.quotation_item_name}
                        </strong>{" "}
                        para completar o pedido mínimo.
                      </p>
                    )}
                    <button
                      onClick={() => router.push(`/cotacao/${quotationId}`)}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-[#22C55E] px-4 py-2 text-sm font-bold text-white hover:bg-[#16A34A]"
                    >
                      Editar cotação →
                    </button>
                  </div>
                )}

                {smartSuggestion.noMinimumEntries.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-bold text-amber-800">Opções sem pedido mínimo:</p>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {smartSuggestion.noMinimumEntries.map((e) => (
                        <span
                          key={e.distributor_id}
                          className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-semibold text-amber-800"
                        >
                          {e.company_name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Cards por produto ────────────────────────────────────────────── */}
        {productGroups.map((group) => {
          const anySelected = group.offers.some((o) => selectedKeys.has(o.key));

          return (
            <div
              key={group.quotation_item_name}
              className={[
                "mb-4 overflow-hidden rounded-3xl border bg-white shadow-sm transition-all",
                anySelected ? "border-[#22C55E] ring-2 ring-[#DBEAFE]" : "border-[#DBEAFE]",
              ].join(" ")}
            >
              <div className="flex items-center gap-3 border-b border-[#DBEAFE] px-5 py-4">
                {group.image_url ? (
                  <img
                    src={group.image_url}
                    alt={group.quotation_item_name}
                    className="h-12 w-12 shrink-0 rounded-xl object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-[#0F172A]">{group.quotation_item_name}</h3>
                  <p className="text-xs text-slate-400">
                    Quantidade: {group.quantity} · {group.offers.length} oferta(s)
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-slate-400">A partir de</p>
                  <p className="font-mono font-medium text-[#22C55E]">{formatBRL(group.cheapestCents)}/un</p>
                </div>
              </div>

              <ul className="divide-y divide-[#DBEAFE]">
                {group.offers.map((offer, offerIdx) => {
                  const checked = selectedKeys.has(offer.key);
                  const isCheapest = offer.unit_price_cents === group.cheapestCents;
                  const isFastest =
                    offer.total_business_days ===
                    Math.min(...group.offers.map((o) => o.total_business_days));

                  const isNearestInGroup =
                    offer.distance_km !== null &&
                    offer.distance_km ===
                      Math.min(
                        ...group.offers
                          .filter((o) => o.distance_km !== null)
                          .map((o) => o.distance_km!)
                      );

                  // Shortfall baseado no potencial total da distribuidora (todos os produtos)
                  const distPotential = distributorPotentialTotals.get(offer.distributor_id) ?? 0;
                  const distShortfall = offer.minimum_order_cents > 0 && distPotential < offer.minimum_order_cents
                    ? offer.minimum_order_cents - distPotential
                    : 0;
                  const potentialScenario = minOrderScenario(distPotential, offer.minimum_order_cents);

                  return (
                    <li
                      key={offer.key}
                      onClick={() => toggleItem(offer.key)}
                      className={[
                        "flex cursor-pointer flex-col gap-0 px-5 py-3.5 transition-colors",
                        checked ? "bg-[#F0FDF4]" : "hover:bg-[#F5F7FB]",
                        !offer.within_deadline ? "opacity-60" : "",
                        potentialScenario === "below" ? "border-l-2 border-orange-400" : "",
                        potentialScenario === "close"  ? "border-l-2 border-amber-400"  : "",
                      ].join(" ")}
                    >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleItem(offer.key)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 shrink-0 rounded accent-[#22C55E]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-medium text-[#0F172A] truncate">
                            {offer.company_name}
                          </span>
                          {offer.is_sponsored && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                              Patrocinado
                            </span>
                          )}
                          {/* Coração de favorito */}
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(offer.distributor_id); }}
                            className="text-base leading-none transition-transform hover:scale-110"
                            title={favoriteIds.has(offer.distributor_id) ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                          >
                            <Heart size={14} className={favoriteIds.has(offer.distributor_id) ? "fill-current text-red-500" : "text-slate-400"} />
                          </button>
                          {favoriteIds.has(offer.distributor_id) && (
                            <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-500">FAVORITA</span>
                          )}
                          {offerIdx === 0 && sortBy === "cheapest" && isCheapest && (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
                              Mais barato
                            </span>
                          )}
                          {offerIdx === 0 && sortBy === "fastest" && isFastest && (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
                              Mais rápido
                            </span>
                          )}
                          {!offer.within_deadline && (
                            <Badge variant="yellow">fora do prazo</Badge>
                          )}
                          {isNearestInGroup && (
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                              Mais próxima
                            </span>
                          )}
                          {offer.average_rating !== null && offer.review_count > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[11px] text-slate-500">
                              <Star size={11} className="fill-amber-400 text-amber-400" />
                              {offer.average_rating.toFixed(1)} ({offer.review_count})
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <p className="text-xs text-slate-400">{offer.estimated_delivery_date}</p>
                          {offer.distance_km !== null && (
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${offer.is_nearby ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-500"}`}>
                              <MapPin size={10} className="inline" /> {offer.distance_km < 1 ? "< 1 km" : `${offer.distance_km.toFixed(0)} km`}
                            </span>
                          )}
                          {/* Badge horário de funcionamento */}
                          {(() => {
                            const open = isDistributorOpen(offer.business_hours);
                            const todayHours = businessHoursToday(offer.business_hours);
                            if (!offer.business_hours) return null;
                            return (
                              <span
                                title={todayHours ? `Hoje: ${todayHours}` : "Fechado hoje"}
                                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${open ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}
                              >
                                {open ? "Aberto" : offer.accepts_orders_outside_hours ? "Fora do horário — pedido na fila" : "Fechado agora"}
                              </span>
                            );
                          })()}
                          <FreightBadge
                            freight_type={offer.freight_type}
                            freight_value_cents={offer.freight_value_cents}
                            free_freight_above_cents={offer.free_freight_above_cents}
                            freight_notes={offer.freight_notes}
                            orderTotalCents={offer.total_price_cents}
                          />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={["font-mono font-medium text-[15px]", checked ? "text-[#22C55E]" : offer.promotion ? "text-red-600" : "text-[#0F172A]"].join(" ")}>
                          {formatBRL(offer.total_price_cents)}
                        </p>
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          {offer.promotion ? (
                            <>
                              <PriceMono cents={offer.original_price_cents} crossed className="text-[11px]" />
                              <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-mono font-medium text-red-600">
                                PROMO
                                {offer.promotion.type === "percentage" && offer.promotion.discount_percentage != null
                                  ? ` -${offer.promotion.discount_percentage.toFixed(0)}%`
                                  : ""}
                              </span>
                            </>
                          ) : (
                            <span className="font-mono text-[11px] font-medium text-slate-400">{formatBRL(offer.unit_price_cents)}/un</span>
                          )}
                          <PriceChangeIndicator pct={offer.price_change_pct} />
                        </div>
                        {/* Botão adicionar ao carrinho */}
                        {offer.product_id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              addToCart(offer.product_id, offer.distributor_id, offer.quantity);
                              openCartDrawer();
                            }}
                            className={[
                              "mt-1.5 flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold transition",
                              isInCart(offer.product_id, offer.distributor_id)
                                ? "bg-[#22C55E]/10 text-[#16A34A]"
                                : "bg-slate-100 text-slate-500 hover:bg-[#2563EB]/10 hover:text-[#2563EB]",
                            ].join(" ")}
                          >
                            {isInCart(offer.product_id, offer.distributor_id) ? (
                              <><Check size={9} />No carrinho</>
                            ) : (
                              <><ShoppingCart size={9} />Carrinho</>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Shortfall de pedido mínimo — baseado no potencial total da distribuidora */}
                    {distShortfall > 0 && (() => {
                      const cheapest = distributorCheapestOffer.get(offer.distributor_id);
                      const unitsNeeded = cheapest
                        ? Math.ceil(distShortfall / cheapest.unit_price_cents)
                        : null;
                      return (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="mt-2 flex items-center gap-2 rounded-xl border border-orange-100 bg-orange-50 px-3 py-2 text-xs"
                        >
                          <span className="font-semibold text-orange-700">
                            Faltam {formatBRL(distShortfall)} para o pedido mínimo
                            {cheapest && unitsNeeded && (
                              <> — adicione <strong>{unitsNeeded}</strong> {unitsNeeded === 1 ? "unidade" : "unidades"} de <strong>{cheapest.quotation_item_name}</strong></>
                            )}
                          </span>
                          <button
                            onClick={() => router.push(`/cotacao/${quotationId}`)}
                            className="ml-auto shrink-0 rounded-lg bg-[#22C55E] px-2.5 py-1 text-[10px] font-bold text-white hover:bg-[#16A34A]"
                          >
                            Adicionar à cotação
                          </button>
                        </div>
                      );
                    })()}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}

        {/* Produtos indisponíveis */}
        {unavailableProducts.length > 0 && (
          <div className="mb-4 rounded-3xl border border-[#DBEAFE] bg-white shadow-sm">
            <div className="border-b border-[#DBEAFE] px-5 py-4">
              <h3 className="font-bold text-slate-400">Produtos indisponíveis</h3>
              <p className="text-xs text-slate-400">
                Nenhuma distribuidora da sua região oferece estes itens.
              </p>
            </div>
            <ul className="divide-y divide-[#DBEAFE]">
              {unavailableProducts.map((name) => (
                <li key={name} className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm text-slate-400 line-through">{name}</span>
                  <Badge variant="gray">indisponível</Badge>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Distribuidoras restritas (fora do plano) ──────────────────────── */}
        {(ranking?.restricted_distributors ?? []).length > 0 && (
          <div className="mb-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                Distribuidoras fora do seu plano
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            {ranking!.restricted_distributors.map((rd) => {
              const isCheaper  = rd.savings_vs_best_cents > 0;
              const secondBest = allEntries
                .filter((e) => e.all_items_available)
                .sort((a, b) => a.total_cents - b.total_cents)[1];
              const secondBestTotal = secondBest?.total_cents ?? 0;
              const savingsVsSecond = secondBestTotal - rd.total_cents;

              const phrase = isCheaper
                ? `Esta distribuidora tem o menor preço para os seus itens — você economizaria ${formatBRL(rd.savings_vs_best_cents)} neste pedido.`
                : savingsVsSecond > 0
                  ? `${formatBRL(savingsVsSecond)} mais barato que sua segunda opção atual.`
                  : "Distribuidora fora do seu plano — assine o Pro para ver preços e cotar.";

              return (
                <div
                  key={rd.distributor_id}
                  onClick={() => setLockedModal(rd)}
                  className="relative mb-3 cursor-pointer overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
                >
                  {/* Overlay esfumaçado */}
                  <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-[2px]" />

                  {/* Cadeado */}
                  <div className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 shadow">
                    <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>

                  {/* Conteúdo (visível mas desfocado) */}
                  <div className="px-5 py-4">
                    <p className="font-bold text-[#0F172A]">{rd.company_name}</p>
                    <p className="text-sm font-mono font-medium text-[#0F172A]">{rd.total_brl}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{rd.matched_item_names.join(", ")}</p>
                  </div>

                  {/* Frase dinâmica — visível sobre o overlay */}
                  <div className="absolute inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-5 py-3">
                    <p className="text-xs font-semibold text-slate-700">{phrase}</p>
                    <span className="mt-1 inline-block text-xs font-bold text-[#22C55E]">Assinar Pro →</span>
                  </div>
                  {/* Espaçador para o texto não sobrepor o conteúdo */}
                  <div className="h-16" />
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Modal de distribuidora bloqueada ─────────────────────────────────── */}
      {lockedModal && (() => {
        const rd = lockedModal;
        const isCheaper = rd.savings_vs_best_cents > 0;
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setLockedModal(null)} />
            <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Distribuidora bloqueada</p>
                  <p className="text-lg font-bold text-[#0F172A]">{rd.company_name}</p>
                </div>
                <button onClick={() => setLockedModal(null)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"><X size={14} /></button>
              </div>

              <div className="mb-5 rounded-2xl border border-[#22C55E]/20 bg-[#F0FDF4] p-4 text-center">
                <p className="text-xs font-semibold text-slate-600">
                  {isCheaper
                    ? "Com esta distribuidora você economizaria"
                    : "Preço total nesta distribuidora"}
                </p>
                <p className="mt-1 text-3xl font-extrabold text-[#22C55E]">
                  {isCheaper ? formatBRL(rd.savings_vs_best_cents) : rd.total_brl}
                </p>
                {isCheaper && (
                  <p className="mt-0.5 text-xs font-medium text-slate-500">
                    em relação à melhor opção disponível no seu plano atual
                  </p>
                )}
              </div>

              <button
                className="mb-2 w-full rounded-2xl bg-[#22C55E] py-3.5 text-sm font-bold text-white hover:bg-[#16A34A]"
                onClick={() => setLockedModal(null)}
              >
                Assinar Pro — R$ 99/mês
              </button>
              <button
                className="w-full rounded-2xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                onClick={() => setLockedModal(null)}
              >
                Ver benefícios do plano Pro
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Barra fixa: Concluir pedido ───────────────────────────────────── */}
      {selectedCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#DBEAFE] bg-white/95 px-4 py-4 backdrop-blur-sm">
          <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[#0F172A]">
                {selectedCount} item(ns) selecionado(s)
              </p>
              <p className="text-xs text-slate-400">
                {selectedByDistributor.size} distribuidora(s) · {formatBRL(totalSelectedCents)}
              </p>
            </div>
            <Button size="lg" onClick={() => setConfirmPhase(true)}>
              Concluir pedido →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
