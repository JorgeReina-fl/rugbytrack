import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { LogoutButton } from "@/components/auth/LogoutButton";
import type { Metadata } from "next";
import type { RugbyPosition } from "@prisma/client";

interface PageProps {
  params: Promise<{ id: string }>;
}

const POSITION_LABELS: Record<RugbyPosition, string> = {
  PROP_LOOSEHEAD: "1 - Pilar Zurdo",
  HOOKER: "2 - Talonador",
  PROP_TIGHTHEAD: "3 - Pilar Derecho",
  LOCK: "4/5 - Segundo línea",
  FLANKER_BLINDSIDE: "6 - Ala Ciega",
  FLANKER_OPENSIDE: "7 - Ala Abierta",
  NUMBER_EIGHT: "8 - Octavo",
  SCRUM_HALF: "9 - Medio Mêlée",
  FLY_HALF: "10 - Apertura",
  CENTER_INSIDE: "12 - Centro Interior",
  CENTER_OUTSIDE: "13 - Centro Exterior",
  WING_LEFT: "11 - Ala Izquierda",
  WING_RIGHT: "14 - Ala Derecha",
  FULLBACK: "15 - Zaguero",
  REPLACEMENT: "Reserva",
};

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
        include: {
          user: { select: { id: true, name: true, image: true } },
        },
        orderBy: [{ isCoach: "desc" }, { jerseyNumber: "asc" }],
      },
    },
  });

  if (!team) notFound();

  const isCoach = membership.isCoach;
  const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/join/${team.inviteToken}`;

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
            <span className="bg-secondary px-3 py-1 text-xs font-mono font-bold uppercase tracking-widest text-foreground hidden sm:inline-block">
              {isCoach ? "Entrenador" : "Jugador"}
            </span>
            <div className="w-px h-4 bg-border hidden sm:block"></div>
            <LogoutButton />
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-4">
          <Link
            href="/dashboard"
            className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-all"
          >
            ← Dashboard
          </Link>
        </div>

        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-5xl font-heading font-extrabold tracking-tighter uppercase">{team.name}</h1>
            {team.description && (
              <p className="mt-2 text-sm font-mono text-muted-foreground">{team.description}</p>
            )}
          </div>
          <span className="bg-secondary border border-border px-3 py-1 text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">
            {team.members.length} miembros
          </span>
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

        <div className="border border-border bg-card shadow-sm overflow-hidden">
          <div className="border-b border-border bg-secondary px-6 py-4">
            <h2 className="font-mono font-bold text-sm uppercase tracking-widest text-foreground">Plantilla</h2>
          </div>
          <div className="divide-y divide-border">
            {team.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-4 px-6 py-4 hover:bg-secondary/40 transition-all"
              >
                <div className="flex h-10 w-10 items-center justify-center border border-border bg-secondary font-heading font-black text-sm text-foreground">
                  {member.jerseyNumber ?? "—"}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-foreground">
                    {member.user.name}
                    {member.isCoach && (
                      <span className="ml-2 bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-mono font-bold uppercase tracking-widest text-primary">
                        Entrenador
                      </span>
                    )}
                  </p>
                  <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mt-0.5">
                    {member.position
                      ? POSITION_LABELS[member.position]
                      : "Sin posición asignada"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
