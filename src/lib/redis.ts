import IORedis from "ioredis";

// ---------------------------------------------------------------------------
// In-memory fallback — usado em desenvolvimento quando Redis não está disponível
// ---------------------------------------------------------------------------

type MemEntry = { value: string; expiresAt: number | null };

const globalStore = globalThis as unknown as {
  activeRedis: RedisLike | undefined;
  memMap: Map<string, MemEntry> | undefined;
};

if (!globalStore.memMap) {
  globalStore.memMap = new Map<string, MemEntry>();
}

class MemoryStore implements RedisLike {
  private get store(): Map<string, MemEntry> {
    if (!globalStore.memMap) {
      globalStore.memMap = new Map<string, MemEntry>();
    }
    return globalStore.memMap;
  }

  private isExpired(entry: MemEntry): boolean {
    return entry.expiresAt !== null && entry.expiresAt <= Date.now();
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry || this.isExpired(entry)) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, { value, expiresAt: null });
  }

  async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async exists(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry || this.isExpired(entry)) {
      this.store.delete(key);
      return 0;
    }
    return 1;
  }
}

// ---------------------------------------------------------------------------
// Interface unificada — métodos usados no codebase
// ---------------------------------------------------------------------------

export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  setex(key: string, ttlSeconds: number, value: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
  exists(key: string): Promise<number>;
}

// ---------------------------------------------------------------------------
// Singleton — tenta Redis real; cai para MemoryStore quando indisponível
// ---------------------------------------------------------------------------

const fallbackStore = new MemoryStore();

async function safeExec<T>(op: (client: RedisLike) => Promise<T>): Promise<T> {
  try {
    const client = getActiveClient();
    return await op(client);
  } catch {
    if (globalStore.activeRedis !== fallbackStore) {
      console.warn("[redis] Falha na chamada Redis — alternando para MemoryStore em fallback.");
      globalStore.activeRedis = fallbackStore;
    }
    return await op(fallbackStore);
  }
}

/**
 * Proxy que sempre delega ao cliente ativo em `globalStore.activeRedis`.
 * Isso permite que o fallback para MemoryStore funcione em tempo de execução:
 * quando ioredis falha, `globalStore.activeRedis` é trocado por MemoryStore
 * e todas as operações subsequentes passam a usar o store em memória.
 */
const redisProxy: RedisLike = {
  get:    (key)           => safeExec((c) => c.get(key)),
  set:    (key, value)    => safeExec((c) => c.set(key, value)),
  setex:  (key, ttl, val) => safeExec((c) => c.setex(key, ttl, val)),
  del:    (key)           => safeExec((c) => c.del(key)),
  exists: (key)           => safeExec((c) => c.exists(key)),
};

function getActiveClient(): RedisLike {
  if (!globalStore.activeRedis) {
    globalStore.activeRedis = createRealClient();
  }
  return globalStore.activeRedis;
}

function createRealClient(): RedisLike {
  const url = process.env.REDIS_URL;

  if (!url) {
    if (process.env.NODE_ENV === "production") {
      console.error("[redis] REDIS_URL não configurada em produção — usando store em memória.");
    } else {
      console.warn("[redis] REDIS_URL não configurada — usando store em memória (somente dev).");
    }
    return new MemoryStore();
  }

  const client = new IORedis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    connectTimeout: 2000,
    enableOfflineQueue: false,
  });

  // Suprime o evento de erro não tratado do ioredis — erros são capturados por operação
  client.on("error", (err: Error) => {
    const isConnRefused =
      err.message.includes("ECONNREFUSED") ||
      err.message.includes("ENOTFOUND") ||
      err.constructor?.name === "AggregateError";

    if (!isConnRefused) {
      console.error("[redis] erro ioredis:", err.message);
    }
  });

  // Testa conectividade; se falhar, substitui o cliente ativo por MemoryStore
  client.ping().then(() => {
    console.log("[redis] conectado com sucesso.");
  }).catch(() => {
    if (process.env.NODE_ENV === "production") {
      console.error("[redis] Redis indisponível em produção — operações de cache serão ignoradas.");
    } else {
      console.warn("[redis] Redis indisponível — usando store em memória (somente dev).");
    }
    // Troca o cliente ativo: o proxy passa a usar o MemoryStore
    globalStore.activeRedis = new MemoryStore();
    // Encerra o cliente ioredis silenciosamente
    client.disconnect();
  });

  return client;
}

export const redis: RedisLike = redisProxy;

// ---------------------------------------------------------------------------
// Blacklist de tokens (logout e troca de senha)
// ---------------------------------------------------------------------------

const BLACKLIST_PREFIX = "blacklist:jti:";
const SESSION_INVALIDATE_PREFIX = "session:invalidate:";

export async function blacklistToken(jti: string, exp: number): Promise<void> {
  const ttl = exp - Math.floor(Date.now() / 1000);
  if (ttl > 0) {
    await redis.setex(`${BLACKLIST_PREFIX}${jti}`, ttl, "1");
  }
}

export async function isTokenBlacklisted(jti: string): Promise<boolean> {
  try {
    const val = await redis.get(`${BLACKLIST_PREFIX}${jti}`);
    return val === "1";
  } catch {
    // Redis indisponível — fail-open (token não está na blacklist)
    return false;
  }
}

// Invalida todas as sessões do usuário emitidas antes de agora (troca de senha)
export async function invalidateUserSessions(userId: string): Promise<void> {
  const timestamp = Math.floor(Date.now() / 1000);
  // TTL de 25h — maior que a vida máxima do JWT (24h)
  await redis.setex(`${SESSION_INVALIDATE_PREFIX}${userId}`, 90000, String(timestamp));
}

export async function getUserSessionInvalidatedAt(userId: string): Promise<number | null> {
  try {
    const val = await redis.get(`${SESSION_INVALIDATE_PREFIX}${userId}`);
    return val ? Number(val) : null;
  } catch {
    // Redis indisponível — fail-open (ignora verificação de invalidação)
    return null;
  }
}

// ---------------------------------------------------------------------------
// Tokens de recuperação de senha
// ---------------------------------------------------------------------------

const RESET_TOKEN_PREFIX = "reset:token:";
const RESET_TTL = 1800; // 30 minutos

export async function storePasswordResetToken(token: string, userId: string): Promise<void> {
  await redis.setex(`${RESET_TOKEN_PREFIX}${token}`, RESET_TTL, userId);
}

export async function getPasswordResetToken(token: string): Promise<string | null> {
  const key = `${RESET_TOKEN_PREFIX}${token}`;
  return await redis.get(key);
}

export async function deletePasswordResetToken(token: string): Promise<void> {
  const key = `${RESET_TOKEN_PREFIX}${token}`;
  await redis.del(key);
}

export async function consumePasswordResetToken(token: string): Promise<string | null> {
  const key = `${RESET_TOKEN_PREFIX}${token}`;
  const userId = await redis.get(key);
  if (userId) {
    await redis.del(key);
  }
  return userId;
}

// ---------------------------------------------------------------------------
// Tokens de verificação de e-mail
// ---------------------------------------------------------------------------

const VERIFY_TOKEN_PREFIX = "verify:token:";
const VERIFY_TTL = 86400; // 24 horas

export async function storeEmailVerificationToken(token: string, userId: string): Promise<void> {
  await redis.setex(`${VERIFY_TOKEN_PREFIX}${token}`, VERIFY_TTL, userId);
}

export async function getEmailVerificationToken(token: string): Promise<string | null> {
  const key = `${VERIFY_TOKEN_PREFIX}${token}`;
  return await redis.get(key);
}

export async function deleteEmailVerificationToken(token: string): Promise<void> {
  const key = `${VERIFY_TOKEN_PREFIX}${token}`;
  await redis.del(key);
}

export async function consumeEmailVerificationToken(token: string): Promise<string | null> {
  const key = `${VERIFY_TOKEN_PREFIX}${token}`;
  const userId = await redis.get(key);
  if (userId) {
    await redis.del(key);
  }
  return userId;
}

