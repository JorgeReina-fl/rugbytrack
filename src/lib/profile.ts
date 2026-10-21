import "server-only";
import { prisma } from "@/lib/prisma";
import { EventType } from "@prisma/client";
import { isoWeekKeyInTz } from "@/lib/week";
import { computeAcwr, weeklyLoads } from "@/lib/acwr";
import { attendanceRate } from "@/lib/attendance";
import { takenEventIds } from "@/lib/attendance-taken";

export interface TeamStat {
  teamId: string;
  teamName: string;
  avgRpe: number | null;
  attendanceRate: number | null;
  acwr: number | null;
}

export interface NotificationPrefs {
  notifyPolls: boolean;
  notifyProposals: boolean;
  notifyForumThreads: boolean;
  notifyRsvpReminders: boolean;
}

export interface ProfileData {
  account: {
    email: string;
    name: string;
    createdAt: Date;
    notifications: NotificationPrefs;
  };
  teams: Array<{
    id: string;
    name: string;
    slug: string;
    role: "COACH" | "PLAYER";
    joinedAt: Date;
  }>;
  stats: TeamStat[] | null;
}

export async function getProfileData(userId: string): Promise<ProfileData | null> {
  const DISPLAY_WEEKS = 4;
  const TOTAL_WEEKS = DISPLAY_WEEKS + 4;

  const now = new Date();
  const fourWeeksAgo = new Date(now.getTime() - DISPLAY_WEEKS * 7 * 24 * 60 * 60 * 1000);
  const eightWeeksAgo = new Date(now.getTime() - TOTAL_WEEKS * 7 * 24 * 60 * 60 * 1000);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      name: true,
      createdAt: true,
      notifyPolls: true,
      notifyProposals: true,
      notifyForumThreads: true,
      notifyRsvpReminders: true,
      memberships: {
        where: { leftAt: null },
        orderBy: { joinedAt: "asc" },
        select: {
          isCoach: true,
          joinedAt: true,
          team: { select: { id: true, name: true, slug: true, timezone: true } },
        },
      },
    },
  });

  if (!user) return null;

  const playerMemberships = user.memberships.filter((m) => !m.isCoach);

  let stats: TeamStat[] | null = null;
  if (playerMemberships.length > 0) {
    const teamIds = playerMemberships.map((m) => m.team.id);

    const [rpeEntries, attendances, trainingEvents] = await Promise.all([
      prisma.rpeEntry.findMany({
        where: {
          userId,
          event: { teamId: { in: teamIds }, startDate: { gte: eightWeeksAgo } },
        },
        select: {
          rpe: true,
          workload: true,
          event: { select: { teamId: true, startDate: true } },
        },
      }),
      prisma.attendance.findMany({
        where: {
          userId,
          event: {
            teamId: { in: teamIds },
            startDate: { gte: fourWeeksAgo },
            type: EventType.TRAINING,
          },
        },
        select: { eventId: true, status: true, checkedIn: true },
      }),
      prisma.event.findMany({
        where: {
          teamId: { in: teamIds },
          startDate: { gte: fourWeeksAgo },
          type: EventType.TRAINING,
        },
        select: { id: true, teamId: true, startDate: true, endDate: true },
      }),
    ]);

    // Eventos de la ventana con la lista pasada (≥1 checkedIn de cualquier jugador)
    const takenIds = await takenEventIds(trainingEvents.map((e) => e.id));
    const userRows = new Map(attendances.map((a) => [a.eventId, a]));

    // Same week label sequence as api/analytics/rpe, computed in each team's timezone
    const weekSeries = (tz: string) => {
      const weekLabels: string[] = [];
      for (let i = TOTAL_WEEKS - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        weekLabels.push(isoWeekKeyInTz(d, tz));
      }
      const uniqueWeeks = Array.from(new Set(weekLabels));
      return { uniqueWeeks, displayWeeks: uniqueWeeks.slice(-DISPLAY_WEEKS) };
    };

    stats = playerMemberships.map((m) => {
      const teamId = m.team.id;
      const tz = m.team.timezone;
      const { displayWeeks } = weekSeries(tz);
      const teamRpe = rpeEntries.filter((e) => e.event.teamId === teamId);

      // avgRpe: mean RPE for last 4 weeks
      const recentRpe = teamRpe.filter(
        (e) => new Date(e.event.startDate) >= fourWeeksAgo
      );
      const avgRpe =
        recentRpe.length > 0
          ? Math.round(
              (recentRpe.reduce((s, e) => s + e.rpe, 0) / recentRpe.length) * 10
            ) / 10
          : null;

      // ACWR — mismo cálculo que api/analytics/rpe (lib/acwr.ts); la última semana con carga
      const loads = weeklyLoads(teamRpe.map((e) => ({ startDate: e.event.startDate, workload: e.workload })), tz);
      let acwr: number | null = null;
      for (let i = displayWeeks.length - 1; i >= 0; i--) {
        const result = computeAcwr(loads, displayWeeks[i]!);
        if (result.acute === 0) continue;
        acwr = result.ratio;
        break;
      }

      // Tasa de asistencia en entrenos de las últimas 4 semanas (reglas comunes: solo eventos
      // terminados con lista tomada; present / (present + absent)). null → la UI muestra «—».
      const rate = attendanceRate(
        trainingEvents
          .filter((e) => e.teamId === teamId)
          .map((e) => {
            const row = userRows.get(e.id);
            return { event: e, rows: row ? [row] : [], taken: takenIds.has(e.id) };
          }),
        now
      );
      const attendanceRateValue = rate === null ? null : Math.round(rate * 100);

      return { teamId, teamName: m.team.name, avgRpe, attendanceRate: attendanceRateValue, acwr };
    });
  }

  return {
    account: {
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      notifications: {
        notifyPolls: user.notifyPolls,
        notifyProposals: user.notifyProposals,
        notifyForumThreads: user.notifyForumThreads,
        notifyRsvpReminders: user.notifyRsvpReminders,
      },
    },
    teams: user.memberships.map((m) => ({
      id: m.team.id,
      name: m.team.name,
      slug: m.team.slug,
      role: m.isCoach ? "COACH" : "PLAYER",
      joinedAt: m.joinedAt,
    })),
    stats,
  };
}
