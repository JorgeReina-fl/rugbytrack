import "server-only";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import TeamSelector from "./team-selector";
import LivePollClient from "@/components/polls/LivePollClient";

interface PageProps {
  searchParams: Promise<{ teamId?: string }>;
}

export default async function PollsRouterPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const resolvedParams = await searchParams;
  const teamIdParam = resolvedParams.teamId;

  const teams = await prisma.team.findMany({
    where: { members: { some: { userId: session.user.id } } },
    select: {
      id: true,
      name: true,
      members: {
        where: { userId: session.user.id },
        select: { isCoach: true },
      },
    },
    orderBy: { name: "asc" },
  });

  if (teams.length === 0) {
    return (
      <div className="min-h-screen bg-background text-foreground pb-10">
        <DashboardHeader badgeLabel={null} />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <div className="text-6xl mb-6">🗳️</div>
          <h1 className="text-3xl font-heading font-extrabold uppercase tracking-tighter text-foreground">
            No tienes equipos todavía
          </h1>
          <p className="mt-2 text-xs font-mono uppercase tracking-widest font-bold text-muted-foreground">
            Debes unirte a un equipo o crear uno para poder ver las encuestas.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              href="/teams"
              className="rounded-none bg-primary px-6 py-3 text-sm font-mono uppercase tracking-widest font-bold text-primary-foreground hover:opacity-90 transition-all shadow-md"
            >
              IR A MIS EQUIPOS
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (teams.length === 1) {
    redirect(`/teams/${teams[0]!.id}/polls`);
  }

  if (!teamIdParam) {
    redirect(`/polls?teamId=${teams[0]!.id}`);
  }

  const selectedTeam = teams.find((t) => t.id === teamIdParam) || teams[0]!;
  const isCoach = selectedTeam.members[0]?.isCoach ?? false;

  const polls = await prisma.poll.findMany({
    where: { teamId: selectedTeam.id },
    include: {
      options: {
        include: { _count: { select: { votes: true } } },
      },
      createdBy: { select: { name: true, image: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-background text-foreground pb-10">
      <DashboardHeader badgeLabel={isCoach ? "Entrenador" : "Jugador"} />

      <main className="mx-auto max-w-4xl px-4 py-10 space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-5xl font-heading font-extrabold uppercase tracking-tighter">Encuestas</h1>
            <p className="text-muted-foreground font-mono uppercase text-xs tracking-widest font-semibold mt-2">
              Decisiones y votaciones de {selectedTeam.name}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-card border border-border shadow-sm p-1">
              <TeamSelector teams={teams} selectedTeamId={selectedTeam.id} />
            </div>
            <Link
              href={`/teams/${selectedTeam.id}/polls`}
              className="rounded-none border border-border bg-card px-4 py-2.5 text-xs font-mono uppercase tracking-widest font-bold text-foreground hover:border-primary hover:text-primary transition-all"
            >
              Vista del Equipo
            </Link>
          </div>
        </div>

        <LivePollClient teamId={selectedTeam.id} initialPolls={polls} isCoach={isCoach} />
      </main>
    </div>
  );
}
