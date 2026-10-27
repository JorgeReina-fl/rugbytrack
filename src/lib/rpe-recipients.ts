import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Destinatarios del enlace de RPE: miembros activos del equipo, no coaches, con check-in en el
 * evento y sin RPE de ese evento. Única definición: la usan sendRpeLinks y el contador del panel.
 */
export function rpeRecipientsWhere(eventId: string, teamId: string): Prisma.AttendanceWhereInput {
  return {
    eventId,
    checkedIn: true,
    user: {
      memberships: { some: { teamId, leftAt: null, isCoach: false } },
      rpeEntries: { none: { eventId } },
    },
  };
}

export function countPendingRpe(eventId: string, teamId: string): Promise<number> {
  return prisma.attendance.count({ where: rpeRecipientsWhere(eventId, teamId) });
}
