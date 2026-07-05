import { Queue, QueueEvents } from "bullmq";
import IORedis from "ioredis";

// Conexão dedicada para BullMQ (sem lazyConnect — BullMQ precisa de conexão imediata)
export function createBullConnection(): IORedis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error(
      "[queue] REDIS_URL não configurada. Import de planilha via fila requer Redis.\n" +
      "Em desenvolvimento, configure REDIS_URL ou teste o import com Redis disponível."
    );
  }
  const client = new IORedis(url, {
    maxRetriesPerRequest: null, // obrigatório para BullMQ workers
    enableReadyCheck: false,
    connectTimeout: 5000,
  });
  client.on("error", (err: Error) => {
    console.warn("[queue] erro na conexão BullMQ/Redis:", err.message);
  });
  return client;
}

// ─── Fila de importação de produtos ──────────────────────────────────────────

export const IMPORT_QUEUE_NAME = "product-import";

export type ImportJobData = {
  distributor_id: string;
  preview_key: string; // chave Redis com os dados validados do preview
  requested_by: string; // userId para auditoria
};

export type ImportJobResult = {
  created: number;
  updated: number;
  failed: number;
};

let _importQueue: Queue<ImportJobData, ImportJobResult> | null = null;

export function getImportQueue(): Queue<ImportJobData, ImportJobResult> {
  if (!_importQueue) {
    _importQueue = new Queue<ImportJobData, ImportJobResult>(IMPORT_QUEUE_NAME, {
      connection: createBullConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 100, age: 86400 }, // mantém últimos 100 jobs por 24h
        removeOnFail: { count: 50, age: 86400 },
      },
    });
  }
  return _importQueue;
}

export function createQueueEvents(): QueueEvents {
  return new QueueEvents(IMPORT_QUEUE_NAME, {
    connection: createBullConnection(),
  });
}

// ─── Chaves Redis para preview ────────────────────────────────────────────────

export const PREVIEW_TTL = 1800; // 30 minutos

export function previewKey(distributorId: string, token: string): string {
  return `import:preview:${distributorId}:${token}`;
}
