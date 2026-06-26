import { redis } from "@/lib/redis";

const CACHE_TTL_SECONDS = 300; // 5 minutos
const RANKING_PREFIX = "ranking:v3:";
const PRODUCT_UPDATED_PREFIX = "product_updated_at:";

/**
 * Estratégia de cache com invalidação por produto:
 *
 * - Chave de cache: `ranking:v1:{quotationId}`
 * - Cada entrada armazena: resultado + timestamp de computação + IDs das distribuidoras
 * - Chave de invalidação: `product_updated_at:{distributorId}` = epoch ms
 *
 * Na leitura:
 *   Para cada distribuidora no resultado cacheado, verifica se `product_updated_at`
 *   é posterior ao `computed_at`. Se sim, invalida e recomputa.
 *
 * Na escrita de produto:
 *   Chamar `markDistributorProductsUpdated(distributorId)`.
 */

type CacheEntry<T> = {
  result: T;
  computed_at: number; // epoch ms
  distributor_ids: string[];
};

export async function getRankingCache<T>(
  quotationId: string
): Promise<{ data: T; from_cache: true } | null> {
  try {
    const raw = await redis.get(`${RANKING_PREFIX}${quotationId}`);
    if (!raw) return null;

    let entry: CacheEntry<T>;
    try {
      entry = JSON.parse(raw) as CacheEntry<T>;
    } catch {
      return null;
    }

    // Verifica se alguma distribuidora atualizou produtos depois que o cache foi gerado
    const updatedAts = await Promise.all(
      entry.distributor_ids.map((id) =>
        redis.get(`${PRODUCT_UPDATED_PREFIX}${id}`)
      )
    );

    for (const updatedAt of updatedAts) {
      if (updatedAt && Number(updatedAt) > entry.computed_at) {
        // Cache stale — produto foi atualizado após a geração
        await redis.del(`${RANKING_PREFIX}${quotationId}`);
        return null;
      }
    }

    return { data: entry.result, from_cache: true };
  } catch {
    // Redis indisponível — trata como cache miss
    return null;
  }
}

export async function setRankingCache<T>(
  quotationId: string,
  result: T,
  distributorIds: string[]
): Promise<void> {
  const entry: CacheEntry<T> = {
    result,
    computed_at: Date.now(),
    distributor_ids: distributorIds,
  };
  await redis.setex(
    `${RANKING_PREFIX}${quotationId}`,
    CACHE_TTL_SECONDS,
    JSON.stringify(entry)
  );
}

/**
 * Chamar sempre que um produto de uma distribuidora for criado, atualizado ou removido.
 * Invalida automaticamente os rankings cacheados que incluem essa distribuidora.
 */
export async function markDistributorProductsUpdated(
  distributorId: string
): Promise<void> {
  await redis.set(`${PRODUCT_UPDATED_PREFIX}${distributorId}`, String(Date.now()));
}

export async function deleteRankingCache(quotationId: string): Promise<void> {
  await redis.del(`${RANKING_PREFIX}${quotationId}`);
}
