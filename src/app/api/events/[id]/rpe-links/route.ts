import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveMembership } from "@/lib/membership";
import { sendRpeLinks } from "@/lib/rpe-links";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  handleUnknownError,
} from "@/lib/api-response";

/**
 * POST /api/events/[id]/rpe-links
 * Coach activo del equipo: envía por email el enlace de RPE a los jugadores con check-in sin RPE. Sin cuerpo.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return apiUnauthorized();

  try {
    const { id } = await params;
    const event = await prisma.event.findUnique({ where: { id }, select: { teamId: true } });
    if (!event) return apiNotFound("Evento");

    // No miembro y ex-miembro reciben el mismo 404: no se revela que el evento exista
    const membership = await getActiveMembership(event.teamId, session.user.id);
    if (!membership) return apiNotFound("Evento");
    if (!membership.isCoach) return apiForbidden();

    const result = await sendRpeLinks(id, { trigger: "manual", now: new Date() });

    switch (result.code) {
      case "OK":
        return apiSuccess({ sent: result.sent, failed: result.failed, skipped: result.skipped });
      case "NOT_ENDED":
      case "WINDOW_CLOSED":
        return apiError(result.code, 409);
      case "TOO_SOON":
        return NextResponse.json(
          { error: "TOO_SOON", retryAt: result.retryAt.toISOString() },
          { status: 429 }
        );
      default:
        return apiNotFound("Evento");
    }
  } catch (err) {
    return handleUnknownError(err, "POST /api/events/[id]/rpe-links");
  }
}
