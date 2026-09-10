import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { getProfileData } from "@/lib/profile";
import Link from "next/link";
import type { Metadata } from "next";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import ChangePasswordForm from "./ChangePasswordForm";

export const metadata: Metadata = {
  title: "Mi perfil",
};

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const data = await getProfileData(session.user.id);
  if (!data) redirect("/login");

  const { account, teams, stats } = data;

  return (
    <div className="min-h-screen bg-background text-foreground pb-16">
      <DashboardHeader badgeLabel={null} />

      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-all"
          >
            ← Dashboard
          </Link>
        </div>

        <h1 className="text-4xl font-heading font-extrabold tracking-tighter uppercase mb-10">
          Mi perfil
        </h1>

        {/* Cuenta */}
        <section className="mb-6 border border-border p-6">
          <h2 className="text-lg font-heading font-bold uppercase tracking-tight mb-5 text-foreground">
            Cuenta
          </h2>
          <dl className="space-y-4">
            <div>
              <dt className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-0.5">
                Email
              </dt>
              <dd className="font-mono text-sm text-foreground">{account.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-0.5">
                Nombre
              </dt>
              <dd className="font-mono text-sm text-foreground">{account.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-0.5">
                Miembro desde
              </dt>
              <dd className="font-mono text-sm text-foreground">
                {format(new Date(account.createdAt), "d 'de' MMMM 'de' yyyy", { locale: es })}
              </dd>
            </div>
          </dl>
        </section>

        {/* Mis equipos */}
        <section className="mb-6 border border-border p-6">
          <h2 className="text-lg font-heading font-bold uppercase tracking-tight mb-5 text-foreground">
            Mis equipos
          </h2>
          {teams.length === 0 ? (
            <p className="text-sm font-mono text-muted-foreground">
              No perteneces a ningún equipo activo.
            </p>
          ) : (
            <ul className="space-y-2">
              {teams.map((team) => (
                <li key={team.id}>
                  <Link
                    href={`/teams/${team.id}`}
                    className="flex items-center justify-between border border-border px-4 py-3 hover:border-primary transition-all group"
                  >
                    <span className="font-mono text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate pr-4">
                      {team.name}
                    </span>
                    <span className="shrink-0 bg-secondary px-2 py-0.5 text-xs font-mono font-bold uppercase tracking-widest text-foreground">
                      {team.role === "COACH" ? "Entrenador" : "Jugador"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Cambiar contraseña */}
        <section className="mb-6 border border-border p-6">
          <h2 className="text-lg font-heading font-bold uppercase tracking-tight mb-5 text-foreground">
            Cambiar contraseña
          </h2>
          <ChangePasswordForm />
        </section>

        {/* Mis estadísticas — solo si es jugador en al menos un equipo */}
        {stats && stats.length > 0 && (
          <section className="border border-border p-6">
            <h2 className="text-lg font-heading font-bold uppercase tracking-tight mb-1 text-foreground">
              Mis estadísticas
            </h2>
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-6">
              Últimas 4 semanas
            </p>
            <div className="space-y-5">
              {stats.map((s) => (
                <div key={s.teamId} className="border border-border p-4">
                  <p className="text-xs font-mono font-bold uppercase tracking-widest text-primary mb-3">
                    {s.teamName}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-muted p-3 text-center">
                      <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1 leading-tight">
                        RPE medio
                      </p>
                      <p className="text-2xl font-heading font-bold text-foreground">
                        {s.avgRpe !== null ? s.avgRpe : "—"}
                      </p>
                    </div>
                    <div className="bg-muted p-3 text-center">
                      <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1 leading-tight">
                        Asistencia
                      </p>
                      <p className="text-2xl font-heading font-bold text-foreground">
                        {s.attendanceRate !== null ? `${s.attendanceRate}%` : "—"}
                      </p>
                    </div>
                    <div className="bg-muted p-3 text-center">
                      <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1 leading-tight">
                        ACWR
                      </p>
                      <p
                        className={`text-2xl font-heading font-bold ${
                          s.acwr !== null && s.acwr > 1.5
                            ? "text-destructive"
                            : "text-foreground"
                        }`}
                      >
                        {s.acwr !== null ? s.acwr : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
