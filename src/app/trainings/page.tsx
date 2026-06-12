import "server-only";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import TeamSelector from "./team-selector";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { RpeForm } from "@/components/training/RpeForm";
import { WorkloadChart } from "@/components/training/WorkloadChart";

interface PageProps {
  searchParams: Promise<{
    teamId?: string;
    eventId?: string;
  }>;
}

export default async function TrainingsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const resolvedParams = await searchParams;
  let teamIdParam = resolvedParams.teamId;
  const eventIdParam = resolvedParams.eventId;

  // 1. Obtener equipos del usuario
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
  });

  if (teams.length === 0) {
    return (
      <div className="min-h-screen bg-background text-foreground pb-10">
        <nav className="border-b border-border bg-background/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
            <Link href="/dashboard" className="text-xl font-heading font-extrabold tracking-tighter uppercase">
              Rugby<span className="text-primary">Track</span>
            </Link>
            <div className="flex items-center gap-4">
              <LogoutButton />
            </div>
          </div>
        </nav>
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <div className="text-6xl mb-6">🏉</div>
          <h1 className="text-3xl font-heading font-extrabold uppercase tracking-tighter text-foreground">No tienes equipos todavía</h1>
          <p className="mt-2 text-xs font-mono uppercase tracking-widest font-bold text-muted-foreground">
            Primero debes crear un equipo o unirte a uno existente para ver los entrenamientos.
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

  // Si no hay teamId, redirigir al primero
  if (!teamIdParam) {
    const defaultTeam = teams[0];
    if (defaultTeam) {
      redirect(`/trainings?teamId=${defaultTeam.id}`);
    }
  }

  const selectedTeam = teams.find((t) => t.id === teamIdParam) || teams[0];
  if (!selectedTeam) {
    redirect("/dashboard");
  }

  const isCoach = selectedTeam.members[0]?.isCoach ?? false;

  // 2. Obtener los entrenamientos del equipo
  const events = await prisma.event.findMany({
    where: {
      teamId: selectedTeam.id,
      type: "TRAINING",
    },
    include: {
      attendances: {
        where: { userId: session.user.id },
        select: { status: true, checkedIn: true },
      },
      rpeEntries: {
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: { startDate: "desc" },
  });

  // Evento seleccionado
  const selectedEvent = eventIdParam ? events.find((e) => e.id === eventIdParam) : events[0];

  // Datos específicos del RPE para el evento seleccionado si es Jugador
  let playerRpeEntry = null;
  if (selectedEvent && !isCoach) {
    playerRpeEntry = await prisma.rpeEntry.findUnique({
      where: {
        eventId_userId: {
          eventId: selectedEvent.id,
          userId: session.user.id,
        },
      },
    });
  }

  // Permiso para rellenar RPE
  const userAttendance = selectedEvent?.attendances[0] ?? null;
  const showRpeForm =
    selectedEvent &&
    !isCoach &&
    new Date(selectedEvent.startDate) <= new Date() &&
    (userAttendance?.status === "CONFIRMED" || userAttendance?.checkedIn === true) &&
    !playerRpeEntry;

  // Estadísticas del entrenamiento para el entrenador
  const coachRpeEntries = selectedEvent?.rpeEntries ?? [];
  const avgRpe =
    coachRpeEntries.length > 0
      ? (coachRpeEntries.reduce((acc, curr) => acc + curr.rpe, 0) / coachRpeEntries.length).toFixed(1)
      : null;
  const avgWorkload =
    coachRpeEntries.length > 0
      ? (coachRpeEntries.reduce((acc, curr) => acc + curr.workload, 0) / coachRpeEntries.length).toFixed(0)
      : null;

  // Datos para el gráfico de carga del equipo (últimos 10 entrenos)
  const chartData = events
    .slice(0, 10)
    .reverse()
    .map((e) => {
      const entries = e.rpeEntries;
      const avgWL = entries.length > 0 ? entries.reduce((acc, curr) => acc + curr.workload, 0) / entries.length : 0;
      return {
        name: format(new Date(e.startDate), "dd/MM"),
        avgWorkload: Math.round(avgWL),
      };
    })
    .filter((d) => d.avgWorkload > 0);

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
            <span className="rounded-none bg-secondary px-3 py-1 text-xs font-mono font-bold uppercase tracking-widest text-foreground hidden sm:inline-block border border-border">
              {isCoach ? "Entrenador" : "Jugador"}
            </span>
            <div className="w-px h-4 bg-border hidden sm:block"></div>
            <LogoutButton />
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-10">
        {/* Encabezado y Selector */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-5xl font-heading font-extrabold uppercase tracking-tighter">
              REGISTRO DE ENTRENOS
            </h1>
            <p className="mt-2 text-xs font-mono uppercase tracking-widest font-bold text-muted-foreground">
              Gestión de carga y esfuerzo percibido (RPE)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-card border border-border shadow-sm p-1 rounded-none">
              <TeamSelector teams={teams} selectedTeamId={selectedTeam.id} />
            </div>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="border border-border bg-card p-12 text-center shadow-sm rounded-none">
            <div className="text-5xl mb-4">📊</div>
            <h2 className="text-2xl font-heading font-extrabold uppercase tracking-tighter">No hay sesiones de entrenamiento</h2>
            <p className="mt-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Los entrenamientos programados aparecerán aquí para registrar la carga física.
            </p>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Listado de Entrenamientos */}
            <div className="space-y-4">
              <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">
                Sesiones Disponibles ({events.length})
              </h2>
              <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
                {events.map((event) => {
                  const isSelected = selectedEvent?.id === event.id;
                  const formattedDate = format(new Date(event.startDate), "d 'de' MMM, yyyy", { locale: es });
                  const formattedTime = format(new Date(event.startDate), "HH:mm");

                  let rpeStatus = null;
                  if (!isCoach) {
                    const hasSubmitted = event.rpeEntries.some((r) => r.userId === session.user.id);
                    if (hasSubmitted) {
                      rpeStatus = (
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-green-600 bg-green-50 border border-green-200 px-2 py-0.5">
                          RPE REGISTRADO
                        </span>
                      );
                    } else {
                      const att = event.attendances[0];
                      const canSubmit = new Date(event.startDate) <= new Date() && (att?.status === "CONFIRMED" || att?.checkedIn === true);
                      rpeStatus = canSubmit ? (
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary bg-primary/5 border border-primary/20 px-2 py-0.5">
                          PENDIENTE RPE
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground bg-secondary px-2 py-0.5">
                          NO REGISTRABLE
                        </span>
                      );
                    }
                  }

                  return (
                    <Link
                      key={event.id}
                      href={`/trainings?teamId=${selectedTeam.id}&eventId=${event.id}`}
                      className={`block p-5 border transition-all rounded-none ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border bg-card hover:border-primary"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <span className="text-xs font-mono text-muted-foreground uppercase">
                          {formattedDate} - {formattedTime} hs
                        </span>
                        {rpeStatus}
                      </div>
                      <h3 className="font-heading font-extrabold uppercase tracking-tighter text-lg text-foreground truncate">
                        {event.title}
                      </h3>
                      {event.location && (
                        <span className="text-[10px] font-mono uppercase text-muted-foreground block mt-1">
                          📍 {event.location}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Detalle y RPE / Estadísticas */}
            <div className="lg:col-span-2 space-y-6">
              {selectedEvent ? (
                <>
                  <div className="border border-border bg-card p-8 shadow-sm rounded-none">
                    <span className="bg-primary/10 px-3 py-1 text-xs font-mono font-bold text-primary uppercase tracking-widest border border-primary/20 rounded-none">
                      Sesión de Entrenamiento
                    </span>
                    <h2 className="text-3xl font-heading font-extrabold tracking-tighter uppercase mt-4 mb-2">
                      {selectedEvent.title}
                    </h2>
                    <p className="text-muted-foreground text-xs font-mono capitalize">
                      {format(new Date(selectedEvent.startDate), "EEEE, d 'de' MMMM 'a las' HH:mm 'hs'", {
                        locale: es,
                      })}
                    </p>

                    {selectedEvent.location && (
                      <p className="text-xs font-mono mt-2 text-foreground">
                        📍 Lugar: {selectedEvent.location}
                      </p>
                    )}

                    {selectedEvent.description && (
                      <div className="mt-6 border-t border-border pt-4">
                        <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground mb-1">
                          Descripción / Objetivos
                        </h4>
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                          {selectedEvent.description}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Panel condicional según Rol */}
                  {isCoach ? (
                    /* PANEL DE ENTRENADOR */
                    <div className="grid gap-6 md:grid-cols-2">
                      {/* Estadísticas de carga */}
                      <div className="border border-border bg-card p-6 shadow-sm rounded-none flex flex-col justify-between">
                        <div>
                          <h3 className="text-lg font-heading font-extrabold uppercase tracking-tighter mb-4">
                            Carga Promedio de la Sesión
                          </h3>
                          {avgRpe ? (
                            <div className="grid grid-cols-2 gap-4">
                              <div className="border border-border p-4 bg-secondary/50 rounded-none text-center">
                                <span className="text-[10px] font-mono font-bold text-muted-foreground block uppercase">
                                  RPE Medio
                                </span>
                                <span className="text-3xl font-heading font-extrabold text-primary">
                                  {avgRpe} / 10
                                </span>
                              </div>
                              <div className="border border-border p-4 bg-secondary/50 rounded-none text-center">
                                <span className="text-[10px] font-mono font-bold text-muted-foreground block uppercase">
                                  Carga de Trabajo
                                </span>
                                <span className="text-3xl font-heading font-extrabold text-primary">
                                  {avgWorkload} UA
                                </span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground italic font-mono">
                              Sin registros de RPE de jugadores todavía.
                            </p>
                          )}
                        </div>

                        {/* Listado de cargas de los jugadores */}
                        <div className="mt-6 border-t border-border pt-4">
                          <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground mb-3">
                            Respuestas de Jugadores ({coachRpeEntries.length})
                          </h4>
                          {coachRpeEntries.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic font-mono">Ningún jugador ha enviado su RPE.</p>
                          ) : (
                            <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                              {coachRpeEntries.map((entry) => (
                                <div
                                  key={entry.id}
                                  className="flex flex-col border border-border p-3 bg-background rounded-none text-xs font-mono"
                                >
                                  <div className="flex justify-between items-center font-bold">
                                    <span className="text-foreground uppercase">{entry.user.name}</span>
                                    <span className="text-primary">RPE {entry.rpe} • {entry.duration}m ({entry.workload} UA)</span>
                                  </div>
                                  {entry.notes && (
                                    <p className="text-[10px] text-muted-foreground mt-1 bg-secondary/30 p-2 italic border-l border-primary/30">
                                      "{entry.notes}"
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Gráfico Histórico */}
                      <div className="border border-border bg-card p-6 shadow-sm rounded-none">
                        <h3 className="text-lg font-heading font-extrabold uppercase tracking-tighter">
                          Historial de Carga de Equipo
                        </h3>
                        <p className="text-[10px] font-mono uppercase text-muted-foreground">
                          Promedio de carga de trabajo (UA) por entrenamiento
                        </p>
                        <WorkloadChart data={chartData} />
                      </div>
                    </div>
                  ) : (
                    /* PANEL DE JUGADOR */
                    <div className="border border-border bg-card p-6 shadow-sm rounded-none">
                      {playerRpeEntry ? (
                        <div>
                          <span className="bg-green-100 text-green-800 border border-green-200 px-3 py-1 text-xs font-mono font-bold uppercase tracking-widest rounded-none inline-block mb-4">
                            Carga Registrada
                          </span>
                          <div className="grid gap-4 sm:grid-cols-3 mb-6">
                            <div className="border border-border p-4 bg-secondary/30 text-center rounded-none">
                              <span className="text-[10px] font-mono font-bold text-muted-foreground block uppercase">
                                Esfuerzo Percibido
                              </span>
                              <span className="text-2xl font-heading font-extrabold text-foreground">
                                {playerRpeEntry.rpe} / 10
                              </span>
                            </div>
                            <div className="border border-border p-4 bg-secondary/30 text-center rounded-none">
                              <span className="text-[10px] font-mono font-bold text-muted-foreground block uppercase">
                                Duración Sesión
                              </span>
                              <span className="text-2xl font-heading font-extrabold text-foreground">
                                {playerRpeEntry.duration} min
                              </span>
                            </div>
                            <div className="border border-border p-4 bg-secondary/30 text-center rounded-none">
                              <span className="text-[10px] font-mono font-bold text-muted-foreground block uppercase">
                                Carga de Trabajo Total
                              </span>
                              <span className="text-2xl font-heading font-extrabold text-primary">
                                {playerRpeEntry.workload} UA
                              </span>
                            </div>
                          </div>
                          {playerRpeEntry.notes && (
                            <div className="border-t border-border pt-4">
                              <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground mb-1">
                                Tus Notas
                              </h4>
                              <p className="text-sm text-foreground bg-secondary/30 p-4 border-l border-primary font-sans italic">
                                "{playerRpeEntry.notes}"
                              </p>
                            </div>
                          )}
                        </div>
                      ) : showRpeForm ? (
                        <div>
                          <h3 className="text-xl font-heading font-extrabold uppercase tracking-tighter mb-4">
                            REGISTRAR CARGA FÍSICA
                          </h3>
                          <RpeForm eventId={selectedEvent.id} />
                        </div>
                      ) : (
                        <div className="text-center p-6 bg-secondary/30 border border-border rounded-none">
                          <p className="text-sm font-mono text-muted-foreground uppercase tracking-widest">
                            {new Date(selectedEvent.startDate) > new Date()
                              ? "Esta sesión aún no ha comenzado"
                              : "No asististe o no confirmaste asistencia para esta sesión."}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="border border-border bg-card p-12 text-center shadow-sm rounded-none font-mono text-muted-foreground">
                  Selecciona una sesión de entrenamiento para ver los detalles.
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
