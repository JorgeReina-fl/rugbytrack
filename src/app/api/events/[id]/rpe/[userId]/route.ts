import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getActiveMembership } from "@/lib/membership";
import { rpeWorkload } from "@/lib/rpe";
import { rpeEntrySchema } from "@/lib/validations/rpe";
import { apiError, apiForbidden, apiNotFound, apiUnauthorized, handleUnknownError } from "@/lib/api-response";

// El coach solo fija rpe y duración; las notas son del jugador.
const bodySchema = rpeEntrySchema.pick({ rpe: true, duration: true });

type Params = { params: Promise<{ id: string; userId: string }> };

/**
 * Sesión, evento, coach activo del equipo y objetivo miembro activo no coach. Devuelve la
 * respuesta de error o los datos ya validados.
 */
async function authorizeCoach(params: Params["params"]) {
  const session = await auth();
  if (!session?.user?.id) return { error: apiUnauthorized() };
  const coachId = session.user.id;

  const { id: eventId, userId } = await params;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, teamId: true, startDate: true },
  });
  if (!event) return { error: apiNotFound("Evento") };

  const coach = await getActiveMembership(event.teamId, coachId);
  if (!coach?.isCoach) return { error: apiError("Se requiere rol de entrenador", 403) };

  // Un objetivo fuera del equipo, ex-miembro o coach recibe el mismo 403 (no se revela si existe)
  const target = await getActiveMembership(event.teamId, userId);
  if (!target || target.isCoach) return { error: apiForbidden() };

  return { event, eventId, userId, coachId };
}

/**
 * PUT /api/events/[id]/rpe/[userId]
 *
 * Coach activo del equipo: crea o corrige el RPE de un jugador presente (checkedIn) en un
 * evento ya empezado. La entrada queda con recordedById = coach.
 */
export async function PUT(req: Request, { params }: Params) {
  try {
    const authz = await authorizeCoach(params);
    if (authz.error) return authz.error;
    const { event, eventId, userId, coachId } = authz;

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 422 });
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos", details: parsed.error.format() }, { status: 422 });
    }
    const { rpe, duration } = parsed.data;

    const attendance = await prisma.attendance.findFirst({
      where: { eventId, userId },
      select: { checkedIn: true },
    });
    if (!attendance?.checkedIn) return apiError("El jugador no está marcado como presente", 409);

    if (new Date(event.startDate) > new Date()) return apiError("El evento aún no ha comenzado", 400);

    const previous = await prisma.rpeEntry.findUnique({
      where: { eventId_userId: { eventId, userId } },
      select: { rpe: true, duration: true, recordedById: true },
    });

    const workload = rpeWorkload(rpe, duration);
    const entry = await prisma.rpeEntry.upsert({
      where: { eventId_userId: { eventId, userId } },
      create: { eventId, userId, rpe, duration, workload, recordedById: coachId },
      update: { rpe, duration, workload, recordedById: coachId },
      select: { rpe: true, duration: true, workload: true, recordedById: true, updatedAt: true },
    });

    if (previous) {
      logger.info(
        {
          eventId,
          userId,
          rpe: { from: previous.rpe, to: rpe },
          duration: { from: previous.duration, to: duration },
          recordedById: { from: previous.recordedById, to: coachId },
        },
        "RPE corrected by coach"
      );
    } else {
      logger.info({ eventId, userId, recordedById: coachId }, "RPE created by coach");
    }

    return NextResponse.json(entry);
  } catch (error) {
    return handleUnknownError(error, "PUT /api/events/[id]/rpe/[userId]");
  }
}

/**
 * DELETE /api/events/[id]/rpe/[userId]
 *
 * Coach activo del equipo: borra el RPE de un jugador (no exige check-in ni evento empezado,
 * para poder retirar entradas de jugadores que ya no figuran presentes).
 */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const authz = await authorizeCoach(params);
    if (authz.error) return authz.error;
    const { eventId, userId } = authz;

    const entry = await prisma.rpeEntry.findUnique({
      where: { eventId_userId: { eventId, userId } },
      select: { rpe: true, duration: true, recordedById: true },
    });
    if (!entry) return apiNotFound("RPE");

    await prisma.rpeEntry.delete({ where: { eventId_userId: { eventId, userId } } });

    logger.info(
      { eventId, userId, rpe: entry.rpe, duration: entry.duration, recordedById: entry.recordedById },
      "RPE deleted by coach"
    );
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return handleUnknownError(error, "DELETE /api/events/[id]/rpe/[userId]");
  }
}
