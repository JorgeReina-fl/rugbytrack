import "server-only";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { labelFor } from "@/lib/lineup";
import { getActiveMembership } from "@/lib/membership";
import { formatInTz, safeTz } from "@/lib/datetime";
import { RsvpControl } from "./rsvp-control";
import { RugbyPosition } from "@prisma/client";
import { canSubmitRpe, eventEnd, isRsvpOpen } from "@/lib/attendance";
import { playerRpeUi, rpeWindow } from "@/lib/rpe-window";
import { hasCurrentConsent } from "@/lib/health-consent";
import { DiscomfortSection } from "@/components/event/DiscomfortSection";
import { CoachDiscomfortList } from "@/components/event/CoachDiscomfortList";
import { getEventDiscomforts } from "@/lib/discomfort-coach";
import { TAKEN_COUNT, isListTakenFromCount } from "@/lib/attendance-taken";
import { RpeForm } from "@/components/training/RpeForm";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { NotifyButton } from "@/components/event/NotifyButton";
import { LineupSheet } from "@/components/event/LineupSheet";
import { Gear } from "@phosphor-icons/react/dist/ssr";

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
      proposal: {
        select: { id: true, title: true },
      },
      team: { select: { timezone: true } },
      ...TAKEN_COUNT,
    },
  });

  if (!event) {
    redirect("/events");
  }

  // Valida membresía y RPE (en paralelo)
  const [activeMembership, rpeEntry] = await Promise.all([
    getActiveMembership(event.teamId, session.user.id),
    prisma.rpeEntry.findFirst({
      where: { userId: session.user.id, eventId: event.id },
    }),
  ]);

  if (!activeMembership) {
    redirect("/events");
  }

  const isCoach = activeMembership.isCoach;
  const tz = safeTz(event.team.timezone);

  // Molestias (dato de salud): el coach activo ve todas las del evento; el jugador activo, solo las suyas
  const coachDiscomforts =
    activeMembership?.isCoach ? await getEventDiscomforts(event.id, event.teamId, tz) : null;
  const isActivePlayer = activeMembership !== null && !activeMembership.isCoach;
  const discomfortOpen = isActivePlayer && eventEnd(event) >= new Date();
  const [healthUser, myDiscomforts] = isActivePlayer
    ? await Promise.all([
        prisma.user.findUnique({
          where: { id: session.user.id },
          select: { healthConsentAt: true, healthConsentVersion: true },
        }),
        prisma.discomfort.findMany({
          where: { eventId: event.id, userId: session.user.id },
          select: { id: true, bodyArea: true, intensity: true, note: true },
          orderBy: { createdAt: "desc" },
        }),
      ])
    : [null, []];
  const userAttendance = event.attendances[0] ?? null;

  const now = new Date();
  const canRpe =
    activeMembership !== null &&
    !activeMembership.isCoach &&
    userAttendance !== null &&
    canSubmitRpe(userAttendance, isListTakenFromCount(event));
  const rpeWin = rpeWindow(event, now);
  const rpeUi = canRpe ? playerRpeUi(rpeWin.state, rpeEntry !== null) : "none";
  const rpeClosesAtLabel = formatInTz(rpeWin.closesAt, tz, "d 'de' MMMM 'a las' HH:mm 'hs'");
  const rsvpClosed = !isRsvpOpen(event, now);

  // Separa titulares de suplentes
  const starters = event.callups.filter((c) => c.isStarter);
  const replacements = event.callups.filter((c) => !c.isStarter);

  const formattedDate = formatInTz(event.startDate, tz, "EEEE, d 'de' MMMM 'a las' HH:mm 'hs'");

  const formattedDeadline = event.rsvpDeadline
    ? formatInTz(event.rsvpDeadline, tz, "d 'de' MMMM 'a las' HH:mm 'hs'")
    : null;

  const canEditLineup =
    isCoach && (event.type === "MATCH" || event.type === "TOURNAMENT") && new Date(event.startDate) > now;

  const eventTypeLabel = event.type === "TRAINING" ? "Entrenamiento" : event.type === "MATCH" ? "Partido" : "Evento";

  return (
    <div className="min-h-screen bg-background text-foreground pb-10">
      <DashboardHeader badgeLabel={isCoach ? "Entrenador" : "Jugador"} />

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

              {event.proposal && (
                <div className="mt-4 border-t border-border pt-4">
                  <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                    Generado desde la propuesta:{" "}
                    <Link
                      href={`/teams/${event.teamId}/proposals`}
                      className="font-bold text-primary hover:underline"
                    >
                      {event.proposal.title}
                    </Link>
                  </p>
                </div>
              )}
            </div>

            {coachDiscomforts && <CoachDiscomfortList eventId={event.id} items={coachDiscomforts} />}

            {/* Lista de convocados */}
            <div className="border border-border bg-card p-8 shadow-sm space-y-6">
              <h2 className="text-2xl font-heading font-extrabold tracking-tighter uppercase">Convocados ({event.callups.length})</h2>

              {event.format ? (
                <LineupSheet
                  format={event.format}
                  currentUserId={session.user.id}
                  callups={event.callups.map((c) => ({ userId: c.userId, name: c.user.name, shirtNumber: c.shirtNumber }))}
                />
              ) : (
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
                            {event.format && c.shirtNumber != null ? labelFor(event.format, c.shirtNumber) : c.position ? positionLabels[c.position] : "Sin posición"}
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
              )}
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

                <RsvpControl eventId={event.id} initialStatus={userAttendance.status} closed={rsvpClosed} />
              </div>
            )}

            {/* Panel de RPE para el jugador */}
            {(rpeUi === "form" || rpeUi === "closed") && (
              <div className="border border-border bg-card p-6 shadow-sm space-y-4">
                <h3 className="text-xl font-heading font-extrabold tracking-tighter uppercase">Registro RPE</h3>
                {rpeUi === "form" && (
                  <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                    Registra el nivel de esfuerzo percibido y la duración de esta sesión.
                  </p>
                )}
                <RpeForm eventId={event.id} closesAtLabel={rpeClosesAtLabel} closed={rpeUi === "closed"} />
              </div>
            )}

            {/* Molestias del jugador */}
            {isActivePlayer && (discomfortOpen || myDiscomforts.length > 0) && (
              <DiscomfortSection
                eventId={event.id}
                hasConsent={hasCurrentConsent(healthUser)}
                open={discomfortOpen}
                items={myDiscomforts}
              />
            )}

            {/* Panel de Entrenador */}
            {isCoach && (
              <div className="border border-primary/30 bg-primary/5 p-6 shadow-sm space-y-4">
                <h3 className="text-xl font-heading font-extrabold tracking-tighter uppercase flex items-center gap-2">
                  <span><Gear size={24} weight="regular" className="inline mr-2" /></span> Panel de Control
                </h3>
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest leading-relaxed">
                  Como entrenador, puedes pasar lista manualmente.
                </p>
                <div className="flex flex-col gap-3">
                  <Link
                    href={`/events/${event.id}/attendance`}
                    className="flex justify-center bg-primary px-4 py-3 text-center text-xs font-mono uppercase tracking-widest font-bold text-primary-foreground hover:opacity-90 transition-all shadow-md"
                  >
                    Panel de Asistencia
                  </Link>
                  {canEditLineup && (
                    <Link
                      href={`/events/${event.id}/lineup`}
                      className="flex justify-center border border-primary px-4 py-3 text-center text-xs font-mono uppercase tracking-widest font-bold text-primary hover:bg-primary/10 transition-all"
                    >
                      Editar alineación
                    </Link>
                  )}
                  <NotifyButton eventId={event.id} />
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
