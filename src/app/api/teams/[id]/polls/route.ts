import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiError,
  handleZodError,
  handleUnknownError,
} from "@/lib/api-response";
import { z } from "zod";

interface Params {
  params: Promise<{ id: string }>;
}

const createPollSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  options: z.array(z.string().min(1)).min(2, "At least two options are required"),
});

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return apiUnauthorized();

  const { id } = await params;

  const membership = await prisma.teamMember.findFirst({
    where: { userId: session.user.id, teamId: id },
  });
  if (!membership) return apiForbidden();

  try {
    const polls = await prisma.poll.findMany({
      where: { teamId: id },
      include: {
        options: {
          include: {
            _count: { select: { votes: true } },
          },
        },
        createdBy: {
          select: { name: true, image: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess(polls);
  } catch (err) {
    return handleUnknownError(err, `GET /api/teams/${id}/polls`);
  }
}

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return apiUnauthorized();

  const { id } = await params;

  const membership = await prisma.teamMember.findFirst({
    where: { userId: session.user.id, teamId: id, isCoach: true },
  });
  if (!membership) return apiForbidden();

  try {
    const body = await req.json();
    const data = createPollSchema.parse(body);

    const poll = await prisma.poll.create({
      data: {
        teamId: id,
        title: data.title,
        description: data.description ?? null,
        createdById: session.user.id,
        options: {
          create: data.options.map((text) => ({ text })),
        },
      },
      include: {
        options: {
          include: {
            _count: { select: { votes: true } },
          },
        },
        createdBy: {
          select: { name: true, image: true },
        },
      },
    });

    return apiSuccess(poll);
  } catch (err) {
    if (err instanceof z.ZodError) return handleZodError(err);
    return handleUnknownError(err, `POST /api/teams/${id}/polls`);
  }
}
