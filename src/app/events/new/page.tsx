import "server-only";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { EventForm } from "./event-form";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";

interface PageProps {
  searchParams: Promise<{
    teamId?: string;
  }>;
}

export default async function NewEventPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const resolvedParams = await searchParams;
  const teamId = resolvedParams.teamId;

  if (!teamId) {
    redirect("/events");
  }

  // Valida que el usuario sea COACH activo en el equipo
  const membership = await prisma.teamMember.findFirst({
    where: { userId: session.user.id, teamId, isCoach: true, leftAt: null },
  });

  if (!membership) {
    redirect("/events");
  }

  // Obtiene los miembros activos del equipo para la lista de convocables
  const members = await prisma.teamMember.findMany({
    where: { teamId, leftAt: null },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
    orderBy: {
      user: {
        name: "asc",
      },
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground pb-10">
      <DashboardHeader badgeLabel="Entrenador" />

      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-10 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-5xl font-heading font-extrabold tracking-tighter uppercase">Crear Evento</h1>
            <p className="mt-2 text-xs font-mono uppercase tracking-widest font-bold text-muted-foreground">
              Programa un entrenamiento, partido o evento y convoca a tus jugadores.
            </p>
          </div>
          <Link
            href={`/events?teamId=${teamId}`}
            className="border border-border bg-card px-4 py-2.5 text-xs font-mono uppercase tracking-widest font-bold text-muted-foreground hover:text-foreground hover:border-foreground transition-all"
          >
            Cancelar
          </Link>
        </div>

        <EventForm teamId={teamId} members={members} />
      </main>
    </div>
  );
}
