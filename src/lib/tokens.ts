import crypto from "crypto";
import { getRequiredSecret } from "./env-secret";

export function generateRsvpToken(userId: string, eventId: string): string {
  const payloadStr = JSON.stringify({
    userId,
    eventId,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 días
  });

  const secret = getRequiredSecret("NEXTAUTH_SECRET");
  const hmac = crypto.createHmac("sha256", secret).update(payloadStr).digest("hex");

  return Buffer.from(JSON.stringify({ payload: payloadStr, hmac })).toString("base64url");
}

export function verifyRsvpToken(token: string): { userId: string; eventId: string } | null {
  // Fuera del try: una configuración rota debe fallar, no parecer un token inválido
  const secret = getRequiredSecret("NEXTAUTH_SECRET");

  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const { payload, hmac } = JSON.parse(decoded);

    if (!payload || !hmac) return null;

    const expectedHmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    if (hmac !== expectedHmac) return null; // Firma inválida

    const parsedPayload = JSON.parse(payload);
    if (parsedPayload.exp < Date.now()) return null; // Expirado

    return {
      userId: parsedPayload.userId,
      eventId: parsedPayload.eventId,
    };
  } catch {
    return null;
  }
}
