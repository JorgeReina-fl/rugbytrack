import "server-only";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { dbConnect } from "@/lib/mongoose";
import { Thread } from "@/models/Thread";
import { Comment } from "@/models/Comment";
import { EX_MEMBER_ID, EX_MEMBER_NAME } from "@/lib/forum-author";
import type { Prisma } from "@prisma/client";

export interface RemoveMemberDataCounts {
  attendances: number;
  callups: number;
  rpeEntries: number;
  discomforts: number;
  pollVotes: number;
  proposalSupports: number;
  embeddings: number;
  rpeUnlinked: number;
  forumThreads: number;
  forumComments: number;
}

/**
 * Salida de un usuario de un equipo (abandonar o expulsión): borra sus datos de ESE equipo,
 * anonimiza su autoría en el foro y lo marca como ex-miembro (leftAt, isCoach=false).
 *
 * Conserva lo que creó para el equipo (eventos, encuestas, propuestas), el User y su
 * consentimiento de salud, y todo lo de otros equipos.
 *
 * Orden: Mongo primero (idempotente; si falla no se sale del equipo); después Prisma en UNA
 * transacción (si falla, rollback: el foro ya anonimizado es aceptable).
 * `extraOps` se ejecuta en la misma transacción (p. ej. el traspaso de coach al salir).
 */
export async function removeMemberData(params: {
  teamId: string;
  userId: string;
  membershipId: string;
  extraOps?: Prisma.PrismaPromise<unknown>[];
}): Promise<RemoveMemberDataCounts> {
  const { teamId, userId, membershipId, extraOps = [] } = params;

  // a) Foro (Mongo)
  await dbConnect();
  const threadIds = await Thread.distinct("_id", { teamId });
  const threads = await Thread.updateMany(
    { teamId, authorId: userId },
    { $set: { authorId: EX_MEMBER_ID, authorName: EX_MEMBER_NAME } }
  );
  const comments = await Comment.updateMany(
    { threadId: { $in: threadIds }, authorId: userId },
    { $set: { authorId: EX_MEMBER_ID, authorName: EX_MEMBER_NAME } }
  );

  // b) Prisma, en una sola transacción
  const inTeamEvents = { userId, event: { teamId } };
  const results = await prisma.$transaction([
    ...extraOps,
    prisma.attendance.deleteMany({ where: inTeamEvents }),
    prisma.callup.deleteMany({ where: inTeamEvents }),
    prisma.rpeEntry.deleteMany({ where: inTeamEvents }),
    prisma.discomfort.deleteMany({ where: inTeamEvents }),
    prisma.pollVote.deleteMany({ where: { userId, option: { poll: { teamId } } } }),
    prisma.proposalSupport.deleteMany({ where: { userId, proposal: { teamId } } }),
    prisma.playerEmbedding.deleteMany({ where: { userId, teamId } }),
    prisma.rpeEntry.updateMany({
      where: { recordedById: userId, userId: { not: userId }, event: { teamId } },
      data: { recordedById: null },
    }),
    prisma.teamMember.update({ where: { id: membershipId }, data: { leftAt: new Date(), isCoach: false } }),
  ]);

  const [attendances, callups, rpeEntries, discomforts, pollVotes, proposalSupports, embeddings, rpeUnlinked] =
    results.slice(extraOps.length) as Array<{ count: number }>;

  const counts: RemoveMemberDataCounts = {
    attendances: attendances!.count,
    callups: callups!.count,
    rpeEntries: rpeEntries!.count,
    discomforts: discomforts!.count,
    pollVotes: pollVotes!.count,
    proposalSupports: proposalSupports!.count,
    embeddings: embeddings!.count,
    rpeUnlinked: rpeUnlinked!.count,
    forumThreads: threads.modifiedCount,
    forumComments: comments.modifiedCount,
  };
  logger.info({ teamId, counts }, "Member data removed on team exit");
  return counts;
}
