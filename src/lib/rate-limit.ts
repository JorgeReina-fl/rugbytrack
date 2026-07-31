import "server-only";
import { redis } from "@/lib/redis";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

/**
 * Fixed-window rate limiter backed by Redis.
 * Uses INCR + EXPIRE (atomic per-key; window resets on first request).
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, windowSeconds);
  }

  const ttl = await redis.ttl(key);
  const remaining = Math.max(0, limit - count);

  return {
    allowed: count <= limit,
    remaining,
    resetInSeconds: ttl > 0 ? ttl : windowSeconds,
  };
}
