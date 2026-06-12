import "server-only";
import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  apiSuccess,
  apiUnauthorized,
  apiNotFound,
  apiError,
  handleUnknownError,
} from "@/lib/api-response";
import { z } from "zod";

const querySchema = z.object({
  id: z.string().cuid("ID de usuario inválido"),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

/**
 * GET /api/players/similar?id=<userId>&limit=<n>
 *
 * Returns the top-N most similar players to the given user,
 * ranked by cosine distance using pgvector's <=> operator.
 *
 * The caller must belong to the same team as the target player.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return apiUnauthorized();

    const { searchParams } = req.nextUrl;
    const parsed = querySchema.safeParse({
      id: searchParams.get("id"),
      limit: searchParams.get("limit") ?? "5",
    });

    if (!parsed.success) {
      return apiError(
        "Parámetro 'id' requerido y debe ser un cuid válido",
        422
      );
    }

    const { id: targetUserId, limit } = parsed.data;

    // Fetch target player embedding
    const targetRows = await prisma.$queryRaw<
      Array<{ userId: string; teamId: string; embedding: string }>
    >`
      SELECT "userId", "teamId", embedding::text
      FROM "PlayerEmbedding"
      WHERE "userId" = ${targetUserId}
      LIMIT 1
    `;

    if (targetRows.length === 0) {
      return apiNotFound(
        "Embedding del jugador (genera primero con POST /api/players/embed)"
      );
    }

    // targetRows[0] is safe — length guard above ensures it exists
    const targetRow = targetRows[0]!;
    const { teamId, embedding: targetEmbedding } = targetRow;

    // Verify requester belongs to the same team
    const membership = await prisma.teamMember.findFirst({
      where: { userId: session.user.id, teamId },
    });
    if (!membership) return apiUnauthorized();

    // Cosine similarity search — excludes the target player from results
    // Uses pgvector's <=> operator (cosine distance: lower = more similar)
    const similar = await prisma.$queryRaw<
      Array<{
        userId: string;
        similarity: number;
        stats: unknown;
      }>
    >`
      SELECT
        pe."userId",
        1 - (pe.embedding <=> ${targetEmbedding}::vector) AS similarity,
        pe.stats
      FROM "PlayerEmbedding" pe
      WHERE pe."teamId" = ${teamId}
        AND pe."userId" != ${targetUserId}
        AND pe.embedding IS NOT NULL
      ORDER BY pe.embedding <=> ${targetEmbedding}::vector ASC
      LIMIT ${limit}
    `;

    if (similar.length === 0) {
      return apiSuccess({ players: [], message: "No hay embeddings de otros jugadores en el equipo" });
    }

    // Enrich with user info
    const userIds = similar.map((r) => r.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, image: true },
    });

    const positions = await prisma.teamMember.findMany({
      where: { userId: { in: userIds }, teamId },
      select: { userId: true, position: true, jerseyNumber: true },
    });
    const posMap = Object.fromEntries(
      positions.map((p) => [p.userId, { position: p.position, jerseyNumber: p.jerseyNumber }])
    );
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    const players = similar.map((row) => ({
      userId: row.userId,
      name: userMap[row.userId]?.name ?? "Desconocido",
      image: userMap[row.userId]?.image ?? null,
      position: posMap[row.userId]?.position ?? null,
      jerseyNumber: posMap[row.userId]?.jerseyNumber ?? null,
      similarity: Number(row.similarity),
      stats: row.stats,
    }));

    logger.info({ targetUserId, found: players.length }, "Similar players found");
    return apiSuccess({ targetUserId, teamId, players });
  } catch (err) {
    return handleUnknownError(err, "GET /api/players/similar");
  }
}
