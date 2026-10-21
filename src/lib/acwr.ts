import { isoWeekKeyInTz } from "@/lib/week";

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

/** Clave ISO ("2026-W43") de `n` semanas antes (n>0) o después (n<0) de `weekKey`. */
export function weekKeyOffset(weekKey: string, n: number): string {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  if (!m) throw new Error(`Clave de semana inválida: ${weekKey}`);
  const year = Number(m[1]);
  const week = Number(m[2]);
  // El 4 de enero siempre cae en la semana ISO 1; su lunes es el inicio de esa semana.
  const jan4 = new Date(Date.UTC(year, 0, 4, 12));
  const mondayWeek1 = jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * 86_400_000;
  const target = new Date(mondayWeek1 + ((week - 1) - n) * 7 * 86_400_000);
  return isoWeekKeyInTz(target, "UTC");
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
