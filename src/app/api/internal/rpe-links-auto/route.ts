import "server-only";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { errInfo } from "@/lib/log-safe";
import { eventEnd } from "@/lib/attendance";
import { sendRpeLinks } from "@/lib/rpe-links";
import { verifyCronToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

const JOB = "rpe-links-auto";
const MAX_EVENTS = 25;
const H = 60 * 60 * 1000;

const json = (body: unknown, status: number, headers?: Record<string, string>) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

/**
 * POST /api/internal/rpe-links-auto
 * Lo llama el cron (prisma/send-rpe-links.ts) con Authorization: Bearer <token cron>.
 * Cualquier fallo de autenticación responde 404 para no revelar que existe.
 */
function hasValidToken(req: Request): boolean {
  const token = /^Bearer (.+)$/.exec(req.headers.get("authorization") ?? "")?.[1];
  return !!token && !!verifyCronToken(token, JOB);
}

export async function POST(req: Request) {
  if (!hasValidToken(req)) return json({ error: "NOT_FOUND" }, 404);

  try {
    const now = new Date();

    // En BD: eventos cuyo fin (endDate, o inicio + 3 h) cae entre hace 2 h y ahora;
    // el filtro final con eventEnd se repite en JS.
    const candidates = await prisma.event.findMany({
      where: {
        rpeLinksSentAt: null,
        team: { rpeLinksAuto: true },
        OR: [
          { endDate: { gte: new Date(now.getTime() - 2 * H), lte: now } },
          { endDate: null, startDate: { gte: new Date(now.getTime() - 5 * H), lte: new Date(now.getTime() - 3 * H) } },
        ],
      },
      select: { id: true, startDate: true, endDate: true },
      orderBy: { startDate: "asc" },
      take: MAX_EVENTS,
    });

    const due = candidates
      .filter((e) => {
        const end = eventEnd(e).getTime();
        return end >= now.getTime() - 2 * H && end <= now.getTime();
      })
      .slice(0, MAX_EVENTS);

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const codes: Record<string, number> = {};
    for (const { id } of due) {
      let code: string;
      try {
        const result = await sendRpeLinks(id, { trigger: "auto", now });
        code = result.code;
        if (result.code === "OK") {
          sent += result.sent;
          failed += result.failed;
          skipped += result.skipped;
        }
      } catch (err) {
        logger.error({ err: errInfo(err) }, "rpe-links-auto: event failed");
        code = "ERROR";
      }
      codes[code] = (codes[code] ?? 0) + 1;
    }

    logger.info({ events: due.length, sent, failed, skipped, codes }, "rpe-links-auto done");
    return json({ data: { events: due.length, sent, failed, skipped, codes } }, 200);
  } catch (err) {
    logger.error({ err: errInfo(err) }, "rpe-links-auto: unhandled error");
    return json({ error: "INTERNAL" }, 500);
  }
}

// Primero el token, sea cual sea el método: sin token válido la ruta no existe (404)
const otherMethod = (req: Request) =>
  hasValidToken(req) ? json({ error: "METHOD_NOT_ALLOWED" }, 405, { Allow: "POST" }) : json({ error: "NOT_FOUND" }, 404);
export const GET = otherMethod;
export const PUT = otherMethod;
export const PATCH = otherMethod;
export const DELETE = otherMethod;
