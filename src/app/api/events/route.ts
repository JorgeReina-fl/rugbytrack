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
import { sendRsvpNotifications } from "@/lib/rsvp-notify";
import { convocateAllActive, isAllTeamEvent } from "@/lib/convocation";
import { defaultFormatForTeam, slotFor, validateLineup } from "@/lib/lineup";
import { errInfo } from "@/lib/log-safe";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return apiUnauthorized();

  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("teamId");

    if (!teamId) {
      return apiError("El parámetro teamId es obligatorio", 400);
    }

    // Valida que el usuario sea miembro activo del equipo
    const membership = await prisma.teamMember.findFirst({
      where: { userId: session.user.id, teamId, leftAt: null },
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

    // Valida que el creador sea COACH activo en el equipo
    const membership = await prisma.teamMember.findFirst({
      where: { userId: session.user.id, teamId: data.teamId, isCoach: true, leftAt: null },
    });

    if (!membership) {
      return apiForbidden();
    }

    // Entrenos, otros y viajes convocan a todo el equipo activo: los callups del body se ignoran.
    const allTeam = isAllTeamEvent(data.type);

    // Convocados (partidos y torneos): sin repetidos y todos miembros activos del equipo del evento (si no, no se crea nada)
    const callups = allTeam ? [] : Array.from(new Map((data.callups ?? []).map((c) => [c.userId, c])).values());
    if (callups.length > 0) {
      const activeMembers = await prisma.teamMember.findMany({
        where: { teamId: data.teamId, leftAt: null, userId: { in: callups.map((c) => c.userId) } },
        select: { userId: true },
      });
      if (activeMembers.length !== callups.length) {
        return apiError("Algún jugador convocado no pertenece al equipo", 422);
      }
    }

    // Alineación por dorsal (partidos y torneos): isStarter y position salen del dorsal. Sin dorsal: formulario actual.
    const format = allTeam ? null : (data.format ?? (await defaultFormatForTeam(data.teamId)));
    if (format != null) {
      const errors = validateLineup(format, callups.map((c) => ({ userId: c.userId, shirtNumber: c.shirtNumber ?? null })));
      if (errors.length > 0) return apiError(errors[0] ?? "Alineación inválida", 422);
    }
    const lineup = callups.map((c) => {
      if (format == null || c.shirtNumber == null) {
        return { userId: c.userId, shirtNumber: null, isStarter: c.isStarter, position: c.position ?? null };
      }
      return { userId: c.userId, shirtNumber: c.shirtNumber, ...slotFor(format, c.shirtNumber) };
    });

    let convocated: string[] = [];
    const event = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const newEvent = await tx.event.create({
        data: {
          teamId: data.teamId,
          title: data.title,
          type: data.type,
          format,
          description: data.description ?? null,
          location: data.location ?? null,
          startDate: new Date(data.startDate),
          endDate: data.endDate ? new Date(data.endDate) : null,
          rsvpDeadline: data.rsvpDeadline ? new Date(data.rsvpDeadline) : null,
          createdById: session.user.id,
        },
      });

      if (callups.length > 0) {
        // Crea las convocatorias (Callups)
        await tx.callup.createMany({
          data: lineup.map((c) => ({
            eventId: newEvent.id,
            userId: c.userId,
            isStarter: c.isStarter,
            position: c.position,
            shirtNumber: c.shirtNumber,
          })),
        });

        // Crea los registros de asistencia (Attendance) iniciales
        await tx.attendance.createMany({
          data: callups.map((c) => ({
            eventId: newEvent.id,
            userId: c.userId,
            status: "PENDING",
            checkedIn: false,
          })),
        });
      }

      if (allTeam) {
        convocated = await convocateAllActive(tx, newEvent.id, data.teamId);
      }

      return newEvent;
    });

    // Fire-and-forget: enviar RSVP con magic link a todos los convocados
    if (callups.length > 0 || convocated.length > 0) {
      sendRsvpNotifications(event.id).catch((err: unknown) => {
        logger.error({ err: errInfo(err), eventId: event.id }, "Failed to dispatch RSVP notifications on event create");
      });
    }

    return apiSuccess(event, 201);
  } catch (err) {
    if (err instanceof ZodError) return handleZodError(err);
    return handleUnknownError(err, "POST /api/events");
  }
}
