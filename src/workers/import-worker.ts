/**
 * Worker de importação de produtos — processo separado do servidor Next.js.
 *
 * Executar com:
 *   npm run worker:dev          (desenvolvimento, com hot-reload)
 *   npm run worker              (produção)
 *
 * Arquitetura:
 *   - A API enfileira o job com os dados do preview armazenados no Redis
 *   - O worker busca os dados, processa em lotes e atualiza o progresso
 *   - Ao finalizar, invalida o cache de ranking das distribuidoras afetadas
 */

import "dotenv/config";
import { Worker, Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import IORedis from "ioredis";
import {
  IMPORT_QUEUE_NAME,
  createBullConnection,
  previewKey,
  type ImportJobData,
  type ImportJobResult,
} from "../lib/queue";
import type { ParsedRow } from "../lib/excel-parser";
import { markDistributorProductsUpdated } from "../lib/ranking-cache";

// ─── Clientes compartilhados no worker ───────────────────────────────────────

const prisma = new PrismaClient();
const redis = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const BATCH_SIZE = 100; // processa N produtos por vez

// ─── Função de upsert de produto ─────────────────────────────────────────────

type UpsertResult = "created" | "updated" | "failed";

async function upsertProduct(
  distributorId: string,
  row: ParsedRow,
  existingMap: Map<string, string> // key → product_id
): Promise<UpsertResult> {
  const key = productKey(row);

  try {
    const existingId = existingMap.get(key);

    if (existingId) {
      await prisma.product.update({
        where: { id: existingId },
        data: {
          price_cents: row.price_cents,
          available: row.available,
          price_updated_at: new Date(),
        },
      });
      return "updated";
    } else {
      const created = await prisma.product.create({
        data: {
          distributor_id: distributorId,
          name: row.name,
          category: row.category,
          brand: row.brand,
          packaging_type: row.packaging_type,
          packaging_volume_ml: row.packaging_volume_ml,
          price_cents: row.price_cents,
          available: row.available,
          price_updated_at: new Date(),
        },
      });
      existingMap.set(key, created.id);
      return "created";
    }
  } catch (err) {
    console.error(`[worker] Erro na linha ${row.row_number}:`, err);
    return "failed";
  }
}

/** Gera chave única de um produto para lookup de upsert. */
function productKey(row: Pick<ParsedRow, "name" | "brand" | "category" | "packaging_type" | "packaging_volume_ml">): string {
  return [
    row.name.toLowerCase().trim(),
    row.brand.toLowerCase().trim(),
    row.category,
    row.packaging_type,
    row.packaging_volume_ml,
  ].join("|");
}

// ─── Processador do job ───────────────────────────────────────────────────────

async function processImportJob(
  job: Job<ImportJobData, ImportJobResult>
): Promise<ImportJobResult> {
  const { distributor_id, preview_key } = job.data;

  // 1. Recupera os dados validados do Redis
  const raw = await redis.get(preview_key);
  if (!raw) {
    throw new Error("Dados do preview expirados ou inválidos. Faça um novo upload.");
  }

  const { valid_rows } = JSON.parse(raw) as { valid_rows: ParsedRow[] };
  const total = valid_rows.length;

  if (total === 0) {
    return { created: 0, updated: 0, failed: 0 };
  }

  // 2. Carrega todos os produtos existentes da distribuidora para lookup eficiente
  const existingProducts = await prisma.product.findMany({
    where: { distributor_id },
    select: {
      id: true,
      name: true,
      brand: true,
      category: true,
      packaging_type: true,
      packaging_volume_ml: true,
    },
  });

  const existingMap = new Map<string, string>(
    existingProducts.map((p) => [productKey(p), p.id])
  );

  let created = 0;
  let updated = 0;
  let failed = 0;
  let processed = 0;

  // 3. Processa em lotes para não sobrecarregar o banco
  for (let i = 0; i < valid_rows.length; i += BATCH_SIZE) {
    const batch = valid_rows.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (row) => {
        const result = await upsertProduct(distributor_id, row, existingMap);
        if (result === "created") created++;
        else if (result === "updated") updated++;
        else failed++;
      })
    );

    processed += batch.length;
    await job.updateProgress(Math.round((processed / total) * 100));
  }

  // 4. Invalida o cache de ranking desta distribuidora
  await markDistributorProductsUpdated(distributor_id);

  // 5. Remove o preview do Redis (já consumido)
  await redis.del(preview_key);

  return { created, updated, failed };
}

// ─── Inicialização do worker ──────────────────────────────────────────────────

const worker = new Worker<ImportJobData, ImportJobResult>(
  IMPORT_QUEUE_NAME,
  processImportJob,
  {
    connection: createBullConnection(),
    concurrency: 2, // até 2 importações simultâneas
    limiter: {
      max: 10,
      duration: 1000, // máx. 10 jobs/s para não sobrecarregar o banco
    },
  }
);

worker.on("completed", (job, result) => {
  console.log(
    `[worker] Job ${job.id} concluído — criados: ${result.created}, atualizados: ${result.updated}, erros: ${result.failed}`
  );
});

worker.on("failed", (job, err) => {
  console.error(`[worker] Job ${job?.id} falhou:`, err.message);
});

worker.on("progress", (job, progress) => {
  console.log(`[worker] Job ${job.id} progresso: ${progress}%`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[worker] Encerrando graciosamente...");
  await worker.close();
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
});

console.log(`[worker] Aguardando jobs na fila "${IMPORT_QUEUE_NAME}"...`);
