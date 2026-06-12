import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { createTeamSchema } from "@/modules/teams/teams.schema";
import {
  apiSuccess,
  apiUnauthorized,
  handleZodError,
  handleUnknownError,
} from "@/lib/api-response";
import { ZodError } from "zod";
import { randomBytes } from "crypto";

function generateInviteToken(): string {
  return randomBytes(9).toString("base64url").slice(0, 12);
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  let attempt = 0;
  while (true) {
    const exists = await prisma.team.findUnique({ where: { slug } });
    if (!exists) return slug;
    attempt++;
    slug = `${base}-${attempt}`;
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return apiUnauthorized();

  try {
    const teams = await prisma.team.findMany({
      where: {
        members: { some: { userId: session.user.id } },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        inviteToken: true,
        _count: { select: { members: true } },
        members: {
          where: { userId: session.user.id },
          select: { isCoach: true, position: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess(teams);
  } catch (err) {
    return handleUnknownError(err, "GET /api/teams");
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return apiUnauthorized();

  try {
    const body = await request.json();
    const data = createTeamSchema.parse(body);

    const baseSlug = generateSlug(data.name);
    const slug = await uniqueSlug(baseSlug);
    const inviteToken = generateInviteToken();

    const team = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const newTeam = await tx.team.create({
        data: {
          name: data.name,
          slug,
          description: data.description ?? null,
          logoUrl: data.logoUrl ?? null,
          inviteToken,
        },
      });

      await tx.teamMember.create({
        data: {
          userId: session.user.id,
          teamId: newTeam.id,
          isCoach: true,
        },
      });

      await tx.user.update({
        where: { id: session.user.id },
        data: { role: "COACH" },
      });

      return newTeam;
    });

    return apiSuccess(team, 201);
  } catch (err) {
    if (err instanceof ZodError) return handleZodError(err);
    return handleUnknownError(err, "POST /api/teams");
  }
}
