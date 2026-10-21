import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

/** Membresía vigente (leftAt nulo) del usuario en el equipo, o null si no es miembro activo. */
export async function getActiveMembership(teamId: string, userId: string) {
  return prisma.teamMember.findFirst({
    where: { teamId, userId, leftAt: null },
    select: { isCoach: true },
  });
}

/** Equipos en los que el usuario es miembro activo (leftAt nulo), con su rol en cada uno. */
export async function getActiveTeamsForUser(userId: string) {
  return prisma.team.findMany({
    where: { members: { some: { userId, leftAt: null } } },
    select: {
      id: true,
      name: true,
      timezone: true,
      members: { where: { userId, leftAt: null }, select: { isCoach: true } },
    },
    orderBy: { name: "asc" },
  });
}

/**
 * Para páginas: membresía vigente con su equipo, o notFound() (404 idéntico para ex-miembro y
 * no miembro: no se revela que el equipo exista).
 */
export async function requireActiveMembership(teamId: string, userId: string) {
  const membership = await prisma.teamMember.findFirst({
    where: { teamId, userId, leftAt: null },
    include: { team: true },
  });
  if (!membership) notFound();
  return membership;
}
