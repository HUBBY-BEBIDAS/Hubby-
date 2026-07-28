import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { normalizeCityName } from "@/lib/coverage";
import { buildPrismaProductSearchWhere } from "@/lib/search-engine";

// ─── Helper de patrocínio ─────────────────────────────────────────────────────

type CatalogVariant = {
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
  promotion: {
    type: string;
    discount_percentage: number | null;
    promotional_price_cents: number | null;
    description: string | null;
  } | null;
};

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
  has_multiple_variants?: boolean;
  variants?: CatalogVariant[];
};

const PACKAGING_LABEL_MAP: Record<string, string> = {
  garrafa: "Garrafa",
  lata: "Lata",
  barril: "Barril",
  caixa: "Caixa",
  fardo: "Fardo",
  tetra_pak: "Tetra Pak",
  other: "Outro",
};

function formatVariantLabel(packagingType: string, volumeMl: number): string {
  if (packagingType === "garrafa" && volumeMl === 330) {
    return "Long Neck 330ml";
  }
  if (packagingType === "lata" && volumeMl === 473) {
    return "Latão 473ml";
  }
  if (volumeMl >= 1000) {
    const liters = volumeMl / 1000;
    const formattedLiters = liters % 1 === 0 ? liters.toFixed(0) : liters.toFixed(1);
    return `${formattedLiters}L`;
  }
  return `${volumeMl}ml`;
}

function getFamilyProductInfo(name: string, brand: string, packagingType: string): { familyName: string; familyKey: string } {
  const typeLabel = PACKAGING_LABEL_MAP[packagingType] ?? packagingType;

  // Remapeia nome de produto removendo qualificadores de embalagem e volume para obter a sublinha pura
  let subline = name
    .replace(/\b(long\s+neck|lata|latão|garrafa|barril|caixa|fardo|tetra\s+pak|retornável|ks)\b/gi, "")
    .replace(/\b(\d+\.?\d*\s*(ml|l|litros?))\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!subline || subline.toLowerCase() === brand.toLowerCase()) {
    subline = brand;
  }

  // Nome unificado da família incluindo a embalagem (ex: "Heineken Garrafa", "Heineken Lata")
  const familyName = `${subline} ${typeLabel}`;
  const familyKey = `${brand.toLowerCase()}|${subline.toLowerCase()}|${packagingType.toLowerCase()}`;

  return { familyName, familyKey };
}

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
        ...(q ? buildPrismaProductSearchWhere(q) : {}),
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

    // Agrupa por família de produto e por variante de produto
    type VariantMapValue = {
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
      distributors: Set<string>;
      cheapest_product_id: string;
      cheapest_distributor_id: string;
      promotion: CatalogVariant["promotion"];
      newestAt: Date;

      price_updated_at: string;
    };

    type FamilyMapValue = {
      key: string;
      name: string;
      brand: string;
      category: string;
      distributor_ids: Set<string>;
      variantsMap: Map<string, VariantMapValue>;
    };

    const familyMap = new Map<string, FamilyMapValue>();

    for (const p of products) {
      const { familyName, familyKey } = getFamilyProductInfo(p.name, p.brand, p.packaging_type);
      const variantKey = `${p.packaging_type}|${p.packaging_volume_ml}`;

      const promo = p.promotions[0] ?? null;
      const effectiveCents = promo
        ? promo.type === "fixed_price" && promo.promotional_price_cents != null
          ? promo.promotional_price_cents
          : Math.round(p.price_cents * (1 - (promo.discount_percentage ?? 0) / 100))
        : p.price_cents;

      const promoObj = promo ? {
        type: promo.type,
        discount_percentage: promo.discount_percentage ?? null,
        promotional_price_cents: promo.promotional_price_cents ?? null,
        description: promo.description ?? null,
      } : null;

      if (!familyMap.has(familyKey)) {
        familyMap.set(familyKey, {
          key: familyKey,
          name: familyName,
          brand: p.brand,
          category: p.category,
          distributor_ids: new Set([p.distributor_id]),
          variantsMap: new Map(),
        });
      }

      const family = familyMap.get(familyKey)!;
      family.distributor_ids.add(p.distributor_id);

      if (!family.variantsMap.has(variantKey)) {
        family.variantsMap.set(variantKey, {
          variant_key: variantKey,
          name: p.name,
          brand: p.brand,
          category: p.category,
          packaging_type: p.packaging_type,
          packaging_volume_ml: p.packaging_volume_ml,
          label: formatVariantLabel(p.packaging_type, p.packaging_volume_ml),
          min_price_cents: p.price_cents,
          effective_price_cents: effectiveCents,
          image_url: p.image_url ?? null,
          distributors: new Set([p.distributor_id]),
          cheapest_product_id: p.id,
          cheapest_distributor_id: p.distributor_id,
          promotion: promoObj,
          newestAt: p.created_at,
          price_updated_at: p.price_updated_at.toISOString(),
        });
      } else {
        const v = family.variantsMap.get(variantKey)!;
        v.distributors.add(p.distributor_id);
        if (effectiveCents < v.effective_price_cents) {
          v.min_price_cents = p.price_cents;
          v.effective_price_cents = effectiveCents;
          v.cheapest_product_id = p.id;
          v.cheapest_distributor_id = p.distributor_id;
          v.promotion = promoObj;
          v.price_updated_at = p.price_updated_at.toISOString();
        }
        if (!v.image_url && p.image_url) v.image_url = p.image_url;
        if (p.created_at > v.newestAt) v.newestAt = p.created_at;
      }
    }

    const catalogEntries: (CatalogEntry & { _newestAt: Date; _hasPromo: boolean })[] = [];

    for (const family of familyMap.values()) {
      const variantsList: CatalogVariant[] = [...family.variantsMap.values()]
        .map((v) => ({
          key: `${v.packaging_type}|${v.packaging_volume_ml}`,
          variant_key: v.variant_key,
          name: v.name,
          brand: v.brand,
          category: v.category,
          packaging_type: v.packaging_type,
          packaging_volume_ml: v.packaging_volume_ml,
          label: v.label,
          min_price_cents: v.min_price_cents,
          effective_price_cents: v.effective_price_cents,
          image_url: v.image_url,
          distributor_count: v.distributors.size,
          cheapest_product_id: v.cheapest_product_id,
          cheapest_distributor_id: v.cheapest_distributor_id,
          promotion: v.promotion,
        }))
        .sort((a, b) => a.effective_price_cents - b.effective_price_cents);

      if (variantsList.length === 0) continue;

      const primary = variantsList[0];
      const primaryVariantValue = family.variantsMap.get(primary.variant_key)!;
      const hasPromo = variantsList.some((v) => v.promotion !== null);
      const primaryImage = variantsList.find((v) => v.image_url !== null)?.image_url ?? null;
      const newestAt = [...family.variantsMap.values()].reduce((latest, v) => (v.newestAt > latest ? v.newestAt : latest), new Date(0));

      catalogEntries.push({
        key: family.key,
        name: family.name,
        brand: family.brand,
        category: family.category,
        packaging_type: primary.packaging_type,
        packaging_volume_ml: primary.packaging_volume_ml,
        min_price_cents: primary.min_price_cents,
        effective_price_cents: primary.effective_price_cents,
        image_url: primaryImage,
        distributor_count: family.distributor_ids.size,
        cheapest_product_id: primary.cheapest_product_id,
        cheapest_distributor_id: primary.cheapest_distributor_id,
        price_trend: null,
        price_change_pct: null,
        price_updated_at: primaryVariantValue.price_updated_at,
        promotion: primary.promotion,
        has_multiple_variants: variantsList.length > 1,
        variants: variantsList,
        _newestAt: newestAt,
        _hasPromo: hasPromo,
      });
    }

    const availableBrands = [...new Set(catalogEntries.map((e) => e.brand))].sort();

    let sorted = [...catalogEntries];
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

    let result: CatalogEntry[] = paginated;
    if (page === 1) {
      result = await injectSponsoredCatalog(paginated, city, state, category);
    }

    result = await enrichWithPriceTrend(result, client.id);

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
