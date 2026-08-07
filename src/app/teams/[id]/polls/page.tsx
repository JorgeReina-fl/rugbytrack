import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import LivePollClient from "@/components/polls/LivePollClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PollsPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;

  const membership = await prisma.teamMember.findFirst({
    where: { userId: session.user.id, teamId: id },
    include: { team: true },
  });

  if (!membership) {
    notFound();
  }

  const polls = await prisma.poll.findMany({
    where: { teamId: id },
    include: {
      options: {
        include: {
          _count: { select: { votes: true } },
        },
      },
      createdBy: {
        select: { name: true, image: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const isCoach = membership.isCoach;

  return (
    <div className="min-h-screen bg-background text-foreground pb-16">
      <DashboardHeader badgeLabel={isCoach ? "Entrenador" : "Jugador"} />

      <div className="mx-auto max-w-4xl px-4 py-10">
        {/* Breadcrumb */}
        <div className="mb-6 flex flex-wrap items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">
          <Link href="/dashboard" className="hover:text-primary transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <Link href="/teams" className="hover:text-primary transition-colors">
            Mis Equipos
          </Link>
          <span>/</span>
          <Link href={`/teams/${id}`} className="hover:text-primary transition-colors">
            {membership.team.name}
          </Link>
          <span>/</span>
          <span className="text-foreground">Encuestas</span>
        </div>

        {/* Back link */}
        <Link
          href={`/teams/${id}`}
          className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-all flex items-center gap-2"
        >
          ← Volver al Equipo
        </Link>

        {/* Header */}
        <div className="mt-6 mb-8">
          <h1 className="text-4xl md:text-5xl font-heading font-extrabold uppercase tracking-tighter">
            Encuestas
          </h1>
          <p className="mt-2 text-xs font-mono uppercase tracking-widest font-semibold text-muted-foreground">
            Vota y participa en las decisiones de {membership.team.name}
          </p>
        </div>

        <LivePollClient teamId={id} initialPolls={polls} isCoach={isCoach} />
      </div>
    </div>
  );
}
