import { auth } from "@/auth";
import { RugbyBallIcon } from "@/components/icons/RugbyBallIcon";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { ChartBar, Plus, Calendar, Chats } from "@phosphor-icons/react/dist/ssr";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <DashboardHeader />

      <main className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-4xl font-heading font-extrabold tracking-tighter uppercase text-foreground">
            Bienvenido, {session.user.name?.split(" ")[0]}
          </h1>
          <p className="mt-2 font-mono uppercase text-xs tracking-widest font-semibold text-muted-foreground">
            Gestiona tus equipos y entrenos desde aquí
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Tarjeta: Mis Equipos */}
          <Link
            href="/teams"
            id="dashboard-teams-card"
            className="group border border-border bg-card p-6 transition-all hover:border-primary hover:shadow-md"
          >
            <div className="mb-4 text-3xl"><RugbyBallIcon size={24} weight="regular" className="inline mr-2" /></div>
            <h2 className="font-heading font-extrabold uppercase tracking-tighter text-foreground group-hover:text-primary transition-colors">
              Mis equipos
            </h2>
            <p className="mt-1 text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Ver plantilla y gestionar tu equipo
            </p>
          </Link>

          {/* Tarjeta: Crear Equipo */}
          <Link
            href="/teams/new"
            id="dashboard-create-team-card"
            className="group border border-border bg-card p-6 transition-all hover:border-primary hover:shadow-md"
          >
            <div className="mb-4 text-3xl"><Plus size={32} weight="regular" /></div>
            <h2 className="font-heading font-extrabold uppercase tracking-tighter text-foreground group-hover:text-primary transition-colors">
              Crear equipo
            </h2>
            <p className="mt-1 text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Empieza con tu primer equipo
            </p>
          </Link>

          {/* Tarjeta: Eventos */}
          <Link
            href="/events"
            id="dashboard-events-card"
            className="group border border-border bg-card p-6 transition-all hover:border-primary hover:shadow-md"
          >
            <div className="mb-4 text-3xl"><Calendar size={32} weight="regular" /></div>
            <h2 className="font-heading font-extrabold uppercase tracking-tighter text-foreground group-hover:text-primary transition-colors">
              Eventos
            </h2>
            <p className="mt-1 text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Calendario y asistencia en tiempo real
            </p>
          </Link>

          {/* Tarjeta: Entrenos */}
          <Link
            href="/trainings"
            id="dashboard-trainings-card"
            className="group border border-border bg-card p-6 transition-all hover:border-primary hover:shadow-md"
          >
            <div className="mb-4 text-3xl"><ChartBar size={24} weight="regular" className="inline mr-2" /></div>
            <h2 className="font-heading font-extrabold uppercase tracking-tighter text-foreground group-hover:text-primary transition-colors">
              Entrenos
            </h2>
            <p className="mt-1 text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Registra y analiza el esfuerzo físico
            </p>
          </Link>

          {/* Tarjeta: Foro */}
          <Link
            href="/forum"
            id="dashboard-forum-card"
            className="group border border-border bg-card p-6 transition-all hover:border-primary hover:shadow-md rounded-none"
          >
            <div className="mb-4 text-3xl"><Chats size={32} weight="regular" /></div>
            <h2 className="font-heading font-extrabold uppercase tracking-tighter text-foreground group-hover:text-primary transition-colors">
              Foro
            </h2>
            <p className="mt-1 text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Discusión táctica y comunicación
            </p>
          </Link>
        </div>
      </main>
    </div>
  );
}
