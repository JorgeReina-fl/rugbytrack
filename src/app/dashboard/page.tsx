import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { LogoutButton } from "@/components/auth/LogoutButton";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-background text-foreground">
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
              {session.user.role === "COACH" ? "Entrenador" : "Jugador"}
            </span>
            <div className="w-px h-4 bg-border hidden sm:block"></div>
            <LogoutButton />
          </div>
        </div>
      </nav>

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
            <div className="mb-4 text-3xl">🏉</div>
            <h2 className="font-heading font-extrabold uppercase tracking-tighter text-foreground group-hover:text-primary transition-colors">
              Mis equipos
            </h2>
            <p className="mt-1 text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Ver plantilla y gestionar tu equipo
            </p>
          </Link>

          {/* Tarjeta: Crear Equipo (CTA punteada) */}
          <Link
            href="/teams/new"
            id="dashboard-create-team-card"
            className="group border border-dashed border-border bg-background p-6 transition-all hover:border-primary hover:bg-primary/5"
          >
            <div className="mb-4 text-3xl">➕</div>
            <h2 className="font-heading font-extrabold uppercase tracking-tighter text-muted-foreground group-hover:text-primary transition-colors">
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
            <div className="mb-4 text-3xl">📅</div>
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
            <div className="mb-4 text-3xl">📊</div>
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
            <div className="mb-4 text-3xl">💬</div>
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
