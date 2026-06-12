import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/auth/LogoutButton";

export const metadata: Metadata = {
  title: "Mis equipos",
};

interface Team {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  inviteToken: string;
  _count: { members: number };
  members: { isCoach: boolean; position: string | null }[];
}

async function getTeams(userId: string): Promise<Team[]> {
  const teams = await prisma.team.findMany({
    where: {
      members: {
        some: { userId },
      },
    },
    include: {
      _count: {
        select: { members: true },
      },
      members: {
        where: { userId },
        select: { isCoach: true, position: true },
      },
    },
  });
  return teams;
}

export default async function TeamsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const teams = await getTeams(session.user.id);

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
            <div className="w-px h-4 bg-border hidden sm:block"></div>
            <LogoutButton />
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8">
          <Link href="/dashboard" className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-all flex items-center gap-2">
            ← Dashboard
          </Link>
        </div>

        <div className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-5xl font-heading font-extrabold uppercase tracking-tighter">Mis equipos</h1>
          <Link
            href="/teams/new"
            id="create-team-link"
            className="rounded-xl bg-primary px-6 py-3 text-sm font-mono uppercase tracking-widest font-bold text-primary-foreground hover:opacity-90 transition-all shadow-md text-center"
          >
            + Crear equipo
          </Link>
        </div>

        {teams.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-16 text-center shadow-sm">
            <div className="mb-6 text-5xl">🏉</div>
            <p className="text-muted-foreground font-mono uppercase tracking-widest font-bold">Aún no perteneces a ningún equipo</p>
            <div className="mt-8 flex justify-center gap-3">
              <Link
                href="/teams/new"
                className="rounded-xl bg-primary px-6 py-3 text-sm font-mono uppercase tracking-widest font-bold text-primary-foreground hover:opacity-90 transition-all shadow-md"
              >
                Crear equipo
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {teams.map((team) => {
              const membership = team.members[0];
              return (
                <Link
                  key={team.id}
                  href={`/teams/${team.id}`}
                  id={`team-card-${team.id}`}
                  className="group rounded-2xl border border-border bg-card p-8 transition-all hover:border-primary shadow-sm hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-14 w-14 items-center justify-center bg-secondary text-2xl">
                      🏉
                    </div>
                    {membership?.isCoach && (
                      <span className="bg-primary/10 px-3 py-1 text-xs font-mono font-bold uppercase tracking-widest text-primary">
                        Entrenador
                      </span>
                    )}
                  </div>
                  <h2 className="mt-6 text-2xl font-heading font-extrabold uppercase tracking-tight text-foreground group-hover:text-primary transition-colors">
                    {team.name}
                  </h2>
                  <p className="mt-2 text-xs font-mono uppercase tracking-widest font-bold text-muted-foreground">
                    {team._count.members} miembros
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
