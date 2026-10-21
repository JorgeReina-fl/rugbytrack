import type { EventType, Prisma } from "@prisma/client";

/** Tipos de evento a los que se convoca automáticamente a todo el equipo activo (sin selección ni alineación). */
export const ALL_TEAM_TYPES: readonly EventType[] = ["TRAINING", "OTHER", "TRIP"];

export function isAllTeamEvent(type: EventType): boolean {
  return ALL_TEAM_TYPES.includes(type);
}

type Tx = Pick<Prisma.TransactionClient, "teamMember" | "attendance" | "event">;

/**
 * Convoca (Attendance PENDING) a todos los miembros activos NO coach del equipo al evento.
 * Idempotente: no toca las asistencias que ya existen. Devuelve los userId convocados ahora.
 */
export async function convocateAllActive(tx: Tx, eventId: string, teamId: string): Promise<string[]> {
  const members = await tx.teamMember.findMany({
    where: { teamId, leftAt: null, isCoach: false },
    select: { userId: true },
  });
  if (members.length === 0) return [];

  const existing = await tx.attendance.findMany({
    where: { eventId, userId: { in: members.map((m) => m.userId) } },
    select: { userId: true },
  });
  const already = new Set(existing.map((a) => a.userId));
  const toCreate = members.map((m) => m.userId).filter((id) => !already.has(id));
  if (toCreate.length === 0) return [];

  await tx.attendance.createMany({
    data: toCreate.map((userId) => ({ eventId, userId, status: "PENDING" as const, checkedIn: false })),
    skipDuplicates: true,
  });
  return toCreate;
}

/**
 * Alta o reingreso: convoca (sin correo) al nuevo miembro a los eventos de todo el equipo FUTUROS
 * de su equipo. Una consulta para los eventos y un createMany.
 */
export async function convocateMemberToFutureEvents(tx: Tx, teamId: string, userId: string, now: Date): Promise<number> {
  const events = await tx.event.findMany({
    where: { teamId, type: { in: [...ALL_TEAM_TYPES] }, startDate: { gt: now } },
    select: { id: true },
  });
  if (events.length === 0) return 0;
  const created = await tx.attendance.createMany({
    data: events.map((e) => ({ eventId: e.id, userId, status: "PENDING" as const, checkedIn: false })),
    skipDuplicates: true,
  });
  return created.count;
}
