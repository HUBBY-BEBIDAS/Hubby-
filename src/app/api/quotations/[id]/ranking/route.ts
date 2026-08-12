import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { normalizeCityName } from "@/lib/coverage";
import { computeRanking, extractDistributorIds } from "@/lib/ranking-engine";
import { getRankingCache, setRankingCache } from "@/lib/ranking-cache";
import type { RankingResult, RankedDistributor } from "@/lib/ranking-engine";

function formatPackaging(type: string, ml: number): string {
  const vol = ml >= 1000 ? `${ml / 1000}L` : `${ml}ml`;
  const t = type.charAt(0).toUpperCase() + type.slice(1);
  return `${t} ${vol}`;
}

// ─── Shape esperado pelo frontend ─────────────────────────────────────────────

type MatchedItem = {
  product_id: string;              // ID do produto para adicionar ao carrinho
  quotation_item_name: string;
  quotation_item_brand: string;
  product_name: string;
  category: string;
  packaging: string;
  quantity: number;
  unit_price_cents: number;        // preço com desconto aplicado
  original_price_cents: number;    // preço original sem desconto
  total_price_cents: number;
  price_change_pct: number | null;
  image_url: string | null;
  promotion: {
    type: string;
    discount_percentage: number | null;
    promotional_price_cents: number | null;
    description: string | null;
  } | null;
};

type RankingEntry = {
  distributor_id: string;
  is_sponsored?: boolean;
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
  avg_response_time_minutes?: number | null;
  freight_type: string;
  freight_value_cents: number | null;
  free_freight_above_cents: number | null;
  freight_notes: string | null;
  business_hours: Record<string, string | null> | null;
  accepts_orders_outside_hours: boolean;
  distance_km: number | null;
  is_nearby: boolean;
  minimum_order_cents: number;
};

// Distribuidora fora do raio do plano atual do comprador
type RestrictedDistributor = {
  distributor_id: string;
  company_name: string;
  total_cents: number;
  total_brl: string;
  all_items_available: boolean;
  savings_vs_best_cents: number; // quanto economizaria vs melhor opção desbloqueada (negativo = mais caro)
  matched_item_names: string[];
};

type ApiRankingResult = {
  within_deadline: RankingEntry[];
  out_of_deadline: RankingEntry[];
  quotation_id: string;
  delivery_city: string;
  delivery_state: string;
  from_cache: boolean;
  client_plan: string;
  restricted_distributors: RestrictedDistributor[];
};

// ─── Histórico de preços: busca última referência antes de gravar ─────────────

/** Chave no mapa: "productId:distributorId" */
type PriceHistoryMap = Map<string, number>;

async function buildPriceHistoryMap(
  clientId: string,
  result: Omit<RankingResult, "from_cache">
): Promise<PriceHistoryMap> {
  const map: PriceHistoryMap = new Map();

  for (const dist of result.distributors) {
    for (const item of dist.items) {
      if (!item.matched_product) continue;

      const productId = item.matched_product.id;
      const key = `${productId}:${dist.distributor_id}`;
      if (map.has(key)) continue;

      const last = await prisma.priceHistory.findFirst({
        where: {
          product_id:     productId,
          distributor_id: dist.distributor_id,
          client_id:      clientId,
        },
        orderBy: { recorded_at: "desc" },
        select:  { price_cents: true },
      });

      if (last) map.set(key, last.price_cents);
    }
  }

  return map;
}

// ─── Transforma saída do motor para o shape da API ────────────────────────────

function toEntry(d: RankedDistributor, historyMap: PriceHistoryMap): RankingEntry {
  const matched_items: MatchedItem[] = d.items
    .filter((i) => i.available && i.matched_product !== null)
    .map((i) => {
      // Usa o preço efetivo (com desconto de promoção) para exibição e comparação
      const currentCents   = i.matched_product!.effective_price_cents;
      const originalCents  = i.matched_product!.price_cents;
      const key = `${i.matched_product!.id}:${d.distributor_id}`;
      const prevCents = historyMap.get(key) ?? null;

      // price_change_pct: compara preço original atual com último histórico
      let price_change_pct: number | null = null;
      if (prevCents !== null && prevCents > 0) {
        price_change_pct = Math.round(((originalCents - prevCents) / prevCents) * 10000) / 100;
      }
      void currentCents;

      return {
        product_id:           i.matched_product!.id,
        quotation_item_name:  i.product_name,
        quotation_item_brand: i.brand,
        product_name:         i.matched_product!.name,
        category:             i.category,
        packaging:            formatPackaging(i.matched_product!.packaging_type, i.matched_product!.packaging_volume_ml),
        quantity:             i.quantity,
        unit_price_cents:     currentCents,
        original_price_cents: i.matched_product!.price_cents,
        total_price_cents:    i.matched_product!.subtotal_cents,
        price_change_pct,
        image_url:  i.matched_product!.image_url ?? null,
        promotion:  i.matched_product!.promotion ?? null,
      };
    });

  const unmatched_items: string[] = d.items
    .filter((i) => !i.available)
    .map((i) => i.product_name);

  // Usa a atualização de preço mais recente entre os produtos casados
  const updatedAts = d.items
    .filter((i) => i.matched_product)
    .map((i) => i.matched_product!.price_updated_at);
  const price_updated_at =
    updatedAts.length > 0
      ? updatedAts.sort().at(-1)!
      : new Date().toISOString();

  const isWithin = d.status === "dentro_do_prazo";

  return {
    distributor_id: d.distributor_id,
    company_name: d.company_name,
    whatsapp_commercial: d.whatsapp_commercial,
    email_commercial: d.email_commercial,
    total_cents: d.total_cents,
    total_brl: d.total_brl,
    all_items_available: d.all_items_available,
    matched_items,
    unmatched_items,
    estimated_delivery_date: d.delivery_date,
    total_business_days: d.total_business_days,
    within_deadline: isWithin,
    price_updated_at,
    status: isWithin ? "within_deadline" : "out_of_deadline",
    average_rating: d.average_rating,
    review_count:   d.review_count,
    avg_response_time_minutes: d.avg_response_time_minutes ?? 15,
    freight_type: d.freight_type,
    freight_value_cents: d.freight_value_cents,
    free_freight_above_cents: d.free_freight_above_cents,
    freight_notes: d.freight_notes,
    business_hours: d.business_hours,
    accepts_orders_outside_hours: d.accepts_orders_outside_hours,
    distance_km: d.distance_km,
    is_nearby: d.is_nearby,
    minimum_order_cents: d.minimum_order_cents,
  };
}

// ─── Distribuidoras fora do raio (mesmo estado, outra cidade) ─────────────────

async function computeRestrictedDistributors(
  deliveryState: string,
  deliveryCity: string,
  quotationItems: { product_name: string; brand: string; category: string; quantity: number }[],
  rankedIds: string[],
  bestCurrentTotal: number,
  limit = 5
): Promise<RestrictedDistributor[]> {
  // Distribuidoras aprovadas no mesmo estado mas em outra cidade
  const stateUpper = deliveryState.toUpperCase();
  const cityLower  = deliveryCity.toLowerCase();

  const regions = await prisma.deliveryRegion.findMany({
    where: {
      state: stateUpper,
      distributor_id: { notIn: rankedIds },
      distributor: { approved_by_admin: true },
    },
    distinct: ["distributor_id"],
    take: 20,
    include: {
      distributor: {
        include: { products: { where: { available: true } } },
      },
    },
  });

  // Filtrar client-side para excluir a cidade exata do cliente (usando normalização)
  const cityClean = normalizeCityName(deliveryCity).toLowerCase();
  const filtered = regions.filter((r) => normalizeCityName(r.city).toLowerCase() !== cityClean);

  const results: RestrictedDistributor[] = [];

  for (const region of filtered) {
    const dist = region.distributor;
    let totalCents = 0;
    let itemsFound = 0;
    const matchedNames: string[] = [];

    for (const item of quotationItems) {
      const itemBrand = item.brand.toLowerCase().trim();
      const candidates = dist.products.filter(
        (p) => p.category === item.category && p.brand.toLowerCase().trim() === itemBrand
      );
      if (candidates.length === 0) continue;
      const cheapest = candidates.reduce(
        (a: typeof candidates[0], b: typeof candidates[0]) => a.price_cents < b.price_cents ? a : b
      );
      totalCents += cheapest.price_cents * item.quantity;
      matchedNames.push(item.product_name);
      itemsFound++;
    }

    if (itemsFound === 0) continue;

    results.push({
      distributor_id:        dist.id,
      company_name:          dist.company_name,
      total_cents:           totalCents,
      total_brl:             new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalCents / 100),
      all_items_available:   itemsFound === quotationItems.length,
      savings_vs_best_cents: bestCurrentTotal - totalCents,
      matched_item_names:    matchedNames,
    });
  }

  return results
    .sort((a, b) => a.total_cents - b.total_cents)
    .slice(0, limit);
}

async function toApiResult(
  result: Omit<RankingResult, "from_cache">,
  from_cache: boolean,
  clientId: string,
  clientPlan: string,
  quotationItems: { product_name: string; brand: string; category: string; quantity: number }[]
): Promise<ApiRankingResult> {
  const historyMap = await buildPriceHistoryMap(clientId, result);

  const within_deadline = result.distributors
    .filter((d) => d.status === "dentro_do_prazo")
    .map((d) => toEntry(d, historyMap));

  const out_of_deadline = result.distributors
    .filter((d) => d.status === "fora_do_prazo")
    .map((d) => toEntry(d, historyMap));

  // Melhor total atual (distribuidoras desbloqueadas com todos os itens)
  const allEntries  = [...within_deadline, ...out_of_deadline];
  const bestCurrent = allEntries.filter((e) => e.all_items_available)
    .reduce((min, e) => e.total_cents < min ? e.total_cents : min, Infinity);

  // Distribuidoras restritas (fora do raio do plano atual)
  const isPro = clientPlan === "pro";
  const rankedIds = result.distributors.map((d) => d.distributor_id);

  const restricted_distributors: RestrictedDistributor[] = isPro
    ? []
    : await computeRestrictedDistributors(
        result.delivery_state,
        result.delivery_city,
        quotationItems,
        rankedIds,
        isFinite(bestCurrent) ? bestCurrent : 0
      );

  console.log(`[ranking] resposta: ${within_deadline.length} dentro prazo | ${out_of_deadline.length} fora prazo | ${restricted_distributors.length} restritas | cache=${from_cache}`);

  return {
    within_deadline,
    out_of_deadline,
    quotation_id:            result.quotation_id,
    delivery_city:           result.delivery_city,
    delivery_state:          result.delivery_state,
    from_cache,
    client_plan:             clientPlan,
    restricted_distributors,
  };
}

/**
 * GET /api/quotations/:id/ranking
 */
export const GET = withAuth(
  async (req: NextRequest, user, context) => {
    const quotationId = context?.params.id;
    if (!quotationId) {
      return Response.json({ error: "ID da cotação não fornecido" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const forceRefresh = searchParams.get("refresh") === "1";

    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      include: { items: true, client: true },
    });

    if (!quotation) {
      return Response.json({ error: "Cotação não encontrada" }, { status: 404 });
    }

    if (user.role === "client" && quotation.client.user_id !== user.userId) {
      return Response.json({ error: "Acesso não autorizado" }, { status: 403 });
    }

    if (quotation.status === "draft") {
      return Response.json(
        { error: "Cotação ainda em rascunho — publique antes de ver o ranking" },
        { status: 400 }
      );
    }

    console.log(`[ranking] requisição | quotation=${quotationId} cidade="${quotation.delivery_city}" estado="${quotation.delivery_state}" itens=${quotation.items.length} forceRefresh=${forceRefresh}`);

    if (!forceRefresh) {
      const cached = await getRankingCache<ApiRankingResult>(quotationId);
      if (cached) {
        console.log(`[ranking] servindo do cache`);
        return Response.json({ ...cached.data, from_cache: true });
      }
    }

    let result, distributorIds, apiResult;

    try {
      console.log(`[ranking] step: computeRanking`);
      result = await computeRanking(quotation, quotation.client);
      console.log(`[ranking] computeRanking ok — ${result.distributors.length} distribuidoras`);
    } catch (err) {
      console.error("[ranking] ERRO em computeRanking:", err);
      const msg = err instanceof Error ? err.message : String(err);
      return Response.json({ error: "Erro ao calcular ranking", detail: process.env.NODE_ENV !== "production" ? msg : undefined }, { status: 500 });
    }

    try {
      distributorIds = extractDistributorIds(result);
      const clientPlan = quotation.client.client_plan ?? "free";
      console.log(`[ranking] step: toApiResult — clientPlan=${clientPlan}`);
      apiResult = await toApiResult(
        result,
        false,
        quotation.client.id,
        clientPlan,
        quotation.items.map((i) => ({
          product_name: i.product_name,
          brand:        i.brand,
          category:     i.category,
          quantity:     i.quantity,
        }))
      );
      console.log(`[ranking] toApiResult ok`);
    } catch (err) {
      console.error("[ranking] ERRO em toApiResult:", err);
      const msg = err instanceof Error ? err.message : String(err);
      return Response.json({ error: "Erro ao montar resultado", detail: process.env.NODE_ENV !== "production" ? msg : undefined }, { status: 500 });
    }

    setRankingCache(quotationId, apiResult, distributorIds).catch((err) => {
      console.error("[ranking] erro ao salvar cache:", err);
    });

    // Registra histórico de preços em background (fire-and-forget)
    if (quotation.client.id && result.distributors.length > 0) {
      recordPriceHistory(quotation.client.id, result).catch(() => {});
    }

    // Injeta slot patrocinado (top_ranking) — sem cache, sempre fresco
    const sponsored = await injectSponsoredRanking(
      apiResult,
      quotation.delivery_city,
      quotation.delivery_state
    );

    return Response.json(sponsored);
  },
  { roles: ["client", "platform_admin"] }
);

// ─── Patrocínio no ranking ─────────────────────────────────────────────────────

async function injectSponsoredRanking(
  result: ApiRankingResult,
  city: string,
  state: string
): Promise<ApiRankingResult> {
  const now = new Date();

  const slot = await prisma.sponsoredSlot.findFirst({
    where: {
      slot_type:    "top_ranking",
      region_city:  { equals: city,  mode: "insensitive" },
      region_state: { equals: state, mode: "insensitive" },
      active:       true,
      starts_at:    { lte: now },
      ends_at:      { gte: now },
    },
    orderBy: { budget_cents: "desc" },
    select:  { id: true, distributor_id: true },
  });

  if (!slot) return result;

  // Encontra o entry desse distribuidor no ranking
  const idx = result.within_deadline.findIndex((e) => e.distributor_id === slot.distributor_id);
  if (idx <= 0) return result; // já é o primeiro ou não está no ranking

  const within = [...result.within_deadline];
  const entry  = { ...within.splice(idx, 1)[0], is_sponsored: true };
  within.unshift(entry);

  // Registra impressão (fire-and-forget)
  prisma.sponsoredSlot.update({
    where: { id: slot.id },
    data:  { impressions: { increment: 1 } },
  }).catch(() => {});

  return { ...result, within_deadline: within };
}

// ─── Histórico de preços ──────────────────────────────────────────────────────

async function recordPriceHistory(
  clientId: string,
  result: Omit<RankingResult, "from_cache">
): Promise<void> {
  // Busca os produtos reais correspondentes a cada item matched no ranking.
  // O ranking-engine retorna o nome do produto mas não o product_id.
  // Precisamos cruzar pelo nome + distribuidora.
  const records: Array<{ product_id: string; distributor_id: string; price_cents: number }> = [];

  for (const dist of result.distributors) {
    for (const item of dist.items) {
      if (!item.matched_product) continue;

      // Busca o product_id pelo nome + distribuidora
      const product = await prisma.product.findFirst({
        where: {
          distributor_id: dist.distributor_id,
          name:           item.matched_product.name,
          available:      true,
        },
        select: { id: true },
      });

      if (product) {
        records.push({
          product_id:     product.id,
          distributor_id: dist.distributor_id,
          price_cents:    item.matched_product.price_cents,
        });
      }
    }
  }

  if (records.length === 0) return;

  // Usa createMany com skipDuplicates para evitar explosion de registros
  // (limita a 1 registro por produto+distribuidora por hora para o mesmo cliente)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  for (const rec of records) {
    const recentExists = await prisma.priceHistory.findFirst({
      where: {
        product_id:     rec.product_id,
        distributor_id: rec.distributor_id,
        client_id:      clientId,
        recorded_at:    { gte: oneHourAgo },
      },
      select: { id: true },
    });

    if (!recentExists) {
      await prisma.priceHistory.create({
        data: {
          product_id:     rec.product_id,
          distributor_id: rec.distributor_id,
          client_id:      clientId,
          price_cents:    rec.price_cents,
        },
      });
    }
  }
}
