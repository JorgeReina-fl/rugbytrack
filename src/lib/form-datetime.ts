import { zonedInputToUtc } from "@/lib/datetime";

const INPUT_PREFIX_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/;

/**
 * Valor de un `<input type="datetime-local">` (hora de pared en la zona del equipo) → ISO UTC con Z.
 * Devuelve null si el valor está vacío o no es válido (el servidor lo rechazará con su propio mensaje).
 */
export function localInputToIso(value: string, tz: string): string | null {
  const m = INPUT_PREFIX_RE.exec(value);
  if (!m) return null;
  try {
    return zonedInputToUtc(m[1]!, tz).toISOString();
  } catch {
    return null;
  }
}
