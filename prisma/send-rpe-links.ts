/**
 * send-rpe-links.ts — Cron del envío automático de enlaces de RPE al terminar el evento.
 *
 * No toca la BD ni envía correos: firma un token de servicio (propósito "cron") y llama al endpoint
 * interno de la app, que decide qué eventos tocan y reutiliza sendRpeLinks.
 *
 * Uso standalone (dentro del container):
 *   node --experimental-strip-types --no-warnings /app/prisma/send-rpe-links.ts
 *
 * Solo imports relativos con extensión .ts (src/ no existe en el standalone build).
 */

import { signCronToken } from "./token-core.ts";

const JOB = "rpe-links-auto";
const TIMEOUT_MS = 60_000;

/** Devuelve el código de salida: 0 si el endpoint responde 200, 1 en cualquier otro caso. */
export async function main(): Promise<number> {
  const url = `http://127.0.0.1:${process.env.PORT ?? 3000}/api/internal/rpe-links-auto`;
  const at = new Date().toISOString();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${signCronToken(JOB)}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[${at}] http=${res.status}`);
      return 1;
    }
    const { data } = (await res.json()) as {
      data: { events: number; sent: number; failed: number; skipped: number };
    };
    console.log(
      `[${at}] http=${res.status} events=${data.events} sent=${data.sent} failed=${data.failed} skipped=${data.skipped}`
    );
    return 0;
  } catch (err) {
    // Sin mensaje del error: podría incluir la URL o cabeceras
    console.error(`[${at}] error=${err instanceof Error ? err.name : typeof err}`);
    return 1;
  }
}

// Solo se ejecuta como punto de entrada, no al importarlo (tests, harness)
if (/(^|[\\/])send-rpe-links\.ts$/.test(process.argv[1] ?? "")) {
  main().then((code) => process.exit(code));
}
