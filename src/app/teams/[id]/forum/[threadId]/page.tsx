import "server-only";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { dbConnect } from "@/lib/mongoose";
import { Thread } from "@/models/Thread";
import { Comment } from "@/models/Comment";
import { CreateCommentForm } from "@/components/forum/CreateCommentForm";
import { LogoutButton } from "@/components/auth/LogoutButton";
import mongoose from "mongoose";

interface PageProps {
  params: Promise<{
    id: string;
    threadId: string;
  }>;
}

export default async function ThreadPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id, threadId } = await params;

  if (!mongoose.Types.ObjectId.isValid(threadId)) {
    redirect(`/teams/${id}/forum`);
  }

  // Verificamos si es miembro del equipo (PostgreSQL)
  const membership = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId: session.user.id, teamId: id } },
    include: { team: true },
  });

  if (!membership) redirect("/dashboard");

  await dbConnect();
  
  const thread = await Thread.findById(threadId).lean() as any;
  if (!thread || thread.teamId !== id) {
    redirect(`/teams/${id}/forum`);
  }

  const comments = await Comment.find({ threadId }).sort({ createdAt: 1 }).lean() as any[];

  return (
    <div className="min-h-screen bg-background text-foreground pb-10">
      <nav className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link href="/dashboard" className="text-xl font-heading font-extrabold tracking-tighter uppercase">
            Rugby<span className="text-primary">Track</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm font-mono uppercase tracking-widest font-semibold text-muted-foreground">{session.user.name}</span>
            <div className="w-px h-4 bg-border hidden sm:block"></div>
            <LogoutButton />
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-4 py-10 space-y-8">
        <div>
          <Link
            href={`/teams/${id}/forum`}
            className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-all flex items-center gap-2"
          >
            ← Volver al Tablón
          </Link>
        </div>

        <article className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <h1 className="text-3xl sm:text-4xl font-heading font-extrabold uppercase tracking-tighter text-foreground mb-6">
            {thread.title}
          </h1>
          
          <div className="flex items-center gap-3 mb-8 border-b border-border pb-6">
            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-primary-foreground shadow-inner">
              {thread.authorName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-mono uppercase tracking-widest font-bold text-foreground">
                {thread.authorName}
              </p>
              <p className="text-xs font-mono text-muted-foreground">
                {new Date(thread.createdAt).toLocaleString("es-ES")}
              </p>
            </div>
          </div>

          <div className="prose prose-invert max-w-none font-sans text-foreground/90 whitespace-pre-wrap">
            {thread.content}
          </div>
        </article>

        <div className="space-y-6">
          <h3 className="text-lg font-heading font-bold uppercase tracking-tight text-foreground flex items-center gap-2">
            Respuestas <span className="bg-secondary px-2 py-0.5 rounded-full text-xs font-mono">{comments.length}</span>
          </h3>
          
          {comments.map((comment) => (
            <div key={comment._id.toString()} className="rounded-2xl border border-border bg-card/50 p-6 shadow-sm ml-0 sm:ml-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-foreground">
                  {comment.authorName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-mono uppercase tracking-widest font-bold text-foreground">
                    {comment.authorName}
                  </p>
                  <p className="text-xs font-mono text-muted-foreground">
                    {new Date(comment.createdAt).toLocaleString("es-ES")}
                  </p>
                </div>
              </div>
              <div className="font-sans text-sm text-foreground/80 whitespace-pre-wrap">
                {comment.content}
              </div>
            </div>
          ))}

          <CreateCommentForm threadId={threadId} />
        </div>
      </main>
    </div>
  );
}
