import "server-only";
import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiError,
  handleUnknownError,
} from "@/lib/api-response";
import { z } from "zod";
import { isoWeekKeyInTz } from "@/lib/week";
import { computeAcwr, lastCompleteWeekKey, weekKeysEndingAt, weeklyLoads } from "@/lib/acwr";

const querySchema = z.object({
  teamId: z.string().cuid("ID de equipo inválido"),
  weeks: z.coerce.number().int().min(1).max(16).default(8),
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return apiUnauthorized();

    const { searchParams } = req.nextUrl;
    const parsed = querySchema.safeParse({
      teamId: searchParams.get("teamId"),
      weeks: searchParams.get("weeks") ?? "8",
    });

    if (!parsed.success) {
      return apiError(
        "Parámetros inválidos: teamId es requerido y weeks debe estar entre 1 y 16",
        422
      );
    }

    const { teamId, weeks } = parsed.data;

    // Check if the user is an active coach of this team
    const membership = await prisma.teamMember.findFirst({
      where: {
        userId: session.user.id,
        teamId,
        isCoach: true,
        leftAt: null,
      },
      include: { team: { select: { timezone: true } } },
    });

    if (!membership) {
      return apiForbidden();
    }

    // Get all active players (isCoach: false)
    const teamPlayers = await prisma.teamMember.findMany({
      where: {
        teamId,
        isCoach: false,
        leftAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    // ACWR de la última semana ISO completa (la actual aún no ha terminado); la crónica usa 4 semanas más
    const tz = membership.team.timezone;
    const acwrWeek = lastCompleteWeekKey(new Date(), tz);
    // La semana más antigua necesaria empieza como mucho 13 días + (weeks + 3) semanas antes de ahora
    const startDateThreshold = new Date();
    startDateThreshold.setDate(startDateThreshold.getDate() - (weeks + 5) * 7);

    const rpeEntries = await prisma.rpeEntry.findMany({
      where: {
        event: {
          teamId,
          startDate: { gte: startDateThreshold },
        },
      },
      include: {
        event: {
          select: {
            startDate: true,
          },
        },
      },
    });

    // Cargas y RPE por jugador y semana ISO
    const dataMap: Record<string, Record<string, { rpeSum: number; count: number }>> = {};
    const loadsByUser: Record<string, { startDate: Date; workload: number }[]> = {};
    for (const entry of rpeEntries) {
      const weekLabel = isoWeekKeyInTz(entry.event.startDate, membership.team.timezone);
      const userMap = (dataMap[entry.userId] ??= {});
      const weekData = (userMap[weekLabel] ??= { rpeSum: 0, count: 0 });
      weekData.rpeSum += entry.rpe;
      weekData.count += 1;
      (loadsByUser[entry.userId] ??= []).push({ startDate: entry.event.startDate, workload: entry.workload });
    }

    // Heatmap / visualization weeks: las últimas N semanas completas (aritmética ISO exacta)
    const activeWeeks = weekKeysEndingAt(acwrWeek, weeks);

    const playersData = teamPlayers.map((member) => {
      const u = member.user;
      const playerMap = dataMap[u.id] || {};
      const loads = weeklyLoads(loadsByUser[u.id] ?? [], membership.team.timezone);

      const weeklyData = activeWeeks.map((week) => {
        const stats = playerMap[week];
        const { acute, ratio } = computeAcwr(loads, week);
        return {
          week,
          workload: acute,
          avgRpe: stats && stats.count > 0 ? Math.round((stats.rpeSum / stats.count) * 10) / 10 : 0,
          acwr: ratio ?? 0,
        };
      });

      // «Latest» = la última semana completa (siempre la última de la serie), con o sin carga
      const latestStats = weeklyData[weeklyData.length - 1] ?? { workload: 0, avgRpe: 0, acwr: 0 };

      return {
        userId: u.id,
        name: u.name,
        image: u.image,
        weeklyData,
        latestACWR: latestStats.acwr,
        latestWorkload: latestStats.workload,
        latestAvgRpe: latestStats.avgRpe,
        hasAlert: latestStats.acwr > 1.5,
      };
    });

    const teamWeeklyAvgLoad =
      activeWeeks.length > 0
        ? Math.round(
            (playersData.reduce(
              (sum, p) =>
                sum +
                p.weeklyData.reduce((s, w) => s + w.workload, 0),
              0
            ) /
              (playersData.length || 1) /
              activeWeeks.length) *
              10
          ) / 10
        : 0;

    logger.info(
      { teamId, playersCount: teamPlayers.length },
      "Team RPE analytics generated"
    );

    return apiSuccess({
      weeks: activeWeeks,
      acwrWeek,
      players: playersData,
      teamWeeklyAvgLoad,
    });
  } catch (err) {
    return handleUnknownError(err, "GET /api/analytics/rpe");
  }
}
