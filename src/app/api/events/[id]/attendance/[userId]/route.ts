import "server-only";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { manualAttendanceSchema } from "@/modules/events/events.schema";
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiError,
  handleZodError,
  handleUnknownError,
} from "@/lib/api-response";
import { ZodError } from "zod";
import { setPresence } from "@/lib/attendance-write";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return apiUnauthorized();

  try {
    const { id, userId } = await params;
    const event = await prisma.event.findUnique({
      where: { id },
      select: { teamId: true },
    });

    if (!event) {
      return apiNotFound("Evento");
    }

    // Valida que el usuario sea COACH en el equipo del evento
    const membership = await prisma.teamMember.findFirst({
      where: { userId: session.user.id, teamId: event.teamId, isCoach: true, leftAt: null },
    });

    if (!membership) {
      return apiForbidden();
    }

    // El jugador marcado debe ser miembro activo del equipo (no se crean asistencias a terceros)
    const target = await prisma.teamMember.findFirst({
      where: { userId, teamId: event.teamId, leftAt: null },
      select: { id: true },
    });
    if (!target) return apiError("El jugador no pertenece al equipo", 422);

    const body = await request.json();
    const data = manualAttendanceSchema.parse(body);

    const attendance = await setPresence(id, userId, data.checkedIn, session.user.id);

    return apiSuccess(attendance);
  } catch (err) {
    if (err instanceof ZodError) return handleZodError(err);
    return handleUnknownError(err, "PATCH /api/events/[id]/attendance/[userId]");
  }
}
