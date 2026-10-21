import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getActiveMembership } from "@/lib/membership";
import { apiNotFound, apiUnauthorized, handleUnknownError } from "@/lib/api-response";

type Params = { params: Promise<{ id: string }> };

/** DELETE /api/discomforts/[id] — el autor, o un coach activo del equipo del evento. Otros: 404. */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return apiUnauthorized();
    const userId = session.user.id;
    const { id } = await params;

    const discomfort = await prisma.discomfort.findUnique({
      where: { id },
      select: { id: true, userId: true, eventId: true, event: { select: { teamId: true } } },
    });
    if (!discomfort) return apiNotFound();

    if (discomfort.userId !== userId) {
      const membership = await getActiveMembership(discomfort.event.teamId, userId);
      if (!membership?.isCoach) return apiNotFound();
    }

    await prisma.discomfort.delete({ where: { id } });
    logger.info({ discomfortId: id, eventId: discomfort.eventId, deletedBy: userId }, "Discomfort deleted");

    return NextResponse.json({ deleted: 1 });
  } catch (error) {
    return handleUnknownError(error, "DELETE /api/discomforts/[id]");
  }
}
