import "server-only";
import { prisma } from "@/lib/prisma";
import { EventType } from "@prisma/client";
import { isoWeekKeyInTz } from "@/lib/week";

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
        select: {
          status: true,
          checkedIn: true,
          event: { select: { teamId: true } },
        },
      }),
      prisma.event.findMany({
        where: {
          teamId: { in: teamIds },
          startDate: { gte: fourWeeksAgo },
          type: EventType.TRAINING,
        },
        select: { id: true, teamId: true },
      }),
    ]);

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
      const { uniqueWeeks, displayWeeks } = weekSeries(tz);
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

      // ACWR — same algorithm as api/analytics/rpe
      const weeklyMap: Record<string, number> = {};
      for (const entry of teamRpe) {
        const wl = isoWeekKeyInTz(entry.event.startDate, tz);
        weeklyMap[wl] = (weeklyMap[wl] ?? 0) + entry.workload;
      }
      const allWeeksData = uniqueWeeks.map((week) => ({
        week,
        workload: weeklyMap[week] ?? 0,
      }));

      let acwr: number | null = null;
      for (let i = displayWeeks.length - 1; i >= 0; i--) {
        const week = displayWeeks[i]!;
        const indexInAll = uniqueWeeks.indexOf(week);
        const acute = allWeeksData[indexInAll]?.workload ?? 0;
        if (acute === 0) continue;

        let sumChronic = 0;
        let countChronic = 0;
        for (let j = 1; j <= 4; j++) {
          const idx = indexInAll - j;
          if (idx >= 0) {
            sumChronic += allWeeksData[idx]?.workload ?? 0;
            countChronic++;
          }
        }
        const chronic = countChronic > 0 ? sumChronic / countChronic : 0;
        acwr = chronic > 0 ? Math.round((acute / chronic) * 100) / 100 : null;
        break;
      }

      // Attendance rate for training events in last 4 weeks
      const teamEvents = trainingEvents.filter((e) => e.teamId === teamId);
      const attended = attendances.filter(
        (a) =>
          a.event.teamId === teamId &&
          (a.status === "CONFIRMED" || a.checkedIn)
      ).length;
      const attendanceRate =
        teamEvents.length > 0
          ? Math.round((attended / teamEvents.length) * 100)
          : null;

      return { teamId, teamName: m.team.name, avgRpe, attendanceRate, acwr };
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
