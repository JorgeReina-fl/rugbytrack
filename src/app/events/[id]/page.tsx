import "server-only";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { RsvpControl } from "./rsvp-control";
import { RugbyPosition } from "@prisma/client";
import { RpeForm } from "@/components/training/RpeForm";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { NotifyButton } from "@/components/event/NotifyButton";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

const positionLabels: Record<RugbyPosition, string> = {
  PROP_LOOSEHEAD: "Pilar Izquierdo (1)",
  HOOKER: "Talonador (2)",
  PROP_TIGHTHEAD: "Pilar Derecho (3)",
  LOCK: "Segunda Línea (4/5)",
  FLANKER_BLINDSIDE: "Flanker Ciego (6)",
  FLANKER_OPENSIDE: "Flanker Abierto (7)",
  NUMBER_EIGHT: "Número 8 (8)",
  SCRUM_HALF: "Medio Melé (9)",
  FLY_HALF: "Apertura (10)",
  CENTER_INSIDE: "Primer Centro (12)",
  CENTER_OUTSIDE: "Segundo Centro (13)",
  WING_LEFT: "Ala Izquierdo (11)",
  WING_RIGHT: "Ala Derecho (14)",
  FULLBACK: "Zaguero (15)",
  REPLACEMENT: "Suplente",
};

export default async function EventDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  // Carga el evento
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      callups: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      },
      attendances: {
        where: { userId: session.user.id },
      },
    },
  });

  if (!event) {
    redirect("/events");
  }

  // Valida membresía y RPE (en paralelo)
  const [membership, rpeEntry] = await Promise.all([
    prisma.teamMember.findFirst({
      where: { userId: session.user.id, teamId: event.teamId },
      select: { isCoach: true },
    }),
    prisma.rpeEntry.findFirst({
      where: { userId: session.user.id, eventId: event.id },
    }),
  ]);

  if (!membership) {
    redirect("/events");
  }

  const isCoach = membership.isCoach;
  const userAttendance = event.attendances[0] ?? null;

  const showRpeForm =
    session.user.role === "PLAYER" &&
    new Date(event.startDate) <= new Date() &&
    (userAttendance?.status === "CONFIRMED" || userAttendance?.checkedIn === true) &&
    !rpeEntry;

  // Separa titulares de suplentes
  const starters = event.callups.filter((c) => c.isStarter);
  const replacements = event.callups.filter((c) => !c.isStarter);

  const formattedDate = format(new Date(event.startDate), "EEEE, d 'de' MMMM 'a las' HH:mm 'hs'", {
    locale: es,
  });

  const formattedDeadline = event.rsvpDeadline
    ? format(new Date(event.rsvpDeadline), "d 'de' MMMM 'a las' HH:mm 'hs'", { locale: es })
    : null;

  const eventTypeLabel = event.type === "TRAINING" ? "Entrenamiento" : event.type === "MATCH" ? "Partido" : "Evento";

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

      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-6">
          <Link
            href={`/events?teamId=${event.teamId}`}
            className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-all"
          >
            ← Volver al Calendario
          </Link>
        </div>

        {/* Detalles del evento */}
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="border border-border bg-card p-8 shadow-sm">
              <span className="bg-primary/10 px-3 py-1 text-xs font-mono font-bold text-primary uppercase tracking-widest border border-primary/20">
                {eventTypeLabel}
              </span>
              <h1 className="text-4xl font-heading font-extrabold tracking-tighter uppercase mt-4">{event.title}</h1>
              <p className="mt-2 text-muted-foreground text-sm font-mono capitalize">{formattedDate}</p>

              {event.location && (
                <div className="mt-4 flex items-center gap-2 text-sm text-foreground font-mono">
                  <span>📍</span> {event.location}
                </div>
              )}

              {event.description && (
                <div className="mt-6 border-t border-border pt-6">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground mb-2">Indicaciones</h3>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                    {event.description}
                  </p>
                </div>
              )}
            </div>

            {/* Lista de convocados */}
            <div className="border border-border bg-card p-8 shadow-sm space-y-6">
              <h2 className="text-2xl font-heading font-extrabold tracking-tighter uppercase">Convocados ({event.callups.length})</h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-2 mb-3">
                    Titulares
                  </h3>
                  {starters.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic font-mono">No hay titulares asignados</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {starters.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between border border-border bg-card p-3"
                        >
                          <span className="font-semibold text-sm text-foreground">{c.user.name}</span>
                          <span className="bg-secondary px-2 py-1 text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest">
                            {c.position ? positionLabels[c.position] : "Sin posición"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-2 mb-3">
                    Suplentes
                  </h3>
                  {replacements.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic font-mono">No hay suplentes convocados</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {replacements.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between border border-border bg-card p-3"
                        >
                          <span className="font-semibold text-sm text-foreground">{c.user.name}</span>
                          <span className="bg-secondary px-2 py-1 text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest">
                            Suplente
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Lateral: RSVP & Panel Entrenador */}
          <div className="space-y-6">
            {/* Panel de RSVP para el jugador */}
            {userAttendance && (
              <div className="border border-border bg-card p-6 shadow-sm space-y-4">
                <h3 className="text-xl font-heading font-extrabold tracking-tighter uppercase">Tu Asistencia</h3>

                {formattedDeadline && (
                  <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                    Responder antes del: <span className="font-bold text-foreground">{formattedDeadline}</span>
                  </p>
                )}

                <RsvpControl eventId={event.id} initialStatus={userAttendance.status} />
              </div>
            )}

            {/* Panel de RPE para el jugador */}
            {showRpeForm && (
              <div className="border border-border bg-card p-6 shadow-sm space-y-4">
                <h3 className="text-xl font-heading font-extrabold tracking-tighter uppercase">Registro RPE</h3>
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                  Registra el nivel de esfuerzo percibido y la duración de esta sesión.
                </p>
                <RpeForm eventId={event.id} />
              </div>
            )}

            {/* Panel de Entrenador */}
            {isCoach && (
              <div className="border border-primary/30 bg-primary/5 p-6 shadow-sm space-y-4">
                <h3 className="text-xl font-heading font-extrabold tracking-tighter uppercase flex items-center gap-2">
                  <span>⚙️</span> Panel de Control
                </h3>
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest leading-relaxed">
                  Como entrenador, puedes abrir la sesión de asistencia interactiva o pasar lista manualmente.
                </p>
                <div className="flex flex-col gap-3">
                  <Link
                    href={`/events/${event.id}/live`}
                    className="flex justify-center bg-primary px-4 py-3 text-center text-xs font-mono uppercase tracking-widest font-bold text-primary-foreground hover:opacity-90 transition-all shadow-md"
                  >
                    🔴 Dashboard Live
                  </Link>
                  <Link
                    href={`/events/${event.id}/attendance`}
                    className="flex justify-center border border-primary/40 bg-primary/5 px-4 py-3 text-center text-xs font-mono uppercase tracking-widest font-bold text-primary hover:bg-primary/10 transition-all"
                  >
                    Asistencia en Tiempo Real
                  </Link>
                  <NotifyButton eventId={event.id} />
                </div>
              </div>
            )}

            {/* Live link para jugadores */}
            {!isCoach && (
              <div className="border border-border bg-card p-5 shadow-sm">
                <Link
                  href={`/events/${event.id}/live`}
                  className="flex items-center justify-center gap-2 border border-primary/30 bg-primary/5 px-4 py-3 text-xs font-mono font-bold uppercase tracking-widest text-primary hover:bg-primary/10 transition-all"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  Ver asistencia en vivo
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
