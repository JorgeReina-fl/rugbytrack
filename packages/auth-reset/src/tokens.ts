import crypto from "node:crypto";

export interface CreateResetTokenParams {
  email: string;
  secret: string;
  expiresInMinutes: number;
}

export interface ResetTokenPayload {
  email: string;
  iat: number;
  exp: number;
}

export interface VerifyResetTokenParams {
  token: string;
  secret: string;
}

export type VerifyResetTokenResult =
  | { valid: true; email: string; iat: number; exp: number; expired: false }
  | { valid: false; email: string | null; expired: boolean };

function hmacHex(secret: string, payloadStr: string): string {
  return crypto.createHmac("sha256", secret).update(payloadStr).digest("hex");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/**
 * Emite un token de reset HMAC-SHA256 firmado con `secret`.
 * Formato: base64url(JSON({ payload: JSON({email,iat,exp}), hmac })).
 * Mismo patrón que verifyRsvpToken/lib/tokens.ts para consistencia entre apps.
 */
export function createResetToken(params: CreateResetTokenParams): string {
  const { email, secret, expiresInMinutes } = params;
  if (!email) throw new Error("createResetToken: email required");
  if (!secret) throw new Error("createResetToken: secret required");
  if (expiresInMinutes <= 0) throw new Error("createResetToken: expiresInMinutes must be > 0");

  const now = Date.now();
  const payload: ResetTokenPayload = {
    email: email.toLowerCase().trim(),
    iat: now,
    exp: now + expiresInMinutes * 60 * 1000,
  };
  const payloadStr = JSON.stringify(payload);
  const hmac = hmacHex(secret, payloadStr);
  return Buffer.from(JSON.stringify({ payload: payloadStr, hmac })).toString("base64url");
}

/**
 * Verifica firma + expiración. Retorna { valid, email, expired }.
 * NO comprueba unicidad de uso — eso es responsabilidad de la app consumidora
 * (p. ej. campo passwordResetAt en el usuario).
 */
export function verifyResetToken(params: VerifyResetTokenParams): VerifyResetTokenResult {
  const { token, secret } = params;
  if (!token || !secret) return { valid: false, email: null, expired: false };

  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const parsed = JSON.parse(decoded) as { payload?: string; hmac?: string };
    if (!parsed.payload || !parsed.hmac) {
      return { valid: false, email: null, expired: false };
    }

    const expected = hmacHex(secret, parsed.payload);
    if (!timingSafeEqualHex(expected, parsed.hmac)) {
      return { valid: false, email: null, expired: false };
    }

    const payload = JSON.parse(parsed.payload) as ResetTokenPayload;
    if (!payload.email || typeof payload.exp !== "number" || typeof payload.iat !== "number") {
      return { valid: false, email: null, expired: false };
    }

    if (payload.exp < Date.now()) {
      return { valid: false, email: payload.email, expired: true };
    }

    return {
      valid: true,
      email: payload.email,
      iat: payload.iat,
      exp: payload.exp,
      expired: false,
    };
  } catch {
    return { valid: false, email: null, expired: false };
  }
}
