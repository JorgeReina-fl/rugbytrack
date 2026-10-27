import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { submitPlayerRpe } from "@/lib/rpe-submit";
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

    const result = await submitPlayerRpe(
      userId,
      eventId,
      { rpe, duration, ...(notes !== undefined && { notes }) },
      { requireCheckIn: false }
    );

    if (!result.ok) {
      logger.warn({ eventId, code: result.code }, "RPE submission rejected");
      switch (result.code) {
        case "EVENT_NOT_FOUND":
          return apiNotFound("Evento");
        case "NOT_MEMBER":
          return apiError("No perteneces al equipo asociado a este evento", 403);
        case "IS_COACH":
          return apiError("Solo los jugadores pueden registrar su esfuerzo", 403);
        case "NOT_STARTED":
          return apiError("El evento aún no ha comenzado", 400);
        case "NOT_ATTENDED":
        case "NOT_CHECKED_IN":
          return apiError("Debes confirmar tu asistencia antes de registrar el RPE", 403);
        case "ALREADY_RECORDED":
          return apiError(
            result.raced
              ? "Ya has registrado tu RPE para esta sesión"
              : "Ya has registrado el RPE para este evento",
            409
          );
        case "WINDOW_CLOSED":
          return apiError("RPE_WINDOW_CLOSED", 403);
      }
    }

    logger.info({ rpeEntryId: result.entry.id, eventId }, "RPE created successfully");
    return NextResponse.json(result.entry, { status: 201 });

  } catch (error: unknown) {
    return handleUnknownError(error, "POST /api/rpe");
  }
}
