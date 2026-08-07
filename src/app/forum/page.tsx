import "server-only";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { dbConnect } from "@/lib/mongoose";
import { Thread } from "@/models/Thread";
import { CreateThreadForm } from "@/components/forum/CreateThreadForm";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import TeamSelector from "./team-selector";

interface PageProps {
  searchParams: Promise<{
    teamId?: string;
  }>;
}

export default async function ForumRouterPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const resolvedParams = await searchParams;
  const teamIdParam = resolvedParams.teamId;

  // 1. Obtener los equipos del usuario (con isCoach por equipo)
  const teams = await prisma.team.findMany({
    where: {
      members: { some: { userId: session.user.id } },
    },
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

  // 2. Sin equipos: fallback informativo
  if (teams.length === 0) {
    return (
      <div className="min-h-screen bg-background text-foreground pb-10">
        <DashboardHeader badgeLabel={null} />

        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <div className="text-6xl mb-6">💬</div>
          <h1 className="text-3xl font-heading font-extrabold uppercase tracking-tighter text-foreground">
            No tienes equipos todavía
          </h1>
          <p className="mt-2 text-xs font-mono uppercase tracking-widest font-bold text-muted-foreground">
            Debes unirte a un equipo o crear uno para poder participar en el Foro Táctico.
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

  // 3. Un solo equipo: redirect directo al foro del equipo
  if (teams.length === 1) {
    redirect(`/teams/${teams[0]!.id}/forum`);
  }

  // 4. Multi-equipo: página agregada con selector (?teamId=)
  if (!teamIdParam) {
    redirect(`/forum?teamId=${teams[0]!.id}`);
  }

  const selectedTeam = teams.find((t) => t.id === teamIdParam) || teams[0]!;
  const isCoach = selectedTeam.members[0]?.isCoach ?? false;

  await dbConnect();
  const threads = (await Thread.find({ teamId: selectedTeam.id })
    .sort({ updatedAt: -1 })
    .lean()) as any[];

  return (
    <div className="min-h-screen bg-background text-foreground pb-10">
      <DashboardHeader badgeLabel={isCoach ? "Cuerpo Técnico" : "Jugador"} />

      <main className="mx-auto max-w-4xl px-4 py-10 space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-5xl font-heading font-extrabold uppercase tracking-tighter">Tablón Táctico</h1>
            <p className="text-muted-foreground font-mono uppercase text-xs tracking-widest font-semibold mt-2">
              Debates y Feedback para {selectedTeam.name}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-card border border-border shadow-sm p-1">
              <TeamSelector teams={teams} selectedTeamId={selectedTeam.id} />
            </div>
            <Link
              href={`/teams/${selectedTeam.id}/forum`}
              className="rounded-none border border-border bg-card px-4 py-2.5 text-xs font-mono uppercase tracking-widest font-bold text-foreground hover:border-primary hover:text-primary transition-all"
            >
              Vista del Equipo
            </Link>
          </div>
        </div>

        <CreateThreadForm teamId={selectedTeam.id} />

        <div className="space-y-4">
          {threads.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
              <p className="text-muted-foreground font-mono italic">
                Aún no hay debates en este equipo. ¡Inicia uno!
              </p>
            </div>
          ) : (
            threads.map((thread) => (
              <Link
                key={thread._id.toString()}
                href={`/teams/${selectedTeam.id}/forum/${thread._id.toString()}`}
                className="block group"
              >
                <article className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary hover:shadow-md">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                    <h2 className="text-xl font-heading font-bold uppercase tracking-tight text-foreground group-hover:text-primary transition-colors">
                      {thread.title}
                    </h2>
                    <span className="text-xs font-mono font-bold text-muted-foreground">
                      {new Date(thread.createdAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground font-sans line-clamp-2 mb-4">{thread.content}</p>
                  <div className="flex items-center gap-3">
                    <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-foreground">
                      {thread.authorName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-mono uppercase tracking-widest font-bold text-foreground">
                      {thread.authorName}
                    </span>
                  </div>
                </article>
              </Link>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
