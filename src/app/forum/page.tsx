import "server-only";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/auth/LogoutButton";

export default async function ForumRouterPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // 1. Obtener los equipos del usuario
  const teams = await prisma.team.findMany({
    where: {
      members: { some: { userId: session.user.id } },
    },
    select: {
      id: true,
    },
  });

  // 2. Si tiene equipos, redirigir al foro del primero
  if (teams.length > 0) {
    redirect(`/teams/${teams[0].id}/forum`);
  }

  // 3. Fallback en Modo Claro y bordes rectos (0px) si no pertenece a ningún equipo
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
            <LogoutButton />
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="text-6xl mb-6">💬</div>
        <h1 className="text-3xl font-heading font-extrabold uppercase tracking-tighter text-foreground">
          No tienes equipos todavía
        </h1>
        <p className="mt-2 text-xs font-mono uppercase tracking-widest font-bold text-muted-foreground">
          Debes unirte a un equipo o crear uno para poder participar en el Foro Táctico.
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
