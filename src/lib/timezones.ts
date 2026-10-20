export interface TzOption {
  tz: string;
  city: string;
}

export const TZ_OPTIONS: TzOption[] = [
  { tz: "Atlantic/Canary", city: "Canarias" },
  { tz: "Europe/Lisbon", city: "Lisboa" },
  { tz: "Europe/London", city: "Londres" },
  { tz: "Europe/Madrid", city: "Madrid" },
  { tz: "Europe/Athens", city: "Atenas" },
  { tz: "Europe/Moscow", city: "Moscú" },
  { tz: "Asia/Dubai", city: "Dubái" },
  { tz: "Asia/Tokyo", city: "Tokio" },
  { tz: "Australia/Sydney", city: "Sídney" },
  { tz: "America/New_York", city: "Nueva York" },
  { tz: "America/Chicago", city: "Chicago" },
  { tz: "America/Mexico_City", city: "Ciudad de México" },
  { tz: "America/Bogota", city: "Bogotá" },
  { tz: "America/Argentina/Buenos_Aires", city: "Buenos Aires" },
  { tz: "America/Los_Angeles", city: "Los Ángeles" },
  { tz: "UTC", city: "UTC" },
];

/** Offset en minutos respecto a UTC de `tz` en `date`, a partir de "GMT+5:30" / "GMT-4" / "GMT". */
function offsetMinutes(label: string): number {
  const m = /^GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/.exec(label);
  if (!m || !m[1]) return 0;
  const mins = Number(m[2]) * 60 + Number(m[3] ?? 0);
  return m[1] === "-" ? -mins : mins;
}

/** "GMT+2", "GMT+5:30", "GMT" para la zona IANA `tz` en el instante `date`. */
export function gmtLabel(tz: string, date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(date);
  const raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  // Normaliza "GMT+02:00" / "GMT+5:30" / "UTC" / "GMT−4" (U+2212) → "GMT+2" / "GMT+5:30" / "GMT" / "GMT-4"
  const s = raw.replace("−", "-").replace(/^UTC/, "GMT");
  const m = /^GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/.exec(s);
  if (!m || !m[1] || (Number(m[2]) === 0 && Number(m[3] ?? 0) === 0)) return "GMT";
  const mins = m[3] && m[3] !== "00" ? `:${m[3]}` : "";
  return `GMT${m[1]}${Number(m[2])}${mins}`;
}

function cityFromIana(tz: string): string {
  return (tz.split("/").pop() ?? tz).replace(/_/g, " ");
}

/** Opciones { tz, label } ordenadas por offset en `date`; añade `defaultTz` si no está en la lista. */
export function tzOptionsFor(date: Date, defaultTz: string): { tz: string; label: string }[] {
  const base = TZ_OPTIONS.some((o) => o.tz === defaultTz)
    ? TZ_OPTIONS
    : [...TZ_OPTIONS, { tz: defaultTz, city: cityFromIana(defaultTz) }];
  return base
    .map(({ tz, city }) => {
      const gmt = gmtLabel(tz, date);
      return { tz, label: `${gmt} · ${city}`, off: offsetMinutes(gmt) };
    })
    .sort((a, b) => a.off - b.off)
    .map(({ tz, label }) => ({ tz, label }));
}
