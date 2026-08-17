import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { TeamRosterClient } from "@/components/teams/TeamRosterClient";
import type { Metadata } from "next";
import { CheckSquare, Lightbulb, ChartBar, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const team = await prisma.team.findUnique({
    where: { id },
    select: { name: true },
  });
  return { title: team?.name ?? "Equipo" };
}

export default async function TeamDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const membership = await prisma.teamMember.findFirst({
    where: { userId: session.user.id, teamId: id },
  });

  if (!membership) notFound();

  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      members: {
        where: { leftAt: null },
        include: {
          user: { select: { id: true, name: true, image: true } },
        },
        orderBy: [{ isCoach: "desc" }, { jerseyNumber: "asc" }],
      },
    },
  });

  if (!team) notFound();

  const isCoach = membership.isCoach;
  const activeCoachCount = team.members.filter((m) => m.isCoach).length;
  const isOnlyCoach = isCoach && activeCoachCount <= 1;
  const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/join/${team.inviteToken}`;

  const rosterMembers = team.members.map((m) => ({
    memberId: m.id,
    userId: m.user.id,
    name: m.user.name ?? "Sin nombre",
    jerseyNumber: m.jerseyNumber,
    position: m.position,
    isCoach: m.isCoach,
  }));

  return (
    <div className="min-h-screen bg-background text-foreground pb-10">
      <DashboardHeader badgeLabel={isCoach ? "Entrenador" : "Jugador"} />

      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-4">
          <Link
            href="/teams"
            className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-all"
          >
            ← Mis Equipos
          </Link>
        </div>

        <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-5xl font-heading font-extrabold tracking-tighter uppercase">{team.name}</h1>
            {team.description && (
              <p className="mt-2 text-sm font-mono text-muted-foreground">{team.description}</p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <span className="bg-secondary border border-border px-3 py-1 text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">
              {team.members.length} miembros
            </span>
            <Link
              href={`/teams/${team.id}/similar`}
              className="border border-primary/40 bg-primary/5 px-4 py-1.5 text-xs font-mono font-bold uppercase tracking-widest text-primary hover:bg-primary/10 transition-all"
            >
              <MagnifyingGlass size={24} weight="regular" className="inline mr-2" /> Jugadores similares
            </Link>
            <Link
              href={`/teams/${team.id}/polls`}
              className="border border-primary/40 bg-primary/5 px-4 py-1.5 text-xs font-mono font-bold uppercase tracking-widest text-primary hover:bg-primary/10 transition-all"
            >
              <CheckSquare size={24} weight="regular" className="inline mr-2" /> Encuestas
            </Link>
            <Link
              href={`/teams/${team.id}/proposals`}
              className="border border-primary/40 bg-primary/5 px-4 py-1.5 text-xs font-mono font-bold uppercase tracking-widest text-primary hover:bg-primary/10 transition-all"
            >
              <Lightbulb size={24} weight="regular" className="inline mr-2" /> Propuestas
            </Link>

            {isCoach && (
              <Link
                href={`/teams/${team.id}/analytics`}
                className="border border-primary/40 bg-primary/5 px-4 py-1.5 text-xs font-mono font-bold uppercase tracking-widest text-primary hover:bg-primary/10 transition-all"
              >
                <ChartBar size={24} weight="regular" className="inline mr-2" /> Analytics
              </Link>
            )}
          </div>
        </div>

        {isCoach && (
          <div className="mb-8 border border-primary/30 bg-primary/5 p-5">
            <p className="mb-3 text-xs font-mono font-bold uppercase tracking-widest text-primary">
              🔗 Link de invitación para jugadores
            </p>
            <div className="flex items-center gap-3">
              <code
                id="invite-link"
                className="flex-1 border border-border bg-card px-3 py-2 text-sm font-mono text-foreground break-all"
              >
                {inviteLink}
              </code>
            </div>
            <p className="mt-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Comparte este link con tus jugadores para que se unan al equipo
            </p>
          </div>
        )}

        <TeamRosterClient
          teamId={team.id}
          currentUserId={session.user.id}
          isCoach={isCoach}
          isOnlyCoach={isOnlyCoach}
          members={rosterMembers}
        />
      </div>
    </div>
  );
}
