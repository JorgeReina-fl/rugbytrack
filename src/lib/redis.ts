import "server-only";
import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function getRedis(): Redis {
  if (globalForRedis.redis) return globalForRedis.redis;

  const REDIS_URL = process.env.REDIS_URL;
  if (!REDIS_URL) throw new Error("REDIS_URL environment variable is not set");

  const client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true,
  });

  if (process.env.NODE_ENV !== "production") {
    globalForRedis.redis = client;
  }

  return client;
}

export const redis = new Proxy({} as Redis, {
  get(_target, prop) {
    const client = getRedis();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    // Métodos deben conservar `this` = client (si no, ioredis rompe en sendCommand).
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(client) : value;
  },
});
