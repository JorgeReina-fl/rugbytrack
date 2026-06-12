import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
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
      return apiError("Ya eres miembro de este equipo", 409);
    }

    const member = await prisma.teamMember.create({
      data: {
        userId: session.user.id,
        teamId: team.id,
        position: data.position ?? null,
        jerseyNumber: data.jerseyNumber ?? null,
        isCoach: false,
      },
    });

    return apiSuccess({ team, member }, 201);
  } catch (err) {
    if (err instanceof ZodError) return handleZodError(err);
    return handleUnknownError(err, "POST /api/teams/join");
  }
}
