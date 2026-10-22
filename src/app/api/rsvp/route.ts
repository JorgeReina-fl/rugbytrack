import "server-only";
import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { verifyRsvpToken } from "@/lib/tokens";
import { handleUnknownError } from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";
import { setRsvp } from "@/lib/attendance-write";
import { getClientIp } from "@/lib/client-ip";

// Rate limit: ventana de 10 min, 20 por IP y 10 por token (clave = sha256, nunca el token en claro)
const RATE_WINDOW_SECONDS = 10 * 60;
const IP_LIMIT = 20;
const TOKEN_LIMIT = 10;
const TOO_MANY = "Too many requests";

const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  try {
    const ipLimit = await checkRateLimit(
      `rsvp:ip:${getClientIp(req.headers)}`,
      IP_LIMIT,
      RATE_WINDOW_SECONDS
    );
    if (!ipLimit.allowed) return fail(TOO_MANY, 429);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return fail("Invalid request payload", 400);
    }

    const { token, status } = (body ?? {}) as { token?: unknown; status?: unknown };

    if (
      typeof token !== "string" ||
      !token ||
      (status !== "CONFIRMED" && status !== "DECLINED")
    ) {
      return fail("Invalid request payload", 400);
    }

    // Antes de verificar la firma
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const tokenLimit = await checkRateLimit(
      `rsvp:token:${tokenHash}`,
      TOKEN_LIMIT,
      RATE_WINDOW_SECONDS
    );
    if (!tokenLimit.allowed) return fail(TOO_MANY, 429);

    const payload = verifyRsvpToken(token);

    if (!payload) {
      return fail("Invalid or expired token", 401);
    }

    const { userId, eventId } = payload;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { teamId: true },
    });

    if (!event) return fail("Attendance record not found", 404);

    // Mismas reglas que POST /api/events/[id]/rsvp
    const membership = await prisma.teamMember.findFirst({
      where: { userId, teamId: event.teamId, leftAt: null },
      select: { id: true },
    });

    if (!membership) return fail("Not a team member", 403);

    const result = await setRsvp(eventId, userId, status, new Date(), {
      createIfMissing: false,
      source: "email",
    });

    if (!result.ok) {
      if (result.reason === "CLOSED") return fail("RSVP closed", 409);
      return fail("Attendance record not found", 404);
    }

    return NextResponse.json({ data: { status } });
  } catch (error) {
    return handleUnknownError(error, "POST /api/rsvp");
  }
}
