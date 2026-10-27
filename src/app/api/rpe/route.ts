import "server-only";
import { canSubmitRpe } from "@/lib/attendance";
import { TAKEN_COUNT, isListTakenFromCount } from "@/lib/attendance-taken";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveMembership } from "@/lib/membership";
import { rpeWorkload } from "@/lib/rpe";
import { rpeWindow } from "@/lib/rpe-window";
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

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 422 });
    }
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
        attendances: {
          where: { userId },
        },
        ...TAKEN_COUNT,
      },
    });

    if (!event) {
      logger.warn({ eventId }, "Event not found");
      return apiNotFound("Evento");
    }

    const membership = await getActiveMembership(event.teamId, userId);
    if (!membership) {
      logger.warn({ eventId, teamId: event.teamId }, "User is not an active member of the event's team");
      return apiError("No perteneces al equipo asociado a este evento", 403);
    }

    if (membership.isCoach) {
      logger.warn({ eventId, teamId: event.teamId }, "Team coach attempted RPE submission");
      return apiError("Solo los jugadores pueden registrar su esfuerzo", 403);
    }

    const now = new Date();
    if (new Date(event.startDate) > now) {
      logger.warn({ eventId, startDate: event.startDate, now }, "Event has not started yet");
      return apiError("El evento aún no ha comenzado", 400);
    }

    const attendance = event.attendances[0];
    if (!attendance || !canSubmitRpe(attendance, isListTakenFromCount(event))) {
      logger.warn({ eventId, status: attendance?.status }, "Player did not confirm attendance");
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
      logger.warn({ eventId }, "RPE already submitted");
      return apiError("Ya has registrado el RPE para este evento", 409);
    }

    // Tras el 409: quien ya lo envió sigue recibiendo "ya registrado" aunque el plazo haya cerrado
    if (rpeWindow(event, now).state === "closed") {
      logger.warn({ eventId }, "RPE window closed");
      return apiError("RPE_WINDOW_CLOSED", 403);
    }

    const workload = rpeWorkload(rpe, duration);

    const rpeEntry = await prisma.rpeEntry.create({
      data: {
        eventId,
        userId,
        rpe,
        duration,
        workload,
        notes: notes ?? null,
        recordedById: userId,
      },
    });

    logger.info({ rpeEntryId: rpeEntry.id, eventId }, "RPE created successfully");
    return NextResponse.json(rpeEntry, { status: 201 });

  } catch (error: unknown) {
    if (error && typeof error === "object" && (error as any).code === "P2002") {
      logger.warn("RPE already submitted (database constraint)");
      return apiError("Ya has registrado tu RPE para esta sesión", 409);
    }
    return handleUnknownError(error, "POST /api/rpe");
  }
}
