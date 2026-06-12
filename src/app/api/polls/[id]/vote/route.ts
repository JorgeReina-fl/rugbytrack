import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiError,
  apiNotFound,
  handleZodError,
  handleUnknownError,
} from "@/lib/api-response";
import { z } from "zod";

interface Params {
  params: Promise<{ id: string }>;
}

const voteSchema = z.object({
  optionId: z.string().min(1),
});

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return apiUnauthorized();

  const { id } = await params;
  const userId = session.user.id;

  try {
    const body = await req.json();
    const { optionId } = voteSchema.parse(body);

    const poll = await prisma.poll.findUnique({
      where: { id },
      include: { options: true },
    });

    if (!poll) return apiNotFound("Poll");

    if (!poll.isActive) {
      return apiError("La encuesta ya no está activa", 400);
    }

    // Verify user belongs to the team
    const membership = await prisma.teamMember.findFirst({
      where: { userId, teamId: poll.teamId },
    });
    if (!membership) return apiForbidden();

    // Check if the user already voted for this option (our schema currently unique per optionId+userId)
    // Actually, usually users can only vote for ONE option per poll.
    // Let's enforce 1 vote per poll per user.
    const existingVote = await prisma.pollVote.findFirst({
      where: {
        userId,
        option: { pollId: id },
      },
    });

    if (existingVote) {
      if (existingVote.pollOptionId === optionId) {
        return apiError("Ya has votado por esta opción", 400);
      }
      // Delete old vote, insert new one (changing vote)
      await prisma.pollVote.delete({ where: { id: existingVote.id } });
    }

    const vote = await prisma.pollVote.create({
      data: {
        pollOptionId: optionId,
        userId,
      },
    });

    // Fetch updated poll options for broadcasting
    const updatedOptions = await prisma.pollOption.findMany({
      where: { pollId: id },
      include: {
        _count: { select: { votes: true } },
      },
    });

    // Broadcast update via Redis Pub/Sub
    await redis.publish(
      "poll:update",
      JSON.stringify({
        teamId: poll.teamId,
        pollId: id,
        options: updatedOptions.map((opt: { id: string; _count: { votes: number } }) => ({
          id: opt.id,
          votesCount: opt._count.votes,
        })),
      })
    );

    return apiSuccess({ vote });
  } catch (err) {
    if (err instanceof z.ZodError) return handleZodError(err);
    return handleUnknownError(err, `POST /api/polls/${id}/vote`);
  }
}
