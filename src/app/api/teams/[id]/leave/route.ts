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
  params: Promise<{ id: string }>;
}

/** POST /api/teams/[id]/leave — Active member self-exits (soft-delete) */
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return apiUnauthorized();

    const { id: teamId } = await params;

    const membership = await prisma.teamMember.findFirst({
      where: { userId: session.user.id, teamId, leftAt: null },
    });
    if (!membership) return apiForbidden();

    if (membership.isCoach) {
      const activeCoachCount = await prisma.teamMember.count({
        where: { teamId, isCoach: true, leftAt: null },
      });

      if (activeCoachCount <= 1) {
        // Must transfer role first
        let body: { newCoachUserId?: string } = {};
        try {
          body = await req.json();
        } catch {
          // empty body
        }

        if (!body.newCoachUserId) {
          return apiError(
            "Eres el único coach. Proporciona newCoachUserId para transferir el rol antes de salir",
            400
          );
        }

        const newCoachMembership = await prisma.teamMember.findFirst({
          where: { userId: body.newCoachUserId, teamId, leftAt: null, isCoach: false },
        });
        if (!newCoachMembership) {
          return apiNotFound("El nuevo coach (debe ser miembro activo no-coach)");
        }

        // Transfer coach role and leave in one transaction
        await prisma.$transaction([
          prisma.teamMember.update({
            where: { id: newCoachMembership.id },
            data: { isCoach: true },
          }),
          prisma.teamMember.update({
            where: { id: membership.id },
            data: { leftAt: new Date() },
          }),
        ]);

        return apiSuccess({ message: "Rol transferido y equipo abandonado" });
      }
    }

    // Multiple coaches or non-coach: leave directly
    await prisma.teamMember.update({
      where: { id: membership.id },
      data: { leftAt: new Date() },
    });

    return apiSuccess({ message: "Has abandonado el equipo" });
  } catch (err) {
    return handleUnknownError(err, "POST /api/teams/[id]/leave");
  }
}
