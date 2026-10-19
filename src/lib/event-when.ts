import { dayDiffInTz, safeTz } from "@/lib/datetime";

export interface EventWhen {
  dateTime: string;
  relative: "hoy" | "mañana" | null;
  tz: string;
}

/**
 * Fecha/hora de un evento en la zona del equipo y su cercanía respecto a `now`
 * (calculada por días de calendario en esa zona, no en UTC).
 * El formato de `dateTime` es el mismo que usaban los emails (es-ES, 24 h).
 * prisma/send-rsvp-reminders.ts lleva una copia de esta lógica (el standalone no incluye src/).
 */
export function eventWhen(startDate: Date, tz: string | null | undefined, now: Date): EventWhen {
  const zone = safeTz(tz);
  const dateTime = startDate.toLocaleString("es-ES", {
    timeZone: zone,
    weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const diff = dayDiffInTz(now, startDate, zone);
  return { dateTime, relative: diff === 0 ? "hoy" : diff === 1 ? "mañana" : null, tz: zone };
}
