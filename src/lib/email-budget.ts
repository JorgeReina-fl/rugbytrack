import "server-only";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";

/** Hard daily limit (Resend free tier). */
const DAILY_LIMIT = 100;

/**
 * LOW-priority emails are suppressed once the counter reaches this value,
 * leaving the remaining headroom for HIGH-priority sends (RSVP callups).
 * Password reset uses SMTP, not Resend — unaffected by this counter.
 */
const LOW_PRIORITY_THRESHOLD = 90;

export type EmailPriority = "HIGH" | "LOW";

/** Redis key scoped to UTC date, so it auto-rotates at midnight. */
export function emailBudgetKey(): string {
  return `resend:daily:${new Date().toISOString().slice(0, 10)}`;
}

/** Seconds until next UTC midnight (used as TTL for the key). */
function secondsUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  );
  return Math.ceil((midnight.getTime() - now.getTime()) / 1000);
}

/**
 * Checks whether `count` emails can be sent at the given priority level,
 * then increments the daily counter if allowed.
 *
 * Returns true → caller should proceed with the send.
 * Returns false → caller must skip (low-priority threshold exceeded).
 */
export async function trackEmailBudget(
  count: number,
  priority: EmailPriority,
  context: string
): Promise<boolean> {
  if (count <= 0) return true;

  const key = emailBudgetKey();
  const current = parseInt((await redis.get(key)) ?? "0", 10);

  if (priority === "LOW" && current + count > LOW_PRIORITY_THRESHOLD) {
    logger.warn(
      { key, current, requested: count, threshold: LOW_PRIORITY_THRESHOLD, context },
      "email-budget: LOW priority suppressed — daily threshold reached"
    );
    return false;
  }

  const newCount = await redis.incrby(key, count);
  if (newCount <= count) {
    // First write of the day — set TTL so the key auto-expires at midnight
    await redis.expire(key, secondsUntilMidnight());
  }

  if (newCount > DAILY_LIMIT) {
    logger.error(
      { key, newCount, context },
      "email-budget: DAILY_LIMIT exceeded"
    );
  } else {
    logger.info(
      { key, newCount, priority, context },
      "email-budget: tracked"
    );
  }

  return true;
}
