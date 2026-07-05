import { RateLimiterRedis, RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";

// 5 tentativas em 15 minutos por IP — bloqueia por 30 minutos
const RATE_LIMIT_CONFIG = {
  keyPrefix: "rate:login",
  points: 5,
  duration: 900,       // 15 minutos
  blockDuration: 1800, // 30 minutos
};

function createRateLimiter(): RateLimiterRedis | RateLimiterMemory {
  const url = process.env.REDIS_URL;

  if (url && process.env.NODE_ENV === "production") {
    // Em produção, usa Redis real via cliente já criado em redis.ts
    // Importação dinâmica para evitar ciclo de dependência
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const IORedis = require("ioredis");
    const client = new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectTimeout: 2000,
    });
    client.on("error", (err: Error) => {
      console.warn("[rate-limit] Conexão Redis falhou ou erro no cliente:", err.message);
    });
    return new RateLimiterRedis({ storeClient: client, ...RATE_LIMIT_CONFIG });
  }

  if (process.env.NODE_ENV !== "production") {
    console.warn("[rate-limit] Redis indisponível — usando RateLimiterMemory (somente dev).");
  }

  return new RateLimiterMemory(RATE_LIMIT_CONFIG);
}

const globalLimiter = globalThis as unknown as {
  loginRateLimiter: RateLimiterRedis | RateLimiterMemory | undefined;
};

export const loginRateLimiter: RateLimiterRedis | RateLimiterMemory =
  globalLimiter.loginRateLimiter ?? createRateLimiter();

if (process.env.NODE_ENV !== "production") {
  globalLimiter.loginRateLimiter = loginRateLimiter;
}

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export async function checkLoginRateLimit(ip: string): Promise<RateLimitResult> {
  try {
    await loginRateLimiter.consume(ip);
    return { allowed: true };
  } catch (err) {
    if (err instanceof RateLimiterRes) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil(err.msBeforeNext / 1000),
      };
    }
    // Erro inesperado de conexão — fail open em dev, fail closed em prod
    if (process.env.NODE_ENV === "production") throw err;
    console.error("[rate-limit] Erro inesperado:", err);
    return { allowed: true };
  }
}

export async function resetLoginRateLimit(ip: string): Promise<void> {
  await loginRateLimiter.delete(ip);
}
