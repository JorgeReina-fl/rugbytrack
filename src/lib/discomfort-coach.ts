import "server-only";
import type { BodyArea } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatInTz } from "@/lib/datetime";

export interface CoachDiscomfortRow {
  id: string;
  userId: string;
  playerName: string;
  bodyArea: BodyArea;
  intensity: number;
  note: string | null;
  createdLabel: string;
  isNew: boolean;
}

/** Molestias del evento con el nombre del jugador, en una sola consulta. Solo para coach activo (el llamador lo comprueba). */
export async function getEventDiscomforts(eventId: string, teamId: string, tz: string): Promise<CoachDiscomfortRow[]> {
  const rows = await prisma.discomfort.findMany({
    // Solo de miembros activos del equipo: las de un ex-miembro no se muestran
    where: { eventId, user: { memberships: { some: { teamId, leftAt: null } } } },
    select: {
      id: true,
      userId: true,
      bodyArea: true,
      intensity: true,
      note: true,
      seenByCoachAt: true,
      createdAt: true,
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    playerName: r.user.name,
    bodyArea: r.bodyArea,
    intensity: r.intensity,
    note: r.note,
    createdLabel: formatInTz(r.createdAt, tz, "d MMM, HH:mm"),
    isNew: r.seenByCoachAt === null,
  }));
}

/** Molestias sin ver por evento, en una sola consulta limitada a los eventos dados. */
export async function getUnseenDiscomfortCounts(eventIds: string[], teamId: string): Promise<Map<string, number>> {
  if (eventIds.length === 0) return new Map();
  const groups = await prisma.discomfort.groupBy({
    by: ["eventId"],
    where: { eventId: { in: eventIds }, seenByCoachAt: null, user: { memberships: { some: { teamId, leftAt: null } } } },
    _count: { _all: true },
  });
  return new Map(groups.map((g) => [g.eventId, g._count._all]));
}
