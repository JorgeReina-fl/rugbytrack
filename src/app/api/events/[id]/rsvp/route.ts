import "server-only";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rsvpSchema } from "@/modules/events/events.schema";
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return apiUnauthorized();

  try {
    const { id } = await params;
    const event = await prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      return apiNotFound("Evento");
    }

    // Valida que el jugador sea miembro del equipo del evento
    const membership = await prisma.teamMember.findFirst({
      where: { userId: session.user.id, teamId: event.teamId },
    });

    if (!membership) {
      return apiForbidden();
    }

    // Valida el límite de RSVP (deadline)
    if (event.rsvpDeadline && new Date() > event.rsvpDeadline) {
      return apiError("La fecha límite para confirmar asistencia ha expirado", 400);
    }

    const body = await request.json();
    const data = rsvpSchema.parse(body);

    const attendance = await prisma.attendance.upsert({
      where: {
        eventId_userId: {
          eventId: id,
          userId: session.user.id,
        },
      },
      update: {
        status: data.status,
      },
      create: {
        eventId: id,
        userId: session.user.id,
        status: data.status,
        checkedIn: false,
      },
    });

    return apiSuccess(attendance);
  } catch (err) {
    if (err instanceof ZodError) return handleZodError(err);
    return handleUnknownError(err, "POST /api/events/[id]/rsvp");
  }
}
