import { prisma } from "@/lib/prisma";
import type {
  MasterProduct,
  MasterProductAlias,
  ProductImage,
  MatchingSource,
  PackagingType,
  ProductCategory,
} from "@prisma/client";

// ─── Normalização de Texto ───────────────────────────────────────────────────

export function normalizeString(text: string): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ") // substitui pontuação por espaço
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Algoritmo de Similaridade (Dice Token Overlap + Jaro-Winkler) ──────────

function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);

  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  // Token Overlap
  const tokens1 = new Set(s1.split(" ").filter((t) => t.length > 1));
  const tokens2 = new Set(s2.split(" ").filter((t) => t.length > 1));

  if (tokens1.size === 0 || tokens2.size === 0) return 0.0;

  let intersection = 0;
  for (const t of tokens1) {
    if (tokens2.has(t)) intersection++;
  }

  const diceScore = (2 * intersection) / (tokens1.size + tokens2.size);

  // Bônus se contiver a marca principal
  const substringBonus = s1.includes(s2) || s2.includes(s1) ? 0.1 : 0;

  return Math.min(1.0, Math.round((diceScore + substringBonus) * 100) / 100);
}

// ─── Tipos do Pipeline ───────────────────────────────────────────────────────

export type MatchCandidate = {
  masterProduct: MasterProduct & { images?: ProductImage[] };
  confidence: number;
  rank: number;
  source: MatchingSource;
};

export type PipelineResult =
  | {
      isMatched: true;
      matchedBy: MatchingSource;
      masterProduct: MasterProduct & { images?: ProductImage[] };
      confidence: number;
      durationMs: number;
    }
  | {
      isMatched: false;
      unmatchedImportId: string;
      suggestions: MatchCandidate[];
      durationMs: number;
    };

// ─── Etapas do Pipeline ───────────────────────────────────────────────────────

/**
 * Etapa 1: Busca por código de barras EAN-13 / GTIN
 */
export async function matchByEAN(eanCode: string) {
  if (!eanCode || eanCode.trim().length < 8) return null;
  const cleanEan = eanCode.trim();

  return prisma.masterProduct.findUnique({
    where: { ean_code: cleanEan },
    include: { images: true },
  });
}

/**
 * Etapa 2: Busca por Apelido Aprendido (MasterProductAlias)
 */
export async function matchByAlias(rawName: string) {
  const normalized = normalizeString(rawName);
  if (!normalized) return null;

  const alias = await prisma.masterProductAlias.findFirst({
    where: { normalized_name: normalized },
    include: { master_product: { include: { images: true } } },
  });

  if (alias) {
    // Incrementa contagem de uso e atualiza timestamp de forma assíncrona
    prisma.masterProductAlias
      .update({
        where: { id: alias.id },
        data: {
          approved_count: { increment: 1 },
          last_used_at: new Date(),
        },
      })
      .catch(() => {});

    return { masterProduct: alias.master_product, aliasId: alias.id };
  }

  return null;
}

/**
 * Etapa 3: Busca por Atributos Exatos (Marca + Embalagem + Volume + Unidades)
 */
export async function matchByAttributes(params: {
  brand?: string;
  packageType?: PackagingType;
  unitVolumeMl?: number;
  unitsPerPackage?: number;
}) {
  const { brand, packageType, unitVolumeMl, unitsPerPackage } = params;
  if (!brand || !unitVolumeMl) return null;

  return prisma.masterProduct.findFirst({
    where: {
      brand: { equals: brand.trim(), mode: "insensitive" },
      ...(packageType ? { package_type: packageType } : {}),
      unit_volume_ml: unitVolumeMl,
      ...(unitsPerPackage ? { units_per_package: unitsPerPackage } : {}),
      status: "active",
    },
    include: { images: true },
  });
}

/**
 * Etapa 4: Busca por Similaridade Textual (Retorna Ranking das Top Sugestões)
 */
export async function matchBySimilarity(
  rawName: string,
  limit = 3
): Promise<MatchCandidate[]> {
  const normalized = normalizeString(rawName);
  if (!normalized) return [];

  // Pega candidatos ativos do banco
  const candidates = await prisma.masterProduct.findMany({
    where: { status: "active" },
    include: { images: true },
    take: 100,
  });

  const scored = candidates
    .map((candidate) => {
      const fullName = `${candidate.brand} ${candidate.name}`;
      const score = calculateStringSimilarity(normalized, fullName);
      return {
        masterProduct: candidate,
        confidence: score,
        rank: 0,
        source: "similarity" as MatchingSource,
      };
    })
    .filter((c) => c.confidence >= 0.4) // descarta irrelevantes < 40%
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);

  return scored.map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));
}

// ─── Pipeline Principal de Matching ──────────────────────────────────────────

export async function processProductMatchingPipeline(params: {
  rawName: string;
  eanCode?: string;
  brand?: string;
  packageType?: PackagingType;
  unitVolumeMl?: number;
  unitsPerPackage?: number;
  distributorId: string;
}): Promise<PipelineResult> {
  const startTime = Date.now();
  const {
    rawName,
    eanCode,
    brand,
    packageType,
    unitVolumeMl,
    unitsPerPackage,
    distributorId,
  } = params;

  // 1. Match por EAN-13 (100% Confiança)
  if (eanCode) {
    const eanMatch = await matchByEAN(eanCode);
    if (eanMatch) {
      const durationMs = Date.now() - startTime;
      await logMatchingHistory({
        distributorId,
        rawName,
        matchedBy: "ean",
        masterProductId: eanMatch.id,
        confidence: 1.0,
        durationMs,
      });
      return {
        isMatched: true,
        matchedBy: "ean",
        masterProduct: eanMatch,
        confidence: 1.0,
        durationMs,
      };
    }
  }

  // 2. Match por Apelido Aprendido (99% Confiança)
  const aliasMatch = await matchByAlias(rawName);
  if (aliasMatch) {
    const durationMs = Date.now() - startTime;
    await logMatchingHistory({
      distributorId,
      rawName,
      matchedBy: "alias",
      masterProductId: aliasMatch.masterProduct.id,
      confidence: 0.99,
      durationMs,
    });
    return {
      isMatched: true,
      matchedBy: "alias",
      masterProduct: aliasMatch.masterProduct,
      confidence: 0.99,
      durationMs,
    };
  }

  // 3. Match por Atributos Exatos (95% Confiança)
  const attrMatch = await matchByAttributes({
    brand,
    packageType,
    unitVolumeMl,
    unitsPerPackage,
  });

  if (attrMatch) {
    const durationMs = Date.now() - startTime;

    // Aprende automaticamente o Alias para futuras consultas
    await learnProductAlias({
      masterProductId: attrMatch.id,
      rawName,
      createdBy: "system_auto",
    });

    await logMatchingHistory({
      distributorId,
      rawName,
      matchedBy: "attributes",
      masterProductId: attrMatch.id,
      confidence: 0.95,
      durationMs,
    });

    return {
      isMatched: true,
      matchedBy: "attributes",
      masterProduct: attrMatch,
      confidence: 0.95,
      durationMs,
    };
  }

  // 4. Match por Similaridade (Ranking Top Sugestões)
  const suggestions = await matchBySimilarity(rawName, 3);
  const bestMatch = suggestions[0];

  // Se o melhor candidato tiver confiança >= 88%, aceita automaticamente
  if (bestMatch && bestMatch.confidence >= 0.88) {
    const durationMs = Date.now() - startTime;

    await learnProductAlias({
      masterProductId: bestMatch.masterProduct.id,
      rawName,
      createdBy: "system_auto",
    });

    await logMatchingHistory({
      distributorId,
      rawName,
      matchedBy: "similarity",
      masterProductId: bestMatch.masterProduct.id,
      confidence: bestMatch.confidence,
      durationMs,
    });

    return {
      isMatched: true,
      matchedBy: "similarity",
      masterProduct: bestMatch.masterProduct,
      confidence: bestMatch.confidence,
      durationMs,
    };
  }

  // 5. Sem match automático de alta confiança -> Envia para Fila de Curadoria Admin
  const durationMs = Date.now() - startTime;

  const unmatchedItem = await prisma.unmatchedImportItem.create({
    data: {
      distributor_id: distributorId,
      raw_name: rawName,
      ean_code: eanCode ?? null,
      brand_extracted: brand ?? null,
      packaging_extracted: packageType ?? null,
      volume_extracted_ml: unitVolumeMl ?? null,
      status: "pending",
      suggestions: {
        create: suggestions.map((s) => ({
          master_product_id: s.masterProduct.id,
          confidence: s.confidence,
          rank: s.rank,
        })),
      },
    },
  });

  return {
    isMatched: false,
    unmatchedImportId: unmatchedItem.id,
    suggestions,
    durationMs,
  };
}

// ─── Helpers de Telemetria e Aprendizado ─────────────────────────────────────

export async function learnProductAlias(params: {
  masterProductId: string;
  rawName: string;
  createdBy?: string;
}) {
  const normalized = normalizeString(params.rawName);
  if (!normalized) return;

  try {
    await prisma.masterProductAlias.upsert({
      where: {
        master_product_id_normalized_name: {
          master_product_id: params.masterProductId,
          normalized_name: normalized,
        },
      },
      update: {
        approved_count: { increment: 1 },
        last_used_at: new Date(),
      },
      create: {
        master_product_id: params.masterProductId,
        raw_name: params.rawName,
        normalized_name: normalized,
        created_by: params.createdBy ?? "system_auto",
        approved_count: 1,
      },
    });
  } catch {
    // Ignora concorrência de upsert se já criado
  }
}

export async function logMatchingHistory(params: {
  distributorId?: string;
  rawName: string;
  matchedBy: MatchingSource;
  masterProductId: string;
  confidence: number;
  durationMs: number;
}) {
  try {
    await prisma.matchingHistory.create({
      data: {
        distributor_id: params.distributorId ?? null,
        raw_name: params.rawName,
        matched_by: params.matchedBy,
        master_product_id: params.masterProductId,
        confidence: params.confidence,
        duration_ms: params.durationMs,
      },
    });
  } catch {
    // Silencia erros de log
  }
}
