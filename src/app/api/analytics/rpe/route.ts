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

const querySchema = z.object({
  teamId: z.string().cuid("ID de equipo inválido"),
  weeks: z.coerce.number().int().min(1).max(16).default(8),
});

function getISOWeek(d: Date) {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((date.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7
    )
  );
}

function getISOWeekYear(d: Date) {
  const date = new Date(d.getTime());
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  return date.getFullYear();
}

function getWeekLabel(date: Date) {
  const y = getISOWeekYear(date);
  const w = getISOWeek(date);
  return `${y}-W${String(w).padStart(2, "0")}`;
}

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

    // Check if the user is a coach of this team
    const membership = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: session.user.id,
          teamId,
        },
      },
    });

    if (!membership || !membership.isCoach) {
      return apiForbidden();
    }

    // Get all players (isCoach: false)
    const teamPlayers = await prisma.teamMember.findMany({
      where: {
        teamId,
        isCoach: false,
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

    // Fetch RpeEntries for last weeks + 4 weeks to compute chronic ratio
    const weeksToFetch = weeks + 4;
    const startDateThreshold = new Date();
    startDateThreshold.setDate(startDateThreshold.getDate() - weeksToFetch * 7);

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

    // Map RPE entries by userId and ISO week
    const dataMap: Record<
      string,
      Record<string, { workload: number; rpeSum: number; count: number }>
    > = {};

    for (const entry of rpeEntries) {
      const weekLabel = getWeekLabel(new Date(entry.event.startDate));
      let userMap = dataMap[entry.userId];
      if (!userMap) {
        userMap = {};
        dataMap[entry.userId] = userMap;
      }
      let weekData = userMap[weekLabel];
      if (!weekData) {
        weekData = { workload: 0, rpeSum: 0, count: 0 };
        userMap[weekLabel] = weekData;
      }
      weekData.workload += entry.workload;
      weekData.rpeSum += entry.rpe;
      weekData.count += 1;
    }

    // Generate list of sequential weeks
    const weekLabels: string[] = [];
    const now = new Date();
    for (let i = weeksToFetch - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      weekLabels.push(getWeekLabel(d));
    }
    const uniqueWeeks = Array.from(new Set(weekLabels)).slice(-weeksToFetch);

    // Heatmap / visualization weeks (the last N weeks)
    const activeWeeks = uniqueWeeks.slice(-weeks);

    const playersData = teamPlayers.map((member) => {
      const u = member.user;
      const playerMap = dataMap[u.id] || {};

      // Calculate workloads for all weeks (to compute moving ACWR)
      const allWeeksData = uniqueWeeks.map((week) => {
        const stats = playerMap[week] || { workload: 0, rpeSum: 0, count: 0 };
        return {
          week,
          workload: stats.workload,
          avgRpe: stats.count > 0 ? Math.round((stats.rpeSum / stats.count) * 10) / 10 : 0,
        };
      });

      // Map back to just active weeks, calculating ACWR relative to previous weeks
      const weeklyData = activeWeeks.map((week) => {
        const indexInAll = uniqueWeeks.indexOf(week);
        const currentWeekStats = allWeeksData[indexInAll] || { workload: 0, avgRpe: 0 };
        const acute = currentWeekStats.workload;

        // Chronic is avg of last 4 weeks (indexInAll, indexInAll - 1, indexInAll - 2, indexInAll - 3)
        let sumChronic = 0;
        let countChronic = 0;
        for (let j = 0; j < 4; j++) {
          const idx = indexInAll - j;
          if (idx >= 0) {
            const wData = allWeeksData[idx];
            if (wData) {
              sumChronic += wData.workload;
              countChronic++;
            }
          }
        }
        const chronic = countChronic > 0 ? sumChronic / countChronic : 0;
        const acwr = chronic > 0 ? Math.round((acute / chronic) * 100) / 100 : 0;

        return {
          week,
          workload: acute,
          avgRpe: currentWeekStats.avgRpe,
          acwr,
        };
      });

      const latestStats = weeklyData[weeklyData.length - 1] || {
        workload: 0,
        avgRpe: 0,
        acwr: 0,
      };

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

    // Calculate team summary stats
    let totalTeamLoad = 0;
    let totalActiveCells = 0;
    activeWeeks.forEach((week) => {
      playersData.forEach((p) => {
        const wData = p.weeklyData.find((d) => d.week === week);
        if (wData && wData.workload > 0) {
          totalTeamLoad += wData.workload;
          totalActiveCells++;
        }
      });
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
      players: playersData,
      teamWeeklyAvgLoad,
    });
  } catch (err) {
    return handleUnknownError(err, "GET /api/analytics/rpe");
  }
}
