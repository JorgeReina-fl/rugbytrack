import "server-only";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { EventForm } from "./event-form";
import { LogoutButton } from "@/components/auth/LogoutButton";

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

  // Valida que el usuario sea COACH en el equipo
  const membership = await prisma.teamMember.findFirst({
    where: { userId: session.user.id, teamId, isCoach: true },
  });

  if (!membership) {
    redirect("/events");
  }

  // Obtiene los miembros del equipo para la lista de convocables
  const members = await prisma.teamMember.findMany({
    where: { teamId },
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
      <nav className="border-b border-border bg-background/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link href="/dashboard" className="text-xl font-heading font-extrabold tracking-tighter uppercase">
            Rugby<span className="text-primary">Track</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm font-mono uppercase tracking-widest font-semibold text-muted-foreground">
              {session.user.name}
            </span>
            <span className="bg-primary/10 px-3 py-1 text-xs font-mono font-bold uppercase tracking-widest text-primary hidden sm:inline-block">
              Entrenador
            </span>
            <div className="w-px h-4 bg-border hidden sm:block"></div>
            <LogoutButton />
          </div>
        </div>
      </nav>

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
