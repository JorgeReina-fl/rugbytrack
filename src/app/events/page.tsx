import "server-only";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import TeamSelector from "./team-selector";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { prisma } from "@/lib/prisma";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isSameDay,
  parseISO,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";

interface PageProps {
  searchParams: Promise<{
    teamId?: string;
    year?: string;
    month?: string;
  }>;
}

export default async function EventsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const resolvedParams = await searchParams;
  const yearParam = resolvedParams.year;
  const monthParam = resolvedParams.month;
  let teamIdParam = resolvedParams.teamId;

  // 1. Obtiene los equipos del usuario
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
            Primero debes crear un equipo o unirte a uno existente para ver los eventos.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              href="/teams"
              className="rounded-xl bg-primary px-6 py-3 text-sm font-mono uppercase tracking-widest font-bold text-primary-foreground hover:opacity-90 transition-all shadow-md"
            >
              IR A MIS EQUIPOS
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // Si no hay teamId seleccionado, se toma el primero por defecto
  if (!teamIdParam) {
    const defaultTeam = teams[0];
    if (defaultTeam) {
      redirect(`/events?teamId=${defaultTeam.id}`);
    }
  }

  const selectedTeam = teams.find((t) => t.id === teamIdParam) || teams[0];
  if (!selectedTeam) {
    redirect("/dashboard");
  }

  const isCoach = selectedTeam.members[0]?.isCoach ?? false;

  // 2. Determina el mes y año actual/seleccionado para el calendario
  const now = new Date();
  const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear();
  const month = monthParam ? parseInt(monthParam, 10) - 1 : now.getMonth();
  const currentCalendarDate = new Date(year, month, 1);

  // Intervalos del mes para generar la cuadrícula del calendario
  const monthStart = startOfMonth(currentCalendarDate);
  const monthEnd = endOfMonth(currentCalendarDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Empezar en Lunes
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // 3. Carga los eventos del mes
  const events = await prisma.event.findMany({
    where: {
      teamId: selectedTeam.id,
      startDate: {
        gte: calendarStart,
        lte: calendarEnd,
      },
    },
    include: {
      attendances: {
        where: { userId: session.user.id },
        select: { status: true, checkedIn: true },
      },
    },
    orderBy: { startDate: "asc" },
  });

  // Calcular navegación
  const prevMonthDate = new Date(year, month - 1, 1);
  const nextMonthDate = new Date(year, month + 1, 1);

  const prevLink = `/events?teamId=${selectedTeam.id}&year=${prevMonthDate.getFullYear()}&month=${prevMonthDate.getMonth() + 1}`;
  const nextLink = `/events?teamId=${selectedTeam.id}&year=${nextMonthDate.getFullYear()}&month=${nextMonthDate.getMonth() + 1}`;

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
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-mono font-bold uppercase tracking-widest text-foreground hidden sm:inline-block">
              {isCoach ? "Entrenador" : "Jugador"}
            </span>
            <div className="w-px h-4 bg-border hidden sm:block"></div>
            <LogoutButton />
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-10">
        {/* Encabezado y Selector de Equipos */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-5xl font-heading font-extrabold uppercase tracking-tighter">Calendario</h1>
            <p className="mt-2 text-xs font-mono uppercase tracking-widest font-bold text-muted-foreground">
              Eventos y control de asistencia para tu equipo
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Dropdown simple de selección de equipo */}
            <div className="bg-card border border-border shadow-sm p-1">
              <TeamSelector teams={teams} selectedTeamId={selectedTeam.id} />
            </div>

            {isCoach && (
              <Link
                href={`/events/new?teamId=${selectedTeam.id}`}
                id="create-event-btn"
                className="rounded-xl bg-primary px-6 py-2.5 text-xs font-mono uppercase tracking-widest font-bold text-primary-foreground hover:opacity-90 transition-all shadow-md"
              >
                Crear Evento
              </Link>
            )}
          </div>
        </div>

        {/* Barra de Navegación de Meses */}
        <div className="flex items-center justify-between bg-card border border-border shadow-sm rounded-none p-4 mb-6">
          <Link
            href={prevLink}
            className="px-4 py-2 text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-all"
          >
            ◀ Anterior
          </Link>
          <h2 className="text-2xl font-heading font-extrabold uppercase tracking-tighter">
            {format(currentCalendarDate, "MMMM yyyy", { locale: es })}
          </h2>
          <Link
            href={nextLink}
            className="px-4 py-2 text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-all"
          >
            Siguiente ▶
          </Link>
        </div>

        {/* Cuadrícula de Calendario */}
        <div className="border border-border bg-card shadow-sm overflow-hidden">
          {/* Cabecera de días de la semana */}
          <div className="grid grid-cols-7 border-b border-border bg-secondary py-3 text-center text-xs font-mono font-bold text-muted-foreground uppercase tracking-wider">
            <div>Lun</div>
            <div>Mar</div>
            <div>Mié</div>
            <div>Jue</div>
            <div>Vie</div>
            <div>Sáb</div>
            <div>Dom</div>
          </div>

          {/* Días del mes */}
          <div className="grid grid-cols-7 auto-rows-[120px] divide-x divide-y divide-border">
            {days.map((day, idx) => {
              const isCurrentMonth = day.getMonth() === month;
              const dayEvents = events.filter((e) => isSameDay(new Date(e.startDate), day));

              return (
                <div
                  key={idx}
                  className={`p-2 flex flex-col gap-1 transition-all ${
                    isCurrentMonth ? "bg-card" : "bg-secondary/50 text-muted-foreground"
                  }`}
                >
                  <span className="text-xs font-mono font-bold self-end opacity-70">{day.getDate()}</span>
                  <div className="flex-1 overflow-y-auto space-y-1">
                    {dayEvents.map((event) => {
                      const userAtt = event.attendances[0];
                      let statusColor = "bg-secondary text-foreground border border-border";
                      let typeLabel = event.type === "TRAINING" ? "Entreno" : event.type === "MATCH" ? "Partido" : "Evento";

                      if (userAtt) {
                        if (userAtt.checkedIn) {
                          statusColor = "bg-green-100 text-green-800 border border-green-200";
                        } else if (userAtt.status === "CONFIRMED") {
                          statusColor = "bg-blue-100 text-blue-800 border border-blue-200";
                        } else if (userAtt.status === "DECLINED") {
                          statusColor = "bg-destructive/10 text-destructive border border-destructive/20";
                        } else {
                          statusColor = "bg-amber-100 text-amber-800 border border-amber-200";
                        }
                      }

                      return (
                        <Link
                          key={event.id}
                          href={`/events/${event.id}`}
                          className={`block p-1.5 text-left text-[10px] leading-tight font-sans transition-all hover:border-primary ${statusColor}`}
                        >
                          <div className="font-bold truncate">{event.title}</div>
                          <div className="flex items-center justify-between mt-1 text-[8px] font-mono font-bold uppercase tracking-widest opacity-80">
                            <span>{typeLabel}</span>
                            <span>
                              {format(new Date(event.startDate), "HH:mm")}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
