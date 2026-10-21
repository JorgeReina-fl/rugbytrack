import "server-only";
import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiError,
  handleUnknownError,
} from "@/lib/api-response";
import {
  generateEmbedding,
  buildPlayerStatsText,
} from "@/lib/gemini-embeddings";
import { checkRateLimit } from "@/lib/rate-limit";
import { attendanceRate } from "@/lib/attendance";
import { takenEventIds } from "@/lib/attendance-taken";
import { z } from "zod";

const querySchema = z.object({
  userId: z.string().cuid("ID de usuario inválido").optional(),
  teamId: z.string().cuid("ID de equipo inválido").optional(),
});

/**
 * POST /api/players/embed
 *
 * Coach-only. Generates (or refreshes) embeddings for one or all players in a team.
 *
 * Body: { userId?: string; teamId: string }
 * - If userId is provided → embeds only that player.
 * - Otherwise → embeds ALL players in the team.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return apiUnauthorized();

    const rl = await checkRateLimit(`rate_limit:embed:${session.user.id}`, 10, 3600);
    if (!rl.allowed) {
      return apiError(
        `Rate limit exceeded. Try again in ${Math.ceil(rl.resetInSeconds / 60)} minutes.`,
        429
      );
    }

    const body = await req.json();
    const parsed = querySchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Datos inválidos: se requiere teamId (cuid)", 422);
    }

    const { teamId, userId } = parsed.data;

    if (!teamId) {
      return apiError("teamId es obligatorio", 422);
    }

    // Coach must belong to the team
    const coachMembership = await prisma.teamMember.findFirst({
      where: { userId: session.user.id, teamId, isCoach: true, leftAt: null },
    });
    if (!coachMembership) return apiForbidden();

    // Fetch active members to embed
    const memberWhere = userId
      ? { teamId, userId, leftAt: null as null }
      : { teamId, isCoach: false, leftAt: null as null };

    const members = await prisma.teamMember.findMany({
      where: memberWhere,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            rpeEntries: {
              orderBy: { createdAt: "desc" },
              take: 20,
              select: { rpe: true, workload: true },
            },
            attendances: {
              where: { event: { teamId } },
              select: { eventId: true, status: true, checkedIn: true },
            },
          },
        },
      },
    });

    // Un userId pedido debe ser miembro activo de este equipo (si no, ni se revela si existe)
    if (userId && members.length === 0) return apiForbidden();
    if (members.length === 0) return apiNotFound("Jugadores");

    // Tasa con las reglas comunes: solo eventos terminados con lista tomada (todos los eventos del equipo)
    const teamEvents = await prisma.event.findMany({
      where: { teamId },
      select: { id: true, startDate: true, endDate: true },
    });
    const eventById = new Map(teamEvents.map((e) => [e.id, e]));
    const takenIds = await takenEventIds(teamEvents.map((e) => e.id));
    const now = new Date();

    const results: { userId: string; ok: boolean }[] = [];

    for (const member of members) {
      const u = member.user;
      const rpeSamples = u.rpeEntries;
      const avgRpe =
        rpeSamples.length > 0
          ? rpeSamples.reduce((s, e) => s + e.rpe, 0) / rpeSamples.length
          : 0;
      const avgWorkload =
        rpeSamples.length > 0
          ? rpeSamples.reduce((s, e) => s + e.workload, 0) / rpeSamples.length
          : 0;
      const rate = attendanceRate(
        u.attendances.flatMap((a) => {
          const event = eventById.get(a.eventId);
          return event ? [{ event, rows: [a], taken: takenIds.has(a.eventId) }] : [];
        }),
        now
      );
      const stats = {
        position: member.position ?? null,
        avgRpe,
        attendanceRate: rate, // null = sin eventos con lista (no es 0 %)
        totalEvents: u.attendances.length,
        avgWorkload,
      };

      const text = buildPlayerStatsText(stats);

      try {
        const vector = await generateEmbedding(text);
        const vecString = `[${vector.join(",")}]`;

        // Upsert using raw SQL because Prisma doesn't support vector type natively
        await prisma.$executeRaw`
          INSERT INTO "PlayerEmbedding" (id, "userId", "teamId", embedding, stats, "updatedAt")
          VALUES (
            gen_random_uuid()::text,
            ${u.id},
            ${teamId},
            ${vecString}::vector,
            ${JSON.stringify(stats)}::jsonb,
            NOW()
          )
          ON CONFLICT ("userId") DO UPDATE
            SET embedding  = EXCLUDED.embedding,
                stats      = EXCLUDED.stats,
                "teamId"   = EXCLUDED."teamId",
                "updatedAt"= NOW()
        `;

        results.push({ userId: u.id, ok: true });
        logger.info({ userId: u.id, teamId }, "Embedding generated");
      } catch (embErr) {
        logger.error({ embErr, userId: u.id }, "Failed to generate embedding");
        results.push({ userId: u.id, ok: false });
      }
    }

    return apiSuccess({ embedded: results.filter((r) => r.ok).length, results });
  } catch (err) {
    return handleUnknownError(err, "POST /api/players/embed");
  }
}
