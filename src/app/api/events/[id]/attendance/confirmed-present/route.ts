import "server-only";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { markConfirmedPresent } from "@/lib/attendance-write";
import { getActiveMembership } from "@/lib/membership";
import { apiSuccess, apiUnauthorized, apiForbidden, apiNotFound, handleUnknownError } from "@/lib/api-response";

/**
 * POST /api/events/[id]/attendance/confirmed-present
 * Coach activo del equipo: marca presentes a todos los CONFIRMED sin check-in. Sin cuerpo.
 * Como en la marca individual, no hay ventana temporal: también vale después de terminar el evento.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return apiUnauthorized();

  try {
    const { id } = await params;
    const event = await prisma.event.findUnique({
      where: { id },
      select: { teamId: true },
    });
    if (!event) return apiNotFound("Evento");

    // No miembro y ex-miembro reciben el mismo 404: no se revela que el evento exista
    const membership = await getActiveMembership(event.teamId, session.user.id);
    if (!membership) return apiNotFound("Evento");
    if (!membership.isCoach) return apiForbidden();

    const { marked, attendances } = await markConfirmedPresent(id);

    return apiSuccess({
      marked,
      attendances: attendances.map((a) => ({
        userId: a.userId,
        status: a.status,
        checkedIn: a.checkedIn,
        checkedInAt: a.checkedInAt?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    return handleUnknownError(err, "POST /api/events/[id]/attendance/confirmed-present");
  }
}
