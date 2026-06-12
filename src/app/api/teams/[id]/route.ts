import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { updateTeamSchema } from "@/modules/teams/teams.schema";
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  handleZodError,
  handleUnknownError,
} from "@/lib/api-response";
import { ZodError } from "zod";

interface Params {
  params: Promise<{ id: string }>;
}

async function getCoachMembership(userId: string, teamId: string) {
  return prisma.teamMember.findFirst({
    where: { userId, teamId, isCoach: true },
  });
}

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return apiUnauthorized();

  const { id } = await params;

  const membership = await prisma.teamMember.findFirst({
    where: { userId: session.user.id, teamId: id },
  });
  if (!membership) return apiForbidden();

  try {
    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
                email: true,
              },
            },
          },
          orderBy: [{ isCoach: "desc" }, { jerseyNumber: "asc" }],
        },
        _count: { select: { events: true } },
      },
    });

    if (!team) return apiNotFound("Equipo");

    const isCoach = membership.isCoach;
    const responseTeam = isCoach
      ? team
      : { ...team, inviteToken: undefined };

    return apiSuccess(responseTeam);
  } catch (err) {
    return handleUnknownError(err, `GET /api/teams/${id}`);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return apiUnauthorized();

  const { id } = await params;

  const coachMembership = await getCoachMembership(session.user.id, id);
  if (!coachMembership) return apiForbidden();

  try {
    const body = await req.json();
    const data = updateTeamSchema.parse(body);

    const team = await prisma.team.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
      },
    });

    return apiSuccess(team);
  } catch (err) {
    if (err instanceof ZodError) return handleZodError(err);
    return handleUnknownError(err, `PATCH /api/teams/${id}`);
  }
}
