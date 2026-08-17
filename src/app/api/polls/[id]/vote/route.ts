import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { Prisma } from "@prisma/client";
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

class AlreadyVotedError extends Error {}
class SameOptionError extends Error {}

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
      where: { userId, teamId: poll.teamId, leftAt: null },
    });
    if (!membership) return apiForbidden();

    // Atomic vote: findFirst → optional delete → create inside a single transaction.
    // Prevents the TOCTOU race where two concurrent requests from the same user both
    // pass the existingVote check and attempt duplicate creates.
    // The @@unique([pollOptionId, userId]) DB constraint is a second-line defense (P2002).
    let vote: Awaited<ReturnType<typeof prisma.pollVote.create>>;
    try {
      vote = await prisma.$transaction(async (tx) => {
        const existingVote = await tx.pollVote.findFirst({
          where: { userId, option: { pollId: id } },
        });

        if (existingVote) {
          if (existingVote.pollOptionId === optionId) throw new SameOptionError();
          await tx.pollVote.delete({ where: { id: existingVote.id } });
        }

        return tx.pollVote.create({
          data: { pollOptionId: optionId, userId },
        });
      });
    } catch (txErr) {
      if (txErr instanceof SameOptionError) {
        return apiError("Ya has votado por esta opción", 400);
      }
      if (txErr instanceof AlreadyVotedError) {
        return apiError("Ya has votado en esta encuesta", 409);
      }
      if (
        txErr instanceof Prisma.PrismaClientKnownRequestError &&
        txErr.code === "P2002"
      ) {
        return apiError("Ya has votado en esta encuesta", 409);
      }
      throw txErr;
    }

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
