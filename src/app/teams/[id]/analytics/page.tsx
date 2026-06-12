import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { LogoutButton } from "@/components/auth/LogoutButton";
import type { Metadata } from "next";
import AnalyticsClient from "./AnalyticsClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const team = await prisma.team.findUnique({
    where: { id },
    select: { name: true },
  });
  return {
    title: `Analytics & RPE · ${team?.name ?? "Equipo"}`,
    description: "Carga de trabajo, control de fatiga y ratios de sobreentrenamiento ACWR",
  };
}

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

export default async function AnalyticsPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id: teamId } = await params;

  // Verify membership and coach role
  const membership = await prisma.teamMember.findUnique({
    where: {
      userId_teamId: {
        userId: session.user.id,
        teamId,
      },
    },
  });

  if (!membership || !membership.isCoach) {
    notFound();
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { name: true },
  });
  if (!team) notFound();

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

  // Calculate workloads for default 8 weeks (fetch 8 + 4 = 12 weeks for chronic)
  const weeksCount = 8;
  const weeksToFetch = weeksCount + 4;
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

  // Heatmap weeks
  const activeWeeks = uniqueWeeks.slice(-weeksCount);

  const playersData = teamPlayers.map((member) => {
    const u = member.user;
    const playerMap = dataMap[u.id] || {};

    const allWeeksData = uniqueWeeks.map((week) => {
      const stats = playerMap[week] || { workload: 0, rpeSum: 0, count: 0 };
      return {
        week,
        workload: stats.workload,
        avgRpe: stats.count > 0 ? Math.round((stats.rpeSum / stats.count) * 10) / 10 : 0,
      };
    });

    const weeklyData = activeWeeks.map((week) => {
      const indexInAll = uniqueWeeks.indexOf(week);
      const currentWeekStats = allWeeksData[indexInAll] || { workload: 0, avgRpe: 0 };
      const acute = currentWeekStats.workload;

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

  const initialData = {
    weeks: activeWeeks,
    players: playersData,
    teamWeeklyAvgLoad,
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-16">
      {/* Nav */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link
            href="/dashboard"
            className="text-xl font-heading font-extrabold tracking-tighter uppercase"
          >
            Rugby<span className="text-primary">Track</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm font-mono uppercase tracking-widest font-semibold text-muted-foreground hidden sm:inline">
              {session.user.name}
            </span>
            <span className="bg-secondary px-3 py-1 text-xs font-mono font-bold uppercase tracking-widest text-foreground hidden sm:inline-block">
              Entrenador
            </span>
            <div className="w-px h-4 bg-border hidden sm:block" />
            <LogoutButton />
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-4 py-10">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">
          <Link href="/dashboard" className="hover:text-primary transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <Link href={`/teams/${teamId}`} className="hover:text-primary transition-colors">
            {team.name}
          </Link>
          <span>/</span>
          <span className="text-foreground">Analytics</span>
        </div>

        <AnalyticsClient
          teamId={teamId}
          teamName={team.name}
          initialData={initialData}
        />
      </div>
    </div>
  );
}
