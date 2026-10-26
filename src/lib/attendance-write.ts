import { prisma } from "./prisma";
import { logger } from "./logger";
import { isRsvpOpen, type RsvpStatus } from "./attendance";

export type RsvpSource = "email" | "app";

export type SetRsvpResult =
  | { ok: true; status: RsvpStatus }
  | { ok: false; reason: "EVENT_NOT_FOUND" | "CLOSED" | "NO_ATTENDANCE" };

/**
 * R1/R2: el RSVP solo escribe `status`, y solo mientras isRsvpOpen. Nunca toca checkedIn.
 * createIfMissing: la ruta con sesión crea la fila si el miembro no la tenía; la del token no
 * (solo responde a una convocatoria existente). source: de dónde llega la respuesta, solo para el log.
 */
export async function setRsvp(
  eventId: string,
  userId: string,
  status: RsvpStatus,
  now: Date,
  { createIfMissing, source }: { createIfMissing: boolean; source: RsvpSource }
): Promise<SetRsvpResult> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { startDate: true, rsvpDeadline: true },
  });
  if (!event) return { ok: false, reason: "EVENT_NOT_FOUND" };
  if (!isRsvpOpen(event, now)) return { ok: false, reason: "CLOSED" };

  if (createIfMissing) {
    await prisma.attendance.upsert({
      where: { eventId_userId: { eventId, userId } },
      update: { status },
      create: { eventId, userId, status, checkedIn: false },
    });
    logger.info({ eventId, status, source }, "RSVP recorded");
    return { ok: true, status };
  }

  const updated = await prisma.attendance.updateMany({
    where: { userId, eventId },
    data: { status },
  });
  if (updated.count === 0) return { ok: false, reason: "NO_ATTENDANCE" };
  logger.info({ eventId, status, source }, "RSVP recorded");
  return { ok: true, status };
}

/**
 * R2/R3: la marca del coach solo escribe checkedIn/checkedInAt (now al marcar, null al desmarcar).
 * En update NO toca status (el RSVP original es histórico); en create, PENDING.
 */
export async function setPresence(
  eventId: string,
  userId: string,
  checkedIn: boolean
) {
  const checkedInAt = checkedIn ? new Date() : null;

  const attendance = await prisma.attendance.upsert({
    where: { eventId_userId: { eventId, userId } },
    update: { checkedIn, checkedInAt },
    create: { eventId, userId, status: "PENDING", checkedIn, checkedInAt },
  });

  logger.info({ eventId, checkedIn }, "Attendance presence set");

  return attendance;
}

/**
 * Marca checkedIn a todos los jugadores con RSVP CONFIRMED y sin check-in del evento.
 * Misma semántica que setPresence(true): checkedIn=true, checkedInAt=now y status intacto.
 * Solo miembros activos (leftAt nulo) que no sean coach. Idempotente: una segunda llamada marca 0.
 * Todo en una transacción; devuelve las filas marcadas en el formato que usa el panel.
 */
export async function markConfirmedPresent(eventId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const event = await tx.event.findUnique({ where: { id: eventId }, select: { teamId: true } });
    if (!event) return { marked: 0, attendances: [] };

    const pending = await tx.attendance.findMany({
      where: {
        eventId,
        status: "CONFIRMED",
        checkedIn: false,
        user: { memberships: { some: { teamId: event.teamId, leftAt: null, isCoach: false } } },
      },
      select: { userId: true },
    });
    if (pending.length === 0) return { marked: 0, attendances: [] };

    const userIds = pending.map((a) => a.userId);
    const checkedInAt = new Date();
    // Repite el filtro del estado: si otro coach marcó entre medias, esa fila no cuenta
    const { count } = await tx.attendance.updateMany({
      where: { eventId, userId: { in: userIds }, status: "CONFIRMED", checkedIn: false },
      data: { checkedIn: true, checkedInAt },
    });
    const attendances = await tx.attendance.findMany({
      where: { eventId, userId: { in: userIds } },
      select: { userId: true, status: true, checkedIn: true, checkedInAt: true },
    });
    return { marked: count, attendances };
  });

  logger.info({ eventId, marked: result.marked }, "Confirmed players marked present");
  return result;
}
