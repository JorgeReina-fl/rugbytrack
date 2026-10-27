import crypto from "crypto";
import { getRequiredSecret } from "./env-secret";

export type TokenPurpose = "rsvp" | "rpe";

export interface EventTokenPayload {
  userId: string;
  eventId: string;
  exp: number;
  p?: TokenPurpose;
}

const RSVP_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días
const KEY_DOMAIN = "rugbytrack/token/v1/";

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
  const secret = getRequiredSecret("NEXTAUTH_SECRET");

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
  const secret = getRequiredSecret("NEXTAUTH_SECRET");

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

export function generateRsvpToken(userId: string, eventId: string): string {
  return signEventToken({ userId, eventId, purpose: "rsvp", ttlMs: RSVP_TTL_MS });
}

export function verifyRsvpToken(token: string): { userId: string; eventId: string } | null {
  const payload = verifyEventToken(token, "rsvp");
  return payload && { userId: payload.userId, eventId: payload.eventId };
}
