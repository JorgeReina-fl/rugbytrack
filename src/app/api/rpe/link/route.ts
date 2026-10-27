import "server-only";
import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { verifyRpeToken } from "@/lib/tokens";
import { submitPlayerRpe } from "@/lib/rpe-submit";
import { rpeEntrySchema } from "@/lib/validations/rpe";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";
import { errInfo } from "@/lib/log-safe";
import { logger } from "@/lib/logger";

// Rate limit: mismo orden de magnitud que /api/rsvp — ventana de 10 min, 20 por IP y 10 por token
// (clave = sha256, nunca el token en claro)
const RATE_WINDOW_SECONDS = 10 * 60;
const IP_LIMIT = 20;
const TOKEN_LIMIT = 10;

// Respuestas siempre JSON y sin caché; los códigos no distinguen por qué un enlace es inválido
const respond = (error: string, status: number, headers?: Record<string, string>) =>
  NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store", ...headers } });

export async function POST(req: Request) {
  try {
    const ipLimit = await checkRateLimit(
      `rpe-link:ip:${getClientIp(req.headers)}`,
      IP_LIMIT,
      RATE_WINDOW_SECONDS
    );
    if (!ipLimit.allowed) return respond("TOO_MANY_REQUESTS", 429);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return respond("INVALID_REQUEST", 400);
    }

    const { token, ...input } = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
    if (typeof token !== "string" || !token) return respond("INVALID_REQUEST", 400);

    // Antes de verificar la firma
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const tokenLimit = await checkRateLimit(
      `rpe-link:token:${tokenHash}`,
      TOKEN_LIMIT,
      RATE_WINDOW_SECONDS
    );
    if (!tokenLimit.allowed) return respond("TOO_MANY_REQUESTS", 429);

    const payload = verifyRpeToken(token);
    if (!payload) return respond("INVALID_LINK", 400);
    const { userId, eventId } = payload;

    const parsed = rpeEntrySchema.safeParse(input);
    if (!parsed.success) {
      logger.warn({ eventId, code: "INVALID_INPUT" }, "RPE link rejected");
      return respond("Datos inválidos", 400);
    }

    const result = await submitPlayerRpe(userId, eventId, parsed.data, { requireCheckIn: true });

    if (!result.ok) {
      logger.warn({ eventId, code: result.code }, "RPE link rejected");
      switch (result.code) {
        case "NOT_CHECKED_IN":
        case "NOT_ATTENDED":
          return respond("NOT_CHECKED_IN", 403);
        case "WINDOW_CLOSED":
          return respond("RPE_WINDOW_CLOSED", 403);
        case "ALREADY_RECORDED":
          return respond("ALREADY_RECORDED", 409);
        default:
          // Evento inexistente, ex-miembro, coach o evento sin empezar: indistinguibles
          return respond("INVALID_LINK", 400);
      }
    }

    logger.info({ eventId, code: "CREATED" }, "RPE link recorded");
    return NextResponse.json({ data: { recorded: true } }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logger.error({ err: errInfo(error) }, "Unhandled error in POST /api/rpe/link");
    return respond("INTERNAL", 500);
  }
}

const methodNotAllowed = () => respond("METHOD_NOT_ALLOWED", 405, { Allow: "POST" });
export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
