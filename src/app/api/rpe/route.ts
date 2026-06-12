import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rpeEntrySchema } from "@/lib/validations/rpe";
import { z } from "zod";
import { logger } from "@/lib/logger";
import {
  apiUnauthorized,
  apiError,
  apiNotFound,
  handleUnknownError,
} from "@/lib/api-response";

const bodySchema = rpeEntrySchema.extend({
  eventId: z.string().cuid("ID de evento inválido"),
});

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      logger.warn("Unauthorized attempt to submit RPE");
      return apiUnauthorized();
    }

    if (session.user.role !== "PLAYER") {
      logger.warn({ userId: session.user.id, role: session.user.role }, "Forbidden role for RPE submission");
      return apiError("Solo los jugadores pueden registrar su esfuerzo", 403);
    }

    const body = await req.json();
    const parsedData = bodySchema.safeParse(body);

    if (!parsedData.success) {
      logger.warn({ errors: parsedData.error.format() }, "Invalid RPE payload");
      return NextResponse.json(
        { error: "Datos inválidos", details: parsedData.error.format() },
        { status: 422 }
      );
    }

    const { eventId, rpe, duration, notes } = parsedData.data;
    const userId = session.user.id;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        team: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
        attendances: {
          where: { userId },
        },
      },
    });

    if (!event) {
      logger.warn({ eventId }, "Event not found");
      return apiNotFound("Evento");
    }

    if (event.team.members.length === 0) {
      logger.warn({ userId, eventId, teamId: event.teamId }, "User is not a member of the event's team");
      return apiError("No perteneces al equipo asociado a este evento", 403);
    }

    const now = new Date();
    if (new Date(event.startDate) > now) {
      logger.warn({ eventId, startDate: event.startDate, now }, "Event has not started yet");
      return apiError("El evento aún no ha comenzado", 400);
    }

    const attendance = event.attendances[0];
    if (!attendance || (attendance.status !== "CONFIRMED" && attendance.checkedIn !== true)) {
      logger.warn({ userId, eventId, attendance }, "Player did not confirm attendance");
      return apiError("Debes confirmar tu asistencia antes de registrar el RPE", 403);
    }

    const existingRpe = await prisma.rpeEntry.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });

    if (existingRpe) {
      logger.warn({ userId, eventId }, "RPE already submitted");
      return apiError("Ya has registrado el RPE para este evento", 409);
    }

    const workload = rpe * duration;

    const rpeEntry = await prisma.rpeEntry.create({
      data: {
        eventId,
        userId,
        rpe,
        duration,
        workload,
        notes: notes ?? null,
      },
    });

    logger.info({ rpeEntryId: rpeEntry.id, userId, eventId }, "RPE created successfully");
    return NextResponse.json(rpeEntry, { status: 201 });

  } catch (error: unknown) {
    if (error && typeof error === "object" && (error as any).code === "P2002") {
      logger.warn("RPE already submitted (database constraint)");
      return apiError("Ya has registrado tu RPE para esta sesión", 409);
    }
    return handleUnknownError(error, "POST /api/rpe");
  }
}
