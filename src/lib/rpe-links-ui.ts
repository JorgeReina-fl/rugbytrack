/** Mínimo entre dos envíos del mismo evento (el botón del coach no puede duplicar correos). */
export const RPE_LINKS_MIN_INTERVAL_MS = 30 * 60 * 1000;

export type RpeLinksPhase = "not_ended" | "open" | "closed";

/** Fase del envío de enlaces: antes del fin del evento, ventana abierta (hasta fin + 48 h) o cerrada. */
export function rpeLinksPhase(now: Date, endsAt: Date, closesAt: Date): RpeLinksPhase {
  if (now.getTime() < endsAt.getTime()) return "not_ended";
  return now.getTime() >= closesAt.getTime() ? "closed" : "open";
}

/** Instante a partir del cual se puede reenviar, o null si ya se puede. */
export function rpeLinksRetryAt(sentAt: Date | null, now: Date): Date | null {
  if (!sentAt) return null;
  const retryAt = new Date(sentAt.getTime() + RPE_LINKS_MIN_INTERVAL_MS);
  return retryAt.getTime() > now.getTime() ? retryAt : null;
}

/** «HH:mm» de un instante en la zona dada (para la respuesta 429, sin date-fns en el cliente). */
export function hourInTz(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false });
}
