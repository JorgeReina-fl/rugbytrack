import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveMembership } from "@/lib/membership";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import type { Metadata } from "next";
import AnalyticsClient from "./AnalyticsClient";
import { isoWeekKeyInTz } from "@/lib/week";
import { computeAcwr, lastCompleteWeekKey, weekKeysEndingAt, weekRangeLabel, weeklyLoads } from "@/lib/acwr";

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

export default async function AnalyticsPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id: teamId } = await params;

  // Verify membership and coach role
  const membership = await requireActiveMembership(teamId, session.user.id);
  if (!membership.isCoach) notFound();

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { name: true, timezone: true },
  });
  if (!team) notFound();

  // Get all players (isCoach: false)
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

  // 8 semanas completas (la última completa es la del ACWR) + 4 para la crónica
  const weeksCount = 8;
  const acwrWeek = lastCompleteWeekKey(new Date(), team.timezone);
  const startDateThreshold = new Date();
  startDateThreshold.setDate(startDateThreshold.getDate() - (weeksCount + 5) * 7);

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
    const weekLabel = isoWeekKeyInTz(entry.event.startDate, team.timezone);
    const userMap = (dataMap[entry.userId] ??= {});
    const weekData = (userMap[weekLabel] ??= { rpeSum: 0, count: 0 });
    weekData.rpeSum += entry.rpe;
    weekData.count += 1;
    (loadsByUser[entry.userId] ??= []).push({ startDate: entry.event.startDate, workload: entry.workload });
  }

  // Heatmap weeks: las últimas N semanas completas (aritmética ISO exacta)
  const activeWeeks = weekKeysEndingAt(acwrWeek, weeksCount);

  const playersData = teamPlayers.map((member) => {
    const u = member.user;
    const playerMap = dataMap[u.id] || {};
    const loads = weeklyLoads(loadsByUser[u.id] ?? [], team.timezone);

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

    // La última semana completa, con o sin carga
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
    acwrWeekLabel: weekRangeLabel(acwrWeek),
    players: playersData,
    teamWeeklyAvgLoad,
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-16">
      <DashboardHeader badgeLabel="Entrenador" />

      <div className="mx-auto max-w-6xl px-4 py-10">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">
          <Link href="/dashboard" className="hover:text-primary transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <Link href="/teams" className="hover:text-primary transition-colors">
            Mis Equipos
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
