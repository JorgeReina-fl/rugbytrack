import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { convocateMemberToFutureEvents } from "@/lib/convocation";
import { joinTeamSchema } from "@/modules/teams/teams.schema";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiNotFound,
  handleZodError,
  handleUnknownError,
} from "@/lib/api-response";
import { ZodError } from "zod";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return apiUnauthorized();

  try {
    const body = await request.json();
    const data = joinTeamSchema.parse(body);

    const team = await prisma.team.findUnique({
      where: { inviteToken: data.token },
      select: { id: true, name: true, slug: true },
    });

    if (!team) return apiNotFound("Equipo con ese token de invitación");

    const existing = await prisma.teamMember.findFirst({
      where: { userId: session.user.id, teamId: team.id },
    });

    if (existing) {
      if (!existing.leftAt) {
        return apiError("Ya eres miembro activo de este equipo", 409);
      }
      // Re-joining after leaving: reactivate membership y convocar a los eventos de todo el equipo futuros
      const member = await prisma.$transaction(async (tx) => {
        const reactivated = await tx.teamMember.update({
          where: { id: existing.id },
          data: {
            leftAt: null,
            isCoach: false,
            position: data.position ?? existing.position,
            jerseyNumber: data.jerseyNumber ?? existing.jerseyNumber,
          },
        });
        await convocateMemberToFutureEvents(tx, team.id, session.user.id, new Date());
        return reactivated;
      });
      return apiSuccess({ team, member }, 200);
    }

    const member = await prisma.$transaction(async (tx) => {
      const created = await tx.teamMember.create({
        data: {
          userId: session.user.id,
          teamId: team.id,
          position: data.position ?? null,
          jerseyNumber: data.jerseyNumber ?? null,
          isCoach: false,
        },
      });
      await convocateMemberToFutureEvents(tx, team.id, session.user.id, new Date());
      return created;
    });

    return apiSuccess({ team, member }, 201);
  } catch (err) {
    if (err instanceof ZodError) return handleZodError(err);
    return handleUnknownError(err, "POST /api/teams/join");
  }
}
