import "server-only";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { WorkloadChart } from "@/components/training/WorkloadChart";
import { LogoutButton } from "@/components/auth/LogoutButton";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function TeamStatisticsPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  // 1. Verificación de Membresía y Rol (COACH)
  const membership = await prisma.teamMember.findUnique({
    where: {
      userId_teamId: {
        userId: session.user.id,
        teamId: id,
      },
    },
    include: {
      team: true,
    },
  });

  if (!membership || !membership.isCoach) {
    redirect(`/teams/${id}`); // Redirige al inicio del equipo si no es coach
  }

  const team = membership.team;

  // 2. Consulta a): Carga media de los últimos 4 eventos
  const lastEvents = await prisma.event.findMany({
    where: {
      teamId: id,
      startDate: { lte: new Date() },
      rpeEntries: { some: {} }, // Solo eventos que tengan registros
    },
    orderBy: { startDate: "desc" },
    take: 4,
    select: {
      id: true,
      startDate: true,
      rpeEntries: {
        select: { workload: true },
      },
    },
  });

  const chartData = lastEvents
    .reverse()
    .map((event) => {
      const totalWorkload = event.rpeEntries.reduce((sum, entry) => sum + entry.workload, 0);
      const avgWorkload =
        event.rpeEntries.length > 0 ? Math.round(totalWorkload / event.rpeEntries.length) : 0;

      return {
        name: new Date(event.startDate).toLocaleDateString("es-ES", {
          day: "2-digit",
          month: "short",
        }),
        avgWorkload,
      };
    });

  // 3. Consulta b): Ranking individual de carga en los últimos 30 días
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const playersWorkload = await prisma.rpeEntry.groupBy({
    by: ["userId"],
    where: {
      event: { teamId: id },
      createdAt: { gte: thirtyDaysAgo },
    },
    _sum: { workload: true },
  });

  const userIds = playersWorkload.map((p) => p.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, image: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const ranking = playersWorkload
    .map((p) => {
      const user = userMap.get(p.userId);
      return {
        userId: p.userId,
        name: user?.name || "Jugador Desconocido",
        totalWorkload: p._sum?.workload || 0,
      };
    })
    .sort((a, b) => b.totalWorkload - a.totalWorkload);

  const maxWorkload = ranking.length > 0 ? ranking[0]?.totalWorkload ?? 1 : 1;

  return (
    <div className="min-h-screen bg-background text-foreground pb-10">
      <nav className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link href="/dashboard" className="text-xl font-heading font-extrabold tracking-tighter uppercase">
            Rugby<span className="text-primary">Track</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm font-mono uppercase tracking-widest font-semibold text-muted-foreground">{session.user.name}</span>
            <span className="rounded-full bg-primary/20 px-3 py-1 text-xs font-mono font-bold uppercase tracking-widest text-primary hidden sm:inline-block">
              Cuerpo Técnico
            </span>
            <div className="w-px h-4 bg-border hidden sm:block"></div>
            <LogoutButton />
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-4 py-10 space-y-10">
        <div>
          <Link
            href={`/teams/${id}`}
            className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-all flex items-center gap-2"
          >
            ← Volver al Equipo
          </Link>
          <div className="mt-6">
            <h1 className="text-5xl font-heading font-extrabold uppercase tracking-tighter">Control de Carga</h1>
            <p className="text-muted-foreground font-mono uppercase text-xs tracking-widest font-semibold mt-2">Estadísticas y monitorización de RPE para {team.name}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Panel Izquierdo: Gráfico de Evolución */}
          <section className="rounded-2xl border border-border bg-card p-8 shadow-sm flex flex-col">
            <div className="mb-4">
              <h2 className="text-2xl font-heading font-extrabold uppercase tracking-tight flex items-center gap-2">
                <span>📈</span> Evolución del Equipo
              </h2>
              <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mt-1">
                Carga media (UA) en las últimas 4 sesiones
              </p>
            </div>
            <div className="flex-grow">
              <WorkloadChart data={chartData} />
            </div>
          </section>

          {/* Panel Derecho: Ranking Individual */}
          <section className="rounded-2xl border border-border bg-card p-8 shadow-sm">
            <div className="mb-8 flex items-center justify-between border-b border-border pb-4">
              <div>
                <h2 className="text-2xl font-heading font-extrabold uppercase tracking-tight flex items-center gap-2">
                  <span>🔥</span> Ranking de Jugadores
                </h2>
                <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mt-1">
                  Carga Acumulada (Últimos 30 días)
                </p>
              </div>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-mono font-bold text-foreground">
                Top {ranking.length}
              </span>
            </div>

            <div className="space-y-6">
              {ranking.length === 0 ? (
                <p className="text-sm text-muted-foreground italic text-center py-6 font-mono">
                  No hay datos de esfuerzo registrados en este periodo.
                </p>
              ) : (
                ranking.map((player, index) => {
                  const percentage = Math.round((player.totalWorkload / maxWorkload) * 100);
                  
                  // Lógica PrimalTraining: Opacidades incrementales y Destructive para críticos
                  let barColor = "bg-primary opacity-40";
                  if (percentage >= 50) barColor = "bg-primary opacity-70";
                  if (percentage >= 80) barColor = "bg-primary opacity-100";
                  if (percentage >= 90) barColor = "bg-destructive opacity-100";

                  return (
                    <div key={player.userId} className="space-y-2 group">
                      <div className="flex justify-between items-end">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm font-bold text-muted-foreground w-6">
                            {index + 1}.
                          </span>
                          <span className="text-base font-heading font-bold uppercase tracking-tight text-foreground group-hover:text-primary transition-colors">
                            {player.name}
                          </span>
                        </div>
                        <span className="text-xs font-mono font-bold text-muted-foreground">
                          {player.totalWorkload} UA
                        </span>
                      </div>
                      <div className="h-3 w-full rounded-full bg-secondary overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ease-out ${barColor}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
