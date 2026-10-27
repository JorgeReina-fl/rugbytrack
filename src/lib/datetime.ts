import { TZDate, tz } from "@date-fns/tz";
import { format, startOfDay } from "date-fns";
import { es } from "date-fns/locale";

export const DEFAULT_TZ = "Europe/Madrid";

const INPUT_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function safeTz(tz?: string | null): string {
  return tz && isValidTimeZone(tz) ? tz : DEFAULT_TZ;
}

function toDate(date: Date | string): Date {
  return typeof date === "string" ? new Date(date) : date;
}

/** Mayúscula solo en el primer carácter («martes 27 de octubre» → «Martes 27 de octubre»); no toca el resto. */
export function capitalizeFirst(s: string): string {
  return s.charAt(0).toLocaleUpperCase("es") + s.slice(1);
}

export function formatInTz(date: Date | string, timeZone: string, pattern: string): string {
  return format(toDate(date), pattern, { locale: es, in: tz(safeTz(timeZone)) });
}

/**
 * Hora de pared "YYYY-MM-DDTHH:mm" en `timeZone` → instante UTC.
 * Casos límite de horario de verano (comportamiento de @date-fns/tz, fijado en los tests):
 * - Hora ambigua (otoño, p. ej. 02:30 del 2026-10-25 en Madrid): se elige la segunda ocurrencia (hora de invierno, +01:00).
 * - Hora inexistente (primavera, p. ej. 02:30 del 2027-03-28 en Madrid): se desplaza hacia delante (03:30, +02:00).
 */
export function zonedInputToUtc(value: string, timeZone: string): Date {
  const m = INPUT_RE.exec(value);
  if (!m) throw new Error(`Formato de fecha inválido (se espera YYYY-MM-DDTHH:mm): ${value}`);
  const [y, mo, d, h, mi] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])] as const;
  const probe = new Date(Date.UTC(y, mo - 1, d, h, mi));
  if (
    probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d ||
    probe.getUTCHours() !== h || probe.getUTCMinutes() !== mi
  ) {
    throw new Error(`Fecha inexistente: ${value}`);
  }
  return new Date(new TZDate(y, mo - 1, d, h, mi, 0, 0, safeTz(timeZone)).getTime());
}

export function utcToZonedInput(date: Date | string, timeZone: string): string {
  return formatInTz(date, timeZone, "yyyy-MM-dd'T'HH:mm");
}

export function dayKeyInTz(date: Date | string, timeZone: string): string {
  return formatInTz(date, timeZone, "yyyy-MM-dd");
}

/** Días de calendario entre a y b en `timeZone` (positivo si b es posterior a a). */
export function dayDiffInTz(a: Date | string, b: Date | string, timeZone: string): number {
  const toUtcDay = (k: string) => Date.parse(`${k}T00:00:00Z`);
  return Math.round((toUtcDay(dayKeyInTz(b, timeZone)) - toUtcDay(dayKeyInTz(a, timeZone))) / MS_PER_DAY);
}

export function startOfDayInTz(date: Date | string, timeZone: string): Date {
  return new Date(startOfDay(toDate(date), { in: tz(safeTz(timeZone)) }).getTime());
}
