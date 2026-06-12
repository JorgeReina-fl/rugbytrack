import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { LogoutButton } from "@/components/auth/LogoutButton";
import type { Metadata } from "next";
import SimilarPlayersClient from "./SimilarPlayersClient";

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
    title: `Jugadores Similares · ${team?.name ?? "Equipo"}`,
    description: "Búsqueda semántica de jugadores con perfiles similares usando pgvector y Gemini embeddings",
  };
}

export default async function SimilarPlayersPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id: teamId } = await params;

  const membership = await prisma.teamMember.findFirst({
    where: { userId: session.user.id, teamId },
  });
  if (!membership) notFound();

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { name: true },
  });
  if (!team) notFound();

  // Fetch all non-coach members with their embedding status
  const members = await prisma.teamMember.findMany({
    where: { teamId, isCoach: false },
    include: {
      user: {
        select: { id: true, name: true },
      },
    },
    orderBy: [{ jerseyNumber: "asc" }],
  });

  // Check which members already have embeddings
  const embeddedUserIds = await prisma.$queryRaw<Array<{ userId: string }>>`
    SELECT "userId" FROM "PlayerEmbedding" WHERE "teamId" = ${teamId}
  `;
  const embeddedSet = new Set(embeddedUserIds.map((r) => r.userId));

  const players = members.map((m) => ({
    userId: m.userId,
    name: m.user.name,
    position: m.position ?? null,
    jerseyNumber: m.jerseyNumber ?? null,
    hasEmbedding: embeddedSet.has(m.userId),
  }));

  const isCoach = membership.isCoach;

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
              {isCoach ? "Entrenador" : "Jugador"}
            </span>
            <div className="w-px h-4 bg-border hidden sm:block" />
            <LogoutButton />
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-4xl px-4 py-10">
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
          <span className="text-foreground">Similares</span>
        </div>

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">🔍</span>
            <h1 className="text-4xl font-heading font-extrabold tracking-tighter uppercase">
              Jugadores Similares
            </h1>
          </div>
          <p className="text-sm font-mono text-muted-foreground max-w-xl">
            Búsqueda semántica basada en perfiles de rendimiento — RPE, carga de
            trabajo, asistencia y posición. Potenciado por{" "}
            <strong>pgvector</strong> y{" "}
            <strong>Gemini text-embedding-004</strong>.
          </p>

          {/* Embedding coverage indicator */}
          <div className="mt-4 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary" />
              <span className="text-xs font-mono text-muted-foreground">
                {embeddedSet.size} / {players.length} jugadores con embedding
              </span>
            </div>
            {players.length > 0 && (
              <div className="flex-1 max-w-32 h-1 bg-border overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${
                      players.length > 0
                        ? (embeddedSet.size / players.length) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {players.length === 0 ? (
          <div className="border border-border bg-card p-10 text-center">
            <p className="text-sm font-mono text-muted-foreground">
              No hay jugadores en el equipo todavía.
            </p>
          </div>
        ) : (
          <SimilarPlayersClient
            teamId={teamId}
            teamName={team.name}
            players={players}
            isCoach={isCoach}
          />
        )}
      </div>
    </div>
  );
}
