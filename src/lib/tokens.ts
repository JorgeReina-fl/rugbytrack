import { RSVP_TTL_MS, signEventToken, verifyEventToken } from "../../prisma/token-core";

// La implementación vive en prisma/token-core.ts para que el cron de recordatorios
// (que corre en el contenedor sin src/) firme con exactamente el mismo código.
export { signEventToken, verifyEventToken };
export type { TokenPurpose, EventTokenPayload } from "../../prisma/token-core";

export function generateRsvpToken(userId: string, eventId: string): string {
  return signEventToken({ userId, eventId, purpose: "rsvp", ttlMs: RSVP_TTL_MS });
}

export function verifyRsvpToken(token: string): { userId: string; eventId: string } | null {
  const payload = verifyEventToken(token, "rsvp");
  return payload && { userId: payload.userId, eventId: payload.eventId };
}
