import { TZDate } from "@date-fns/tz";
import { getISOWeek, getISOWeekYear } from "date-fns";
import { safeTz } from "@/lib/datetime";

/** Clave de semana ISO ("2026-W43") de `date` según el calendario de `tz`. */
export function isoWeekKeyInTz(date: Date | string, tz: string | null | undefined): string {
  const zoned = new TZDate(typeof date === "string" ? new Date(date) : date, safeTz(tz));
  return `${getISOWeekYear(zoned)}-W${String(getISOWeek(zoned)).padStart(2, "0")}`;
}
