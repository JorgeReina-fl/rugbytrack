// Sin "server-only" ni alias "@/": server.ts (Socket.IO) lo importa y se compila con tsc a CommonJS.
import Redis from "ioredis";
import { prisma } from "./prisma";
import { logger } from "./logger";
import { isRsvpOpen, type RsvpStatus } from "./attendance";

export type SetRsvpResult =
  | { ok: true; status: RsvpStatus }
  | { ok: false; reason: "EVENT_NOT_FOUND" | "CLOSED" | "NO_ATTENDANCE" };

/**
 * R1/R2: el RSVP solo escribe `status`, y solo mientras isRsvpOpen. Nunca toca checkedIn.
 * createIfMissing: la ruta con sesión crea la fila si el miembro no la tenía; la del token no
 * (solo responde a una convocatoria existente).
 */
export async function setRsvp(
  eventId: string,
  userId: string,
  status: RsvpStatus,
  now: Date,
  { createIfMissing }: { createIfMissing: boolean }
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
    return { ok: true, status };
  }

  const updated = await prisma.attendance.updateMany({
    where: { userId, eventId },
    data: { status },
  });
  if (updated.count === 0) return { ok: false, reason: "NO_ATTENDANCE" };
  return { ok: true, status };
}

/**
 * R2/R3: la marca del coach solo escribe checkedIn/checkedInAt (now al marcar, null al desmarcar).
 * En update NO toca status (el RSVP original es histórico); en create, PENDING.
 * Publica en Redis "attendance:update"; server.ts lo retransmite a la sala de la sesión.
 * `actor` solo se usa para el log (el coach, o el propio jugador en el check-in por socket).
 */
export async function setPresence(
  eventId: string,
  userId: string,
  checkedIn: boolean,
  actor: string
) {
  const checkedInAt = checkedIn ? new Date() : null;

  const attendance = await prisma.attendance.upsert({
    where: { eventId_userId: { eventId, userId } },
    update: { checkedIn, checkedInAt },
    create: { eventId, userId, status: "PENDING", checkedIn, checkedInAt },
    include: { user: { select: { name: true } } },
  });

  logger.info({ eventId, userId, actor, checkedIn }, "Attendance presence set");
  await publishAttendanceUpdate(attendance);

  return attendance;
}

async function publishAttendanceUpdate(attendance: {
  eventId: string;
  userId: string;
  checkedIn: boolean;
  checkedInAt: Date | null;
  status: string;
  user: { name: string | null };
}) {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return;

  const publisher = new Redis(redisUrl, { maxRetriesPerRequest: null });
  try {
    await publisher.publish(
      "attendance:update",
      JSON.stringify({
        eventId: attendance.eventId,
        userId: attendance.userId,
        name: attendance.user.name,
        checkedIn: attendance.checkedIn,
        checkedInAt: attendance.checkedInAt?.toISOString() ?? null,
        status: attendance.status,
      })
    );
  } finally {
    await publisher.quit();
  }
}
