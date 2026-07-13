import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { normalizeCityName } from "@/lib/coverage";

// ─── Helper de patrocínio ─────────────────────────────────────────────────────

type CatalogEntry = {
  key: string;
  name: string;
  brand: string;
  category: string;
  packaging_type: string;
  packaging_volume_ml: number;
  min_price_cents: number;
  effective_price_cents: number;
  image_url: string | null;
  distributor_count: number;
  cheapest_product_id: string;
  cheapest_distributor_id: string;
  is_sponsored?: boolean;
  price_trend: "up" | "down" | "stable" | null;
  price_change_pct: number | null;
  price_updated_at: string | null;
  promotion: {
    type: string;
    discount_percentage: number | null;
    promotional_price_cents: number | null;
    description: string | null;
  } | null;
};

async function injectSponsoredCatalog(
  entries: CatalogEntry[],
  city: string,
  state: string,
  category: string | null
): Promise<CatalogEntry[]> {
  const now      = new Date();
  const slotType = category ? "category_highlight" : "search_boost";

  const slots = await prisma.sponsoredSlot.findMany({
    where: {
      slot_type:    slotType,
      region_city:  { equals: city,  mode: "insensitive" },
      region_state: { equals: state, mode: "insensitive" },
      active:       true,
      starts_at:    { lte: now },
      ends_at:      { gte: now },
    },
    select: { id: true, distributor_id: true, product_id: true },
    orderBy: { budget_cents: "desc" },
    take: 3,
  });

  if (slots.length === 0) return entries;

  const sponsoredDistributorIds = new Set(slots.map((s) => s.distributor_id));
  const sponsoredProductIds     = new Set(slots.map((s) => s.product_id).filter(Boolean));

  const promoted: CatalogEntry[] = [];
  const rest: CatalogEntry[]     = [];

  for (const entry of entries) {
    const isSponsored =
      sponsoredProductIds.has(entry.cheapest_product_id) ||
      sponsoredDistributorIds.has(entry.cheapest_distributor_id);

    if (isSponsored) promoted.push({ ...entry, is_sponsored: true });
    else              rest.push(entry);
  }

  if (promoted.length === 0) return entries;

  Promise.all(
    slots.map((s) =>
      prisma.sponsoredSlot.update({ where: { id: s.id }, data: { impressions: { increment: 1 } } })
    )
  ).catch(() => {});

  return [...promoted, ...rest];
}

// ─── Tendência de preço ───────────────────────────────────────────────────────

async function enrichWithPriceTrend(
  entries: CatalogEntry[],
  clientId: string
): Promise<CatalogEntry[]> {
  const productIds = entries.map((e) => e.cheapest_product_id);
  if (productIds.length === 0) return entries;

  const histories = await prisma.priceHistory.findMany({
    where:   { product_id: { in: productIds }, client_id: clientId },
    select:  { product_id: true, price_cents: true, recorded_at: true },
    orderBy: { recorded_at: "desc" },
    take:    productIds.length * 3,
  });

  // Agrupa por product_id e pega últimas 2 ocorrências
  const byProduct = new Map<string, number[]>();
  for (const h of histories) {
    const arr = byProduct.get(h.product_id) ?? [];
    if (arr.length < 2) arr.push(h.price_cents);
    byProduct.set(h.product_id, arr);
  }

  return entries.map((e) => {
    const prices = byProduct.get(e.cheapest_product_id);
    if (!prices || prices.length < 2) return e;

    const [current, previous] = prices;
    const pct = Math.round(((current - previous) / previous) * 100 * 10) / 10;

    return {
      ...e,
      price_trend:      pct > 0 ? "up" : pct < 0 ? "down" : "stable",
      price_change_pct: pct !== 0 ? Math.abs(pct) : null,
    };
  });
}

// ─── Endpoint principal ───────────────────────────────────────────────────────

/**
 * GET /api/catalog
 *
 * Params:
 *   category, q, brand, min_price, max_price — filtros
 *   sort     — cheapest|popular|newest|promo_first (default: cheapest)
 *   page     — página (default: 1)
 *   limit    — itens por página (default: 24, max: 48)
 */
export const GET = withAuth(
  async (req: NextRequest, user) => {
    const { searchParams } = new URL(req.url);
    const category  = searchParams.get("category");
    const q         = searchParams.get("q")?.trim() ?? "";
    const brand     = searchParams.get("brand");
    const minPrice  = searchParams.get("min_price") ? parseInt(searchParams.get("min_price")!) : null;
    const maxPrice  = searchParams.get("max_price") ? parseInt(searchParams.get("max_price")!) : null;
    const sort      = (searchParams.get("sort") ?? "cheapest") as "cheapest" | "popular" | "newest" | "promo_first";
    const page      = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit     = Math.min(48, Math.max(1, parseInt(searchParams.get("limit") ?? "24")));

    const client = await prisma.client.findUnique({
      where:  { user_id: user.userId },
      select: { id: true, delivery_city: true, delivery_state: true },
    });
    if (!client) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

    const city  = normalizeCityName(client.delivery_city);
    const state = client.delivery_state;
    const now   = new Date();

    const allStateRegions = await prisma.deliveryRegion.findMany({
      where: {
        state: { equals: state, mode: "insensitive" },
        distributor: { approved_by_admin: true },
      },
      select: { distributor_id: true, city: true },
    });

    const targetCityClean = normalizeCityName(city).toLowerCase();
    const regions = allStateRegions.filter(
      (r) => normalizeCityName(r.city).toLowerCase() === targetCityClean
    );

    if (regions.length === 0) {
      return Response.json({ products: [], brands: [], city, state, total: 0, page, total_pages: 0 });
    }

    const distributorIds = regions.map((r) => r.distributor_id);

    const products = await prisma.product.findMany({
      where: {
        distributor_id: { in: distributorIds },
        available: true,
        ...(category ? { category: category as never } : {}),
        ...(brand    ? { brand: { equals: brand, mode: "insensitive" } } : {}),
        ...(q ? {
          OR: [
            { name:  { contains: q, mode: "insensitive" } },
            { brand: { contains: q, mode: "insensitive" } },
          ],
        } : {}),
        ...(minPrice !== null || maxPrice !== null ? {
          price_cents: {
            ...(minPrice !== null ? { gte: minPrice } : {}),
            ...(maxPrice !== null ? { lte: maxPrice } : {}),
          },
        } : {}),
      },
      select: {
        id: true, name: true, brand: true, category: true,
        packaging_type: true, packaging_volume_ml: true,
        price_cents: true, image_url: true, image_source: true,
        distributor_id: true, price_updated_at: true, created_at: true,
        promotions: {
          where: { active: true, starts_at: { lte: now }, ends_at: { gte: now } },
          select: { type: true, discount_percentage: true, promotional_price_cents: true, description: true },
          take: 1,
        },
      },
    });

    // Agrupa por chave canônica
    const map = new Map<string, CatalogEntry & { _newestAt: Date; _hasPromo: boolean }>();

    for (const p of products) {
      const key = `${p.brand}|${p.name}|${p.category}|${p.packaging_type}|${p.packaging_volume_ml}`;
      const promo = p.promotions[0] ?? null;
      const effectiveCents = promo
        ? promo.type === "fixed_price" && promo.promotional_price_cents != null
          ? promo.promotional_price_cents
          : Math.round(p.price_cents * (1 - (promo.discount_percentage ?? 0) / 100))
        : p.price_cents;

      if (!map.has(key)) {
        map.set(key, {
          key, name: p.name, brand: p.brand, category: p.category,
          packaging_type: p.packaging_type, packaging_volume_ml: p.packaging_volume_ml,
          min_price_cents: p.price_cents, effective_price_cents: effectiveCents,
          image_url: p.image_url ?? null, distributor_count: 1,
          cheapest_product_id: p.id, cheapest_distributor_id: p.distributor_id,
          price_trend: null, price_change_pct: null,
          price_updated_at: p.price_updated_at.toISOString(),
          promotion: promo ? {
            type: promo.type,
            discount_percentage: promo.discount_percentage ?? null,
            promotional_price_cents: promo.promotional_price_cents ?? null,
            description: promo.description ?? null,
          } : null,
          _newestAt: p.created_at,
          _hasPromo: !!promo,
        });
      } else {
        const entry = map.get(key)!;
        entry.distributor_count++;
        if (effectiveCents < entry.effective_price_cents) {
          entry.min_price_cents       = p.price_cents;
          entry.effective_price_cents = effectiveCents;
          entry.cheapest_product_id   = p.id;
          entry.cheapest_distributor_id = p.distributor_id;
          entry.price_updated_at      = p.price_updated_at.toISOString();
          entry.promotion = promo ? {
            type: promo.type,
            discount_percentage: promo.discount_percentage ?? null,
            promotional_price_cents: promo.promotional_price_cents ?? null,
            description: promo.description ?? null,
          } : null;
          if (!entry._hasPromo && !!promo) entry._hasPromo = true;
        }
        if (!entry.image_url && p.image_url) entry.image_url = p.image_url;
        if (p.created_at > entry._newestAt) entry._newestAt = p.created_at;
      }
    }

    // Coleta as marcas disponíveis (para filtro UI)
    const availableBrands = [...new Set([...map.values()].map((e) => e.brand))].sort();

    // Ordena conforme sort param
    let sorted = [...map.values()];
    switch (sort) {
      case "popular":
        sorted.sort((a, b) => b.distributor_count - a.distributor_count);
        break;
      case "newest":
        sorted.sort((a, b) => b._newestAt.getTime() - a._newestAt.getTime());
        break;
      case "promo_first":
        sorted.sort((a, b) => {
          if (a._hasPromo && !b._hasPromo) return -1;
          if (!a._hasPromo && b._hasPromo) return 1;
          return a.effective_price_cents - b.effective_price_cents;
        });
        break;
      default: // cheapest
        sorted.sort((a, b) => a.effective_price_cents - b.effective_price_cents);
    }

    const total      = sorted.length;
    const totalPages = Math.ceil(total / limit);
    const offset     = (page - 1) * limit;
    const paginated  = sorted.slice(offset, offset + limit);

    // Injeta patrocinados apenas na primeira página
    let result: CatalogEntry[] = paginated;
    if (page === 1) {
      result = await injectSponsoredCatalog(paginated, city, state, category);
    }

    // Enriquece com tendência de preço
    result = await enrichWithPriceTrend(result, client.id);

    // Remove campos internos antes de retornar
    const clean = result.map(({ ...e }) => {
      const { ...rest } = e as CatalogEntry & { _newestAt?: Date; _hasPromo?: boolean };
      delete rest._newestAt;
      delete rest._hasPromo;
      return rest;
    });

    return Response.json({
      products: clean,
      brands:   availableBrands,
      city,
      state,
      total,
      page,
      total_pages: totalPages,
    });
  },
  { roles: ["client"] }
);
