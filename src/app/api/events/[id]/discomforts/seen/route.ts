import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getActiveMembership } from "@/lib/membership";
import { apiForbidden, apiNotFound, apiUnauthorized, handleUnknownError } from "@/lib/api-response";

type Params = { params: Promise<{ id: string }> };

/** POST /api/events/[id]/discomforts/seen — el coach activo marca como vistas las molestias pendientes del evento. */
export async function POST(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return apiUnauthorized();
    const userId = session.user.id;
    const { id: eventId } = await params;

    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, teamId: true } });
    if (!event) return apiNotFound("Evento");

    const membership = await getActiveMembership(event.teamId, userId);
    if (!membership?.isCoach) return apiForbidden();

    const result = await prisma.discomfort.updateMany({
      where: { eventId, seenByCoachAt: null },
      data: { seenByCoachAt: new Date() },
    });
    logger.info({ eventId, marked: result.count }, "Discomforts marked as seen");

    return NextResponse.json({ marked: result.count });
  } catch (error) {
    return handleUnknownError(error, "POST /api/events/[id]/discomforts/seen");
  }
}
