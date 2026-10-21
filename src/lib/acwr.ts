import { isoWeekKeyInTz } from "@/lib/week";
import { formatInTz } from "@/lib/datetime";

/**
 * ACWR (Acute:Chronic Workload Ratio) desacoplado, único para analytics, API y perfil.
 *   aguda   = carga de la semana ISO actual
 *   crónica = media de las 4 semanas ISO anteriores (la aguda NO entra)
 * Semanas sin datos cuentan como 0. Crónica 0 → ratio null (la UI muestra «—»).
 */

export type AcwrZone = "low" | "sweet" | "caution" | "danger";

/** Umbrales de zona (los de la leyenda de analytics): <0,8 · 0,8–1,3 · 1,3–1,5 · >1,5 */
export const ACWR_SWEET_MIN = 0.8;
export const ACWR_SWEET_MAX = 1.3;
export const ACWR_DANGER_MIN = 1.5;

export interface AcwrResult {
  acute: number;
  chronic: number;
  /** Redondeado a 2 decimales; null si la crónica es 0. */
  ratio: number | null;
  zone: AcwrZone | null;
}

export function acwrZone(ratio: number | null): AcwrZone | null {
  if (ratio === null) return null;
  if (ratio < ACWR_SWEET_MIN) return "low";
  if (ratio <= ACWR_SWEET_MAX) return "sweet";
  if (ratio <= ACWR_DANGER_MIN) return "caution";
  return "danger";
}

/** Lunes (12:00 UTC) de la semana ISO `weekKey`. El calendario ISO no depende de la zona horaria. */
function mondayOfWeek(weekKey: string): number {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  if (!m) throw new Error(`Clave de semana inválida: ${weekKey}`);
  const year = Number(m[1]);
  const week = Number(m[2]);
  // El 4 de enero siempre cae en la semana ISO 1; su lunes es el inicio de esa semana.
  const jan4 = new Date(Date.UTC(year, 0, 4, 12));
  const mondayWeek1 = jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * 86_400_000;
  return mondayWeek1 + (week - 1) * 7 * 86_400_000;
}

/** Clave ISO ("2026-W43") de `n` semanas antes (n>0) o después (n<0) de `weekKey`. */
export function weekKeyOffset(weekKey: string, n: number): string {
  return isoWeekKeyInTz(new Date(mondayOfWeek(weekKey) - n * 7 * 86_400_000), "UTC");
}

/**
 * Última semana ISO COMPLETA en la zona del equipo: la anterior a la actual (aritmética ISO exacta,
 * no «ahora − 7 días»). Es la semana a la que corresponde el ACWR que se muestra.
 */
export function lastCompleteWeekKey(now: Date, tz: string | null | undefined): string {
  return weekKeyOffset(isoWeekKeyInTz(now, tz), 1);
}

/** `count` semanas consecutivas terminando en `endKey`, de la más antigua a la más reciente. */
export function weekKeysEndingAt(endKey: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => weekKeyOffset(endKey, count - 1 - i));
}

/** «Semana del 12 al 18 de octubre» (o «del 28 de septiembre al 4 de octubre» si cruza de mes). */
export function weekRangeLabel(weekKey: string): string {
  const monday = new Date(mondayOfWeek(weekKey));
  const sunday = new Date(monday.getTime() + 6 * 86_400_000);
  const sameMonth = monday.getUTCMonth() === sunday.getUTCMonth();
  const from = formatInTz(monday, "UTC", sameMonth ? "d" : "d 'de' MMMM");
  const to = formatInTz(sunday, "UTC", "d 'de' MMMM");
  return `Semana del ${from} al ${to}`;
}

/** Suma la carga por semana ISO (calendario de `tz`). */
export function weeklyLoads(
  entries: ReadonlyArray<{ startDate: Date | string; workload: number }>,
  tz: string | null | undefined
): Record<string, number> {
  const loads: Record<string, number> = {};
  for (const e of entries) {
    const key = isoWeekKeyInTz(e.startDate, tz);
    loads[key] = (loads[key] ?? 0) + e.workload;
  }
  return loads;
}

export function computeAcwr(loads: Readonly<Record<string, number>>, currentWeek: string): AcwrResult {
  const acute = loads[currentWeek] ?? 0;
  let sum = 0;
  for (let j = 1; j <= 4; j++) sum += loads[weekKeyOffset(currentWeek, j)] ?? 0;
  const chronic = sum / 4;
  const ratio = chronic > 0 ? Math.round((acute / chronic) * 100) / 100 : null;
  return { acute, chronic, ratio, zone: acwrZone(ratio) };
}
