import "server-only";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { createEventSchema } from "@/modules/events/events.schema";
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  handleZodError,
  handleUnknownError,
  apiError,
} from "@/lib/api-response";
import { ZodError } from "zod";
import { logger } from "@/lib/logger";
import { sendCallupNotification } from "@/lib/resend";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return apiUnauthorized();

  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("teamId");

    if (!teamId) {
      return apiError("El parámetro teamId es obligatorio", 400);
    }

    // Valida que el usuario sea miembro del equipo
    const membership = await prisma.teamMember.findFirst({
      where: { userId: session.user.id, teamId },
    });

    if (!membership) {
      return apiForbidden();
    }

    const events = await prisma.event.findMany({
      where: { teamId },
      orderBy: { startDate: "asc" },
    });

    return apiSuccess(events);
  } catch (err) {
    return handleUnknownError(err, "GET /api/events");
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return apiUnauthorized();

  try {
    const body = await request.json();
    const data = createEventSchema.parse(body);

    // Valida que el creador sea COACH en el equipo
    const membership = await prisma.teamMember.findFirst({
      where: { userId: session.user.id, teamId: data.teamId, isCoach: true },
    });

    if (!membership) {
      return apiForbidden();
    }

    const event = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const newEvent = await tx.event.create({
        data: {
          teamId: data.teamId,
          title: data.title,
          type: data.type,
          description: data.description ?? null,
          location: data.location ?? null,
          startDate: new Date(data.startDate),
          endDate: data.endDate ? new Date(data.endDate) : null,
          rsvpDeadline: data.rsvpDeadline ? new Date(data.rsvpDeadline) : null,
          createdById: session.user.id,
        },
      });

      if (data.callups && data.callups.length > 0) {
        // Crea las convocatorias (Callups)
        await tx.callup.createMany({
          data: data.callups.map((c) => ({
            eventId: newEvent.id,
            userId: c.userId,
            isStarter: c.isStarter,
            position: c.position ?? null,
          })),
        });

        // Crea los registros de asistencia (Attendance) iniciales
        await tx.attendance.createMany({
          data: data.callups.map((c) => ({
            eventId: newEvent.id,
            userId: c.userId,
            status: "PENDING",
            checkedIn: false,
          })),
        });
      }

      return newEvent;
    });

    // Envío asíncrono de notificaciones por correo (fire-and-forget)
    if (data.callups && data.callups.length > 0) {
      prisma.user
        .findMany({
          where: { id: { in: data.callups.map((c) => c.userId) } },
          select: { id: true, email: true, name: true },
        })
        .then((users: Array<{ id: string; email: string; name: string }>) => {
          users.forEach((user: { id: string; email: string; name: string }) => {
            const rsvpLink = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/events/${event.id}`;
            sendCallupNotification({
              to: user.email,
              userName: user.name,
              eventTitle: event.title,
              eventDate: event.startDate.toLocaleString("es-ES"),
              eventLocation: event.location || "No especificado",
              rsvpLink,
            }).catch((emailErr: unknown) => {
              logger.error({ err: emailErr, userId: user.id, eventId: event.id }, "Failed to send callup notification email");
            });
          });
        })
        .catch((dbErr: unknown) => {
          logger.error({ err: dbErr, eventId: event.id }, "Failed to query users for async callup notification emails");
        });
    }

    return apiSuccess(event, 201);
  } catch (err) {
    if (err instanceof ZodError) return handleZodError(err);
    return handleUnknownError(err, "POST /api/events");
  }
}
