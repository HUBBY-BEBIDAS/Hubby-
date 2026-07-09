/**
 * Motor de cotação — algoritmo central do SIC.
 *
 * Entrada:  quotation (com items e localidade do cliente)
 * Saída:    lista rankeada de distribuidoras com preços e data de entrega
 *
 * Regras implementadas:
 * - Distribuidoras fora da região do cliente: excluídas
 * - Produtos indisponíveis (available=false): excluídos por item
 * - Matching por category + brand (case-insensitive); múltiplos → mais barato
 * - dentro_do_prazo | fora_do_prazo conforme max_delivery_days do cliente
 * - Ordenação: preço total ↑ | dias úteis ↑ | razão social ↑
 * - Preços SEMPRE em centavos internamente, convertidos para BRL apenas na saída
 */

import { prisma } from "@/lib/prisma";
import {
  calculateDeliveryEstimate,
  getNowBRT,
} from "@/lib/delivery-calculator";
import type { Product, QuotationItem, Quotation, Client } from "@prisma/client";

// ─── Tipos de saída ───────────────────────────────────────────────────────────

export type ProductPromotion = {
  type: string;
  discount_percentage: number | null;
  promotional_price_cents: number | null;
  description: string | null;
};

export type RankedItem = {
  quotation_item_id: string;
  product_name: string;     // o que o cliente pediu
  brand: string;
  quantity: number;
  available: boolean;       // false = distribuidora não tem este produto
  matched_product: {
    id: string;
    name: string;
    brand: string;
    packaging_type: string;
    packaging_volume_ml: number;
    price_cents: number;          // preço original
    effective_price_cents: number; // preço com desconto se houver promoção
    price_brl: string;
    subtotal_cents: number;        // calculado sobre effective_price_cents
    subtotal_brl: string;
    price_updated_at: string;
    image_url: string | null;
    promotion: ProductPromotion | null;
  } | null;
};

// Peso de desempate por plano: planos superiores ficam à frente em empate técnico
const PLAN_RANK: Record<string, number> = { enterprise: 0, operacional: 1, vitrine: 2 };

export type RankedDistributor = {
  distributor_id: string;
  company_name: string;
  logo_key: string | null;
  whatsapp_commercial: string;
  email_commercial: string;
  plan: string;
  average_rating: number | null;
  review_count: number;
  status: "dentro_do_prazo" | "fora_do_prazo";
  delivery_date: string;       // "quarta-feira, 09/07"
  total_business_days: number;
  items: RankedItem[];
  total_cents: number;         // soma apenas dos items encontrados
  total_brl: string;           // "R$ 1.234,56"
  items_found: number;
  items_total: number;
  all_items_available: boolean;
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

export type RankingResult = {
  quotation_id: string;
  delivery_city: string;
  delivery_state: string;
  max_delivery_days: number | null;
  distributors: RankedDistributor[];
  computed_at: string;         // ISO
  from_cache: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function calcDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function formatBRL(cents: number): string {
  // Sempre inteiro — nunca float; divisão por 100 apenas para exibição
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(Math.trunc(cents) / 100);
}

const PACKAGING_LABELS_REV: Record<string, string> = {
  "garrafa": "garrafa",
  "lata": "lata",
  "barril": "barril",
  "caixa": "caixa",
  "fardo": "fardo",
  "tetra pak": "tetra_pak",
  "tetra_pak": "tetra_pak",
  "outro": "other",
  "other": "other"
};

function parsePackaging(text: string): { type: string | null; volumeMl: number | null } {
  const lower = text.toLowerCase().trim();
  
  // Extrai volume (ex: "330ml" ou "330 ml")
  const volMatch = lower.match(/(\d+)\s*ml/);
  const volumeMl = volMatch ? parseInt(volMatch[1], 10) : null;
  
  // Extrai tipo de embalagem
  let type: string | null = null;
  for (const [label, val] of Object.entries(PACKAGING_LABELS_REV)) {
    if (lower.includes(label)) {
      type = val;
      break;
    }
  }
  
  return { type, volumeMl };
}

/**
 * Encontra o produto correspondente ao item da cotação.
 * Usa um algoritmo de match em cascata para ser altamente preciso:
 * 1. Filtra por Categoria e Marca (obrigatórios)
 * 2. Tenta correspondência exata de Embalagem (tipo e volume) e Nome do produto
 * 3. Fallback 1: Correspondência por Embalagem (tipo e volume)
 * 4. Fallback 2: Nome do produto (se contém a descrição simplificada)
 * 5. Fallback final: Escolhe o item mais barato daquela marca/categoria
 */
function matchProduct(
  item: QuotationItem,
  products: Product[]
): Product | null {
  const itemBrand = item.brand.toLowerCase().trim();
  const targetName = item.product_name.toLowerCase().trim();
  const { type: targetType, volumeMl: targetVolume } = parsePackaging(item.packaging);

  // Filtra candidatos iniciais obrigatoriamente por marca e categoria
  const baseCandidates = products.filter(
    (p) =>
      p.available &&
      p.category === item.category &&
      p.brand.toLowerCase().trim() === itemBrand
  );

  if (baseCandidates.length === 0) return null;

  // Nível 1: Match total (Embalagem exata + Nome exato)
  let candidates = baseCandidates.filter(
    (p) =>
      p.name.toLowerCase().trim() === targetName &&
      (targetType === null || p.packaging_type === targetType) &&
      (targetVolume === null || p.packaging_volume_ml === targetVolume)
  );

  // Nível 2: Match por Embalagem (tipo + volume) - mais comum e confiável para SKUs comerciais
  if (candidates.length === 0) {
    candidates = baseCandidates.filter(
      (p) =>
        (targetType === null || p.packaging_type === targetType) &&
        (targetVolume === null || p.packaging_volume_ml === targetVolume)
    );
  }

  // Nível 3: Match por Nome (contém parte do nome)
  if (candidates.length === 0) {
    const cleanTargetName = targetName.replace(/\d+\s*(ml|l)/gi, "").trim();
    candidates = baseCandidates.filter(
      (p) => p.name.toLowerCase().trim().includes(cleanTargetName)
    );
  }

  // Nível 4: Sem correspondência específica — cai para o comportamento antigo
  if (candidates.length === 0) {
    candidates = baseCandidates;
  }

  // Se houver mais de um candidato (ex: preços concorrentes da mesma SKU), escolhe o de menor preço
  return candidates.reduce((cheapest, p) =>
    p.price_cents < cheapest.price_cents ? p : cheapest
  );
}

// ─── Algoritmo principal ──────────────────────────────────────────────────────

export async function computeRanking(
  quotation: Quotation & { items: QuotationItem[] },
  client: Client
): Promise<Omit<RankingResult, "from_cache">> {
  const now = getNowBRT();
  const deliveryState = quotation.delivery_state;

  // Normaliza a cidade: remove o estado entre parênteses que a Receita Federal inclui.
  // Ex: "São Paulo (SP)" → "São Paulo", "Rio de Janeiro (RJ)" → "Rio de Janeiro"
  const deliveryCity = quotation.delivery_city
    .replace(/\s*\([^)]*\)\s*/g, "")
    .trim();

  // 1. Busca todas as regiões de entrega que cobrem a cidade do cliente,
  //    trazendo os produtos disponíveis de cada distribuidora.
  console.log(`[ranking] buscando regiões para: cidade="${deliveryCity}" (original: "${quotation.delivery_city}") estado="${deliveryState}" cotação=${quotation.id}`);

  const regions = await prisma.deliveryRegion.findMany({
    where: {
      city: { equals: deliveryCity, mode: "insensitive" },
      state: { equals: deliveryState, mode: "insensitive" },
    },
    include: {
      distributor: {
        include: {
          products: {
            where: { available: true },
          },
        },
      },
    },
  });

  // Busca promoções ativas para todos os produtos das distribuidoras encontradas
  const allProductIds = regions.flatMap((r) => r.distributor.products.map((p) => p.id));
  const activePromos = allProductIds.length > 0
    ? await prisma.promotion.findMany({
        where: {
          product_id: { in: allProductIds },
          active:     true,
          starts_at:  { lte: now },
          ends_at:    { gte: now },
        },
        select: {
          product_id:              true,
          type:                    true,
          discount_percentage:     true,
          promotional_price_cents: true,
          description:             true,
        },
      })
    : [];

  const promoMap = new Map(activePromos.map((p) => [p.product_id, p]));

  console.log(`[ranking] regiões encontradas: ${regions.length}`);
  for (const r of regions) {
    const d = r.distributor;
    console.log(`[ranking]   distribuidora="${d.company_name}" aprovada=${d.approved_by_admin} produtos=${d.products.length} corte=${r.cutoff_time} rotas=${r.route_days.join(",")}`);
  }

  // 2. Para cada distribuidora aprovada que atende a região, computa o ranking
  const maxDays = quotation.max_delivery_days;
  const clientLat = quotation.delivery_lat ?? null;
  const clientLng = quotation.delivery_lng ?? null;
  const ranked: RankedDistributor[] = [];

  for (const region of regions) {
    const dist = region.distributor;

    // Distribuidora não aprovada pelo admin ainda não aparece no ranking
    if (!dist.approved_by_admin) continue;

    // 2a. Calcula data de entrega
    const estimate = calculateDeliveryEstimate(now, {
      route_days: region.route_days,
      cutoff_time: region.cutoff_time,
      delivery_days_business: region.delivery_days_business,
    });

    // 2b. Verifica prazo
    const status: RankedDistributor["status"] =
      maxDays === null || estimate.totalBusinessDays <= maxDays
        ? "dentro_do_prazo"
        : "fora_do_prazo";

    // 2c. Verifica pedido mínimo (informativo — não exclui do ranking)
    //     A exclusão por pedido mínimo ocorre na confirmação do pedido

    // 2d. Faz o matching de cada item da cotação
    console.log(`[ranking] matching para "${dist.company_name}" — ${quotation.items.length} item(s) na cotação`);
    let totalCents = 0; // SEMPRE inteiro
    let itemsFound = 0;

    const rankedItems: RankedItem[] = quotation.items.map((item) => {
      const product = matchProduct(item, dist.products);

      console.log(`[ranking]   item="${item.product_name}" brand="${item.brand}" category="${item.category}" → produto encontrado: ${product ? `"${product.name}" R$${product.price_cents}c` : "NÃO encontrado"}`);

      if (product) {
        const promo = promoMap.get(product.id) ?? null;
        const effectivePriceCents = promo
          ? promo.type === "fixed_price" && promo.promotional_price_cents != null
            ? promo.promotional_price_cents
            : Math.round(product.price_cents * (1 - (promo.discount_percentage ?? 0) / 100))
          : product.price_cents;

        const subtotalCents = effectivePriceCents * item.quantity;
        totalCents += subtotalCents;
        itemsFound++;

        return {
          quotation_item_id: item.id,
          product_name: item.product_name,
          brand: item.brand,
          quantity: item.quantity,
          available: true,
          matched_product: {
            id: product.id,
            name: product.name,
            brand: product.brand,
            packaging_type: product.packaging_type,
            packaging_volume_ml: product.packaging_volume_ml,
            price_cents: product.price_cents,
            effective_price_cents: effectivePriceCents,
            price_brl: formatBRL(product.price_cents),
            subtotal_cents: subtotalCents,
            subtotal_brl: formatBRL(subtotalCents),
            price_updated_at: product.price_updated_at.toISOString(),
            image_url: product.image_url ?? null,
            promotion: promo
              ? {
                  type:                    promo.type,
                  discount_percentage:     promo.discount_percentage ?? null,
                  promotional_price_cents: promo.promotional_price_cents ?? null,
                  description:             promo.description ?? null,
                }
              : null,
          },
        };
      }

      return {
        quotation_item_id: item.id,
        product_name: item.product_name,
        brand: item.brand,
        quantity: item.quantity,
        available: false,
        matched_product: null,
      };
    });

    const distance_km =
      clientLat !== null && clientLng !== null && dist.lat !== null && dist.lng !== null
        ? calcDistanceKm(clientLat, clientLng, dist.lat, dist.lng)
        : null;

    ranked.push({
      distributor_id: dist.id,
      company_name: dist.company_name,
      logo_key: dist.logo_key,
      whatsapp_commercial: dist.whatsapp_commercial,
      email_commercial: dist.email_commercial,
      plan: dist.plan,
      average_rating: dist.average_rating,
      review_count:   dist.review_count,
      status,
      delivery_date: estimate.deliveryDateFormatted,
      total_business_days: estimate.totalBusinessDays,
      items: rankedItems,
      total_cents: totalCents,
      total_brl: formatBRL(totalCents),
      items_found: itemsFound,
      items_total: quotation.items.length,
      all_items_available: itemsFound === quotation.items.length,
      freight_type: region.freight_type,
      freight_value_cents: region.freight_value_cents ?? null,
      free_freight_above_cents: region.free_freight_above_cents ?? null,
      freight_notes: region.freight_notes ?? null,
      business_hours: (dist.business_hours as Record<string, string | null> | null) ?? null,
      accepts_orders_outside_hours: dist.accepts_orders_outside_hours,
      distance_km,
      is_nearby: distance_km !== null && distance_km <= 50,
      minimum_order_cents: region.minimum_order_cents,
    });
  }

  // 3. Ordena:
  //    1° distribuidoras com catálogo completo antes das parciais
  //    2° menor preço total
  //    3° menor número de dias úteis (tiebreaker)
  //    4° plano superior (enterprise > operacional > vitrine) — destaque comercial em empate técnico
  //    5° ordem alfabética (tiebreaker final)
  ranked.sort((a, b) => {
    if (a.all_items_available !== b.all_items_available) return a.all_items_available ? -1 : 1;
    if (a.total_cents !== b.total_cents) return a.total_cents - b.total_cents;
    if (a.total_business_days !== b.total_business_days) return a.total_business_days - b.total_business_days;
    const planDiff = (PLAN_RANK[a.plan] ?? 2) - (PLAN_RANK[b.plan] ?? 2);
    if (planDiff !== 0) return planDiff;
    if (a.distance_km !== null && b.distance_km !== null && a.distance_km !== b.distance_km) {
      return a.distance_km - b.distance_km;
    }
    if (a.distance_km !== null && b.distance_km === null) return -1;
    if (a.distance_km === null && b.distance_km !== null) return 1;
    return a.company_name.localeCompare(b.company_name, "pt-BR");
  });

  return {
    quotation_id: quotation.id,
    delivery_city: deliveryCity,
    delivery_state: deliveryState,
    max_delivery_days: maxDays,
    distributors: ranked,
    computed_at: new Date().toISOString(),
  };
}

/** Extrai apenas os IDs das distribuidoras do resultado para salvar no cache. */
export function extractDistributorIds(result: Omit<RankingResult, "from_cache">): string[] {
  return result.distributors.map((d) => d.distributor_id);
}
