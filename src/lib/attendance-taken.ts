import { prisma } from "./prisma";

/**
 * Inclusión de Prisma para saber si un evento tiene la lista pasada sin cargar sus filas:
 * `_count.attendances` = filas con checkedIn. Equivale a listTaken (≥1 checkedIn).
 */
export const TAKEN_COUNT = {
  _count: { select: { attendances: { where: { checkedIn: true } } } },
} as const;

export function isListTakenFromCount(event: { _count: { attendances: number } }): boolean {
  return event._count.attendances > 0;
}

/**
 * Ids de evento (dentro de `eventIds`) con ≥1 checkedIn. Mismo resultado que listTaken sobre
 * todas las filas del evento; evita cargar las filas de todos los jugadores.
 */
export async function takenEventIds(eventIds: string[]): Promise<Set<string>> {
  if (eventIds.length === 0) return new Set();
  const groups = await prisma.attendance.groupBy({
    by: ["eventId"],
    where: { eventId: { in: eventIds }, checkedIn: true },
  });
  return new Set(groups.map((g) => g.eventId));
}
