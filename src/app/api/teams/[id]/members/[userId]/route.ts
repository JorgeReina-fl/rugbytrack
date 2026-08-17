import "server-only";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiError,
  handleUnknownError,
} from "@/lib/api-response";

interface Params {
  params: Promise<{ id: string; userId: string }>;
}

/** DELETE /api/teams/[id]/members/[userId] — Coach expels a member (soft-delete) */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return apiUnauthorized();

    const { id: teamId, userId: targetUserId } = await params;

    // Must be a coach of this team
    const callerMembership = await prisma.teamMember.findFirst({
      where: { userId: session.user.id, teamId, isCoach: true, leftAt: null },
    });
    if (!callerMembership) return apiForbidden();

    // Coach cannot expel themselves via this endpoint
    if (session.user.id === targetUserId) {
      return apiError("Usa el endpoint de abandonar equipo para salir tú mismo", 400);
    }

    // Target must be an active member
    const targetMembership = await prisma.teamMember.findFirst({
      where: { userId: targetUserId, teamId, leftAt: null },
    });
    if (!targetMembership) return apiNotFound("Miembro");

    // Cannot expel the last active coach
    if (targetMembership.isCoach) {
      const activeCoachCount = await prisma.teamMember.count({
        where: { teamId, isCoach: true, leftAt: null },
      });
      if (activeCoachCount <= 1) {
        return apiError("No puedes expulsar al único coach activo del equipo", 400);
      }
    }

    await prisma.teamMember.update({
      where: { id: targetMembership.id },
      data: { leftAt: new Date() },
    });

    return apiSuccess({ message: "Miembro expulsado del equipo" });
  } catch (err) {
    return handleUnknownError(err, "DELETE /api/teams/[id]/members/[userId]");
  }
}
