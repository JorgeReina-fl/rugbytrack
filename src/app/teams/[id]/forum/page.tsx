import "server-only";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { dbConnect } from "@/lib/mongoose";
import { Thread } from "@/models/Thread";
import { CreateThreadForm } from "@/components/forum/CreateThreadForm";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ForumPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  // Verificamos si es miembro del equipo (PostgreSQL)
  const membership = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId: session.user.id, teamId: id } },
    include: { team: true },
  });

  if (!membership) redirect("/dashboard");

  const team = membership.team;

  // Obtenemos hilos del foro (MongoDB)
  await dbConnect();
  // .lean() retorna JS objects serializables en vez de Mongoose Documents
  const threads = await Thread.find({ teamId: id }).sort({ updatedAt: -1 }).lean() as any[];

  return (
    <div className="min-h-screen bg-background text-foreground pb-10">
      <DashboardHeader badgeLabel={membership.isCoach ? "Cuerpo Técnico" : "Jugador"} />

      <main className="mx-auto max-w-4xl px-4 py-10 space-y-8">
        <div>
          <Link
            href={`/teams/${id}`}
            className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-all flex items-center gap-2"
          >
            ← Volver al Equipo
          </Link>
          <div className="mt-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-heading font-extrabold uppercase tracking-tighter">Tablón Táctico</h1>
              <p className="text-muted-foreground font-mono uppercase text-xs tracking-widest font-semibold mt-2">
                Debates y Feedback para {team.name}
              </p>
            </div>
          </div>
        </div>

        <CreateThreadForm teamId={id} />

        <div className="space-y-4">
          {threads.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
              <p className="text-muted-foreground font-mono italic">Aún no hay debates en este equipo. ¡Inicia uno!</p>
            </div>
          ) : (
            threads.map((thread) => (
              <Link key={thread._id.toString()} href={`/teams/${id}/forum/${thread._id.toString()}`} className="block group">
                <article className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary hover:shadow-md">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                    <h2 className="text-xl font-heading font-bold uppercase tracking-tight text-foreground group-hover:text-primary transition-colors line-clamp-2 break-words">
                      {thread.title}
                    </h2>
                    <span className="text-xs font-mono font-bold text-muted-foreground">
                      {new Date(thread.createdAt).toLocaleDateString("es-ES", { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground font-sans line-clamp-2 mb-4">
                    {thread.content}
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-foreground">
                      {thread.authorName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-mono uppercase tracking-widest font-bold text-foreground">
                      {thread.authorName}
                    </span>
                  </div>
                </article>
              </Link>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
