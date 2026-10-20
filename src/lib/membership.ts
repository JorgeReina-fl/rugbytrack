import "server-only";
import { prisma } from "@/lib/prisma";

/** Membresía vigente (leftAt nulo) del usuario en el equipo, o null si no es miembro activo. */
export async function getActiveMembership(teamId: string, userId: string) {
  return prisma.teamMember.findFirst({
    where: { teamId, userId, leftAt: null },
    select: { isCoach: true },
  });
}
