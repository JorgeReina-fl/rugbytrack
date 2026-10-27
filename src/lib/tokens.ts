import {
  RSVP_TTL_MS,
  signEventToken,
  verifyEventToken,
  signCronToken,
  verifyCronToken,
  type EventTokenPayload,
} from "../../prisma/token-core";

// La implementación vive en prisma/token-core.ts para que el cron de recordatorios
// (que corre en el contenedor sin src/) firme con exactamente el mismo código.
export { signEventToken, verifyEventToken, signCronToken, verifyCronToken };
export type { TokenPurpose, EventTokenPayload } from "../../prisma/token-core";

export function generateRsvpToken(userId: string, eventId: string): string {
  return signEventToken({ userId, eventId, purpose: "rsvp", ttlMs: RSVP_TTL_MS });
}

export function verifyRsvpToken(token: string): { userId: string; eventId: string } | null {
  const payload = verifyEventToken(token, "rsvp");
  return payload && { userId: payload.userId, eventId: payload.eventId };
}

/** Enlace de RPE: caduca exactamente al cierre del plazo (fin + 48 h). No se firman enlaces ya caducados. */
export function generateRpeToken(userId: string, eventId: string, closesAt: Date): string {
  const ttlMs = closesAt.getTime() - Date.now();
  if (!(ttlMs > 0)) throw new Error("RPE link already expired");
  return signEventToken({ userId, eventId, purpose: "rpe", ttlMs });
}

export function verifyRpeToken(token: string): EventTokenPayload | null {
  return verifyEventToken(token, "rpe");
}
