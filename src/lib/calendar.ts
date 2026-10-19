import { dayKeyInTz, formatInTz, safeTz, zonedInputToUtc } from "@/lib/datetime";

const pad2 = (n: number) => String(n).padStart(2, "0");
const keyOf = (y: number, m: number, d: number) => `${y}-${pad2(m + 1)}-${pad2(d)}`;

/** Normaliza (year, month 0-11) con desbordamiento, como hace `new Date(year, month, 1)`. */
function normalizeMonth(year: number, month: number): { year: number; month: number } {
  const d = new Date(Date.UTC(year, month, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}

function midnightUtc(y: number, m: number, d: number, tz: string): Date {
  const day = new Date(Date.UTC(y, m, d));
  return zonedInputToUtc(`${keyOf(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate())}T00:00`, tz);
}

/** Instantes UTC de las 00:00 del día 1 del mes y del día 1 del mes siguiente en `tz` (month 0-11; intervalo [start, end)). */
export function monthRangeUtc(year: number, month: number, tz: string): { start: Date; end: Date } {
  const z = safeTz(tz);
  return { start: midnightUtc(year, month, 1, z), end: midnightUtc(year, month + 1, 1, z) };
}

export interface CalendarCell<T> {
  dayKey: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  events: Array<{ event: T; time: string }>;
}

/** Primer y último día (UTC-calendar) de la cuadrícula de lunes a domingo que cubre el mes. */
function gridBounds(year: number, month: number) {
  const first = Date.UTC(year, month, 1);
  const last = Date.UTC(year, month + 1, 0);
  const startOffset = (new Date(first).getUTCDay() + 6) % 7;
  const endOffset = 6 - ((new Date(last).getUTCDay() + 6) % 7);
  return { gridStart: first - startOffset * 86_400_000, gridEnd: last + endOffset * 86_400_000 };
}

/** Rango [start, end) en UTC de toda la cuadrícula (incluye los días de las semanas vecinas que se muestran). */
export function gridRangeUtc(year: number, month: number, tz: string): { start: Date; end: Date } {
  const z = safeTz(tz);
  const n = normalizeMonth(year, month);
  const { gridStart, gridEnd } = gridBounds(n.year, n.month);
  const s = new Date(gridStart);
  const e = new Date(gridEnd + 86_400_000);
  return {
    start: midnightUtc(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate(), z),
    end: midnightUtc(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate(), z),
  };
}

/** Semanas (lunes a domingo) del mes; los eventos se agrupan por día de calendario en `tz`. */
export function buildMonthGrid<T extends { startDate: Date | string }>(
  year: number,
  month: number,
  tz: string,
  events: T[],
  now: Date
): CalendarCell<T>[][] {
  const z = safeTz(tz);
  const n = normalizeMonth(year, month);
  const { gridStart, gridEnd } = gridBounds(n.year, n.month);
  const todayKey = dayKeyInTz(now, z);

  const byDay = new Map<string, Array<{ event: T; time: string }>>();
  for (const event of events) {
    const k = dayKeyInTz(event.startDate, z);
    const list = byDay.get(k) ?? [];
    list.push({ event, time: formatInTz(event.startDate, z, "HH:mm") });
    byDay.set(k, list);
  }

  const weeks: CalendarCell<T>[][] = [];
  for (let t = gridStart; t <= gridEnd; t += 86_400_000) {
    const d = new Date(t);
    const dayKey = keyOf(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const cell: CalendarCell<T> = {
      dayKey,
      day: d.getUTCDate(),
      inMonth: d.getUTCFullYear() === n.year && d.getUTCMonth() === n.month,
      isToday: dayKey === todayKey,
      events: byDay.get(dayKey) ?? [],
    };
    if (weeks.length === 0 || weeks[weeks.length - 1]!.length === 7) weeks.push([]);
    weeks[weeks.length - 1]!.push(cell);
  }
  return weeks;
}
