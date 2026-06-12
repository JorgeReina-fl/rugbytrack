import "server-only";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { updateEventSchema } from "@/modules/events/events.schema";
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  handleZodError,
  handleUnknownError,
} from "@/lib/api-response";
import { ZodError } from "zod";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return apiUnauthorized();

  try {
    const { id } = await params;
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        callups: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
        attendances: {
          where: { userId: session.user.id },
        },
      },
    });

    if (!event) {
      return apiNotFound("Evento");
    }

    // Valida que el usuario sea miembro del equipo del evento
    const membership = await prisma.teamMember.findFirst({
      where: { userId: session.user.id, teamId: event.teamId },
    });

    if (!membership) {
      return apiForbidden();
    }

    // Retorna el detalle del evento, convocados, y el estado de asistencia del usuario actual
    const userAttendance = event.attendances[0] ?? null;
    const { attendances, ...eventData } = event;

    return apiSuccess({
      event: eventData,
      userAttendance,
    });
  } catch (err) {
    return handleUnknownError(err, "GET /api/events/[id]");
  }
}

export async function PATCH(
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

    // Valida que el usuario sea COACH en el equipo del evento
    const membership = await prisma.teamMember.findFirst({
      where: { userId: session.user.id, teamId: event.teamId, isCoach: true },
    });

    // Control de propiedad (ownership check): solo el creador (que debe ser coach)
    if (!membership || event.createdById !== session.user.id) {
      return apiForbidden();
    }

    const body = await request.json();
    const data = updateEventSchema.parse(body);

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.description !== undefined) updateData.description = data.description ?? null;
    if (data.location !== undefined) updateData.location = data.location ?? null;
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null;
    if (data.rsvpDeadline !== undefined) updateData.rsvpDeadline = data.rsvpDeadline ? new Date(data.rsvpDeadline) : null;

    const updatedEvent = await prisma.event.update({
      where: { id },
      data: updateData,
    });

    return apiSuccess(updatedEvent);
  } catch (err) {
    if (err instanceof ZodError) return handleZodError(err);
    return handleUnknownError(err, "PATCH /api/events/[id]");
  }
}

export async function DELETE(
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

    // Valida que el usuario sea COACH en el equipo del evento
    const membership = await prisma.teamMember.findFirst({
      where: { userId: session.user.id, teamId: event.teamId, isCoach: true },
    });

    // Control de propiedad (ownership check): solo el creador
    if (!membership || event.createdById !== session.user.id) {
      return apiForbidden();
    }

    await prisma.event.delete({
      where: { id },
    });

    return apiSuccess({ message: "Evento eliminado correctamente" });
  } catch (err) {
    return handleUnknownError(err, "DELETE /api/events/[id]");
  }
}
