/**
 * token-core.ts — Núcleo único de los tokens firmados con propósito.
 *
 * Lo usan src/lib/tokens.ts (Next) y prisma/send-rsvp-reminders.ts (cron, con
 * node --experimental-strip-types dentro del contenedor, donde src/ no existe).
 * Por eso: sin imports salvo node:crypto, sin enums ni alias, y solo sintaxis
 * TypeScript que el type-stripping de Node sabe borrar.
 */

import crypto from "node:crypto";

export type TokenPurpose = "rsvp" | "rpe" | "cron";

export interface EventTokenPayload {
  userId: string;
  eventId: string;
  exp: number;
  p?: TokenPurpose;
}

export const RSVP_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días
const KEY_DOMAIN = "rugbytrack/token/v1/";

// Único punto de lectura del secreto: ningún llamante puede olvidarse de
// comprobarlo ni pasar uno distinto, y falla con error en vez de degradar.
function getSecret(): string {
  return assertSecret(process.env.NEXTAUTH_SECRET, "NEXTAUTH_SECRET");
}

export function assertSecret(value: string | undefined, name: string): string {
  if (!value || value.length < 32) {
    throw new Error(`${name} missing or too short`);
  }
  return value;
}

// "rsvp" conserva la clave original para no invalidar los enlaces ya enviados;
// el resto de propósitos usan una clave derivada, de modo que quitar o cambiar
// `p` en el payload rompe la firma.
function keyFor(purpose: TokenPurpose, secret: string): Buffer | string {
  if (purpose === "rsvp") return secret;
  return crypto
    .createHmac("sha256", secret)
    .update(KEY_DOMAIN + purpose)
    .digest();
}

export function signEventToken(args: {
  userId: string;
  eventId: string;
  purpose: TokenPurpose;
  ttlMs: number;
}): string {
  const secret = getSecret();

  const payloadStr = JSON.stringify({
    userId: args.userId,
    eventId: args.eventId,
    exp: Date.now() + args.ttlMs,
    p: args.purpose,
  });
  const hmac = crypto
    .createHmac("sha256", keyFor(args.purpose, secret))
    .update(payloadStr)
    .digest("hex");

  return Buffer.from(JSON.stringify({ payload: payloadStr, hmac })).toString("base64url");
}

export function verifyEventToken(
  token: string,
  expectedPurpose: TokenPurpose,
): EventTokenPayload | null {
  // Fuera del try: una configuración rota debe fallar, no parecer un token inválido
  const secret = getSecret();

  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const { payload, hmac } = JSON.parse(decoded);

    if (typeof payload !== "string" || typeof hmac !== "string") return null;

    const expectedHmac = crypto
      .createHmac("sha256", keyFor(expectedPurpose, secret))
      .update(payload)
      .digest("hex");

    const given = Buffer.from(hmac);
    const expected = Buffer.from(expectedHmac);
    // timingSafeEqual lanza si las longitudes difieren: se descarta antes
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
      return null; // Firma inválida
    }

    const parsed = JSON.parse(payload);
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.userId !== "string" || typeof parsed.eventId !== "string") return null;
    if (typeof parsed.exp !== "number" || parsed.exp < Date.now()) return null; // Expirado

    if (parsed.p === undefined) {
      // Enlaces RSVP anteriores al propósito: solo valen como RSVP
      if (expectedPurpose !== "rsvp") return null;
    } else if (parsed.p !== expectedPurpose) {
      return null;
    }

    return {
      userId: parsed.userId,
      eventId: parsed.eventId,
      exp: parsed.exp,
      ...(parsed.p !== undefined && { p: parsed.p as TokenPurpose }),
    };
  } catch {
    return null;
  }
}

// Token de servicio para el cron (script → endpoint interno de la app). No identifica a ningún
// usuario ni evento: userId es CRON_USER_ID y eventId es el nombre del trabajo.
export const CRON_USER_ID = "cron";
export const CRON_TOKEN_TTL_MS = 5 * 60 * 1000;

export function signCronToken(job: string): string {
  return signEventToken({ userId: CRON_USER_ID, eventId: job, purpose: "cron", ttlMs: CRON_TOKEN_TTL_MS });
}

export function verifyCronToken(token: string, job: string): EventTokenPayload | null {
  const payload = verifyEventToken(token, "cron");
  return payload && payload.userId === CRON_USER_ID && payload.eventId === job ? payload : null;
}
