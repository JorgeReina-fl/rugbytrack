import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  handleZodError,
  handleUnknownError,
} from "@/lib/api-response";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { sendPollNotification } from "@/lib/resend";

interface Params {
  params: Promise<{ id: string }>;
}

const createPollSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  options: z.array(z.string().min(1)).min(2, "At least two options are required"),
  expiresAt: z.coerce.date().optional(),
});

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return apiUnauthorized();

  const { id } = await params;

  try {
    const membership = await prisma.teamMember.findFirst({
      where: { userId: session.user.id, teamId: id, leftAt: null },
    });
    if (!membership) return apiForbidden();

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
    where: { userId: session.user.id, teamId: id, isCoach: true, leftAt: null },
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
        expiresAt: data.expiresAt ?? null,
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

    const response = apiSuccess(poll);

    // Fire-and-forget: notificar a miembros activos, excluyendo al autor y a quienes desactivaron notifyPolls
    prisma.team
      .findUnique({
        where: { id },
        select: {
          name: true,
          members: {
            where: { leftAt: null, userId: { not: session.user.id } },
            select: { user: { select: { email: true, name: true, notifyPolls: true } } },
          },
        },
      })
      .then((team) => {
        if (!team) return;
        const recipients = team.members.map((m) => m.user).filter((u) => u.notifyPolls);
        return sendPollNotification({
          members: recipients,
          teamName: team.name,
          teamId: id,
          pollTitle: poll.title,
        });
      })
      .catch((err) => logger.error({ err, teamId: id, pollId: poll.id }, "Failed to dispatch poll notification"));

    return response;
  } catch (err) {
    if (err instanceof z.ZodError) return handleZodError(err);
    return handleUnknownError(err, `POST /api/teams/${id}/polls`);
  }
}
