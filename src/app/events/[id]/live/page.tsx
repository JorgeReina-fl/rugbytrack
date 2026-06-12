import "server-only";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { LiveAttendanceClient } from "./LiveAttendanceClient";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id }, select: { title: true } });
  return {
    title: `Live · ${event?.title ?? "Evento"}`,
    description: "Dashboard de asistencia en tiempo real vía Socket.io",
  };
}

export default async function LiveAttendancePage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id: eventId } = await params;

  // Verify membership — both coaches and players can view this page
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, startDate: true, teamId: true, type: true },
  });

  if (!event) redirect("/events");

  const membership = await prisma.teamMember.findFirst({
    where: { userId: session.user.id, teamId: event.teamId },
    select: { isCoach: true },
  });

  if (!membership) redirect("/events");

  const isCoach = membership.isCoach;

  // Fetch initial attendance state
  const attendances = await prisma.attendance.findMany({
    where: { eventId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          image: true,
          memberships: {
            where: { teamId: event.teamId },
            select: { position: true, jerseyNumber: true },
          },
        },
      },
    },
    orderBy: [
      { checkedIn: "desc" },
      { user: { name: "asc" } },
    ],
  });

  const initialAttendances = attendances.map((att) => {
    const member = att.user.memberships[0] ?? null;
    return {
      userId: att.userId,
      name: att.user.name,
      image: att.user.image,
      position: member?.position ?? null,
      jerseyNumber: member?.jerseyNumber ?? null,
      status: att.status,
      checkedIn: att.checkedIn,
      checkedInAt: att.checkedInAt?.toISOString() ?? null,
    };
  });

  const formattedDate = format(
    new Date(event.startDate),
    "EEEE d 'de' MMMM · HH:mm 'hs'",
    { locale: es }
  );

  const typeLabel =
    event.type === "TRAINING"
      ? "Entrenamiento"
      : event.type === "MATCH"
        ? "Partido"
        : "Evento";

  return (
    <div className="min-h-screen bg-background text-foreground pb-16">
      {/* Nav */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link
            href="/dashboard"
            className="text-xl font-heading font-extrabold tracking-tighter uppercase"
          >
            Rugby<span className="text-primary">Track</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm font-mono uppercase tracking-widest font-semibold text-muted-foreground hidden sm:inline">
              {session.user.name}
            </span>
            <span className="bg-secondary px-3 py-1 text-xs font-mono font-bold uppercase tracking-widest text-foreground hidden sm:inline-block">
              {isCoach ? "Entrenador" : "Jugador"}
            </span>
            <div className="w-px h-4 bg-border hidden sm:block" />
            <LogoutButton />
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-4 py-10">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">
          <Link href="/events" className="hover:text-primary transition-colors">
            Eventos
          </Link>
          <span>/</span>
          <Link href={`/events/${eventId}`} className="hover:text-primary transition-colors">
            {event.title}
          </Link>
          <span>/</span>
          <span className="text-foreground">Live</span>
        </div>

        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-2">
              {/* Live indicator */}
              <span className="flex items-center gap-1.5 bg-primary/10 border border-primary/30 px-3 py-1 text-xs font-mono font-bold uppercase tracking-widest text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                Live
              </span>
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                {typeLabel}
              </span>
            </div>
            <h1 className="text-4xl font-heading font-extrabold tracking-tighter uppercase">
              {event.title}
            </h1>
            <p className="mt-1 text-sm font-mono text-muted-foreground capitalize">
              {formattedDate}
            </p>
          </div>

          {isCoach && (
            <Link
              href={`/events/${eventId}/attendance`}
              className="border border-primary/40 bg-primary/5 px-4 py-2 text-xs font-mono font-bold uppercase tracking-widest text-primary hover:bg-primary/10 transition-all"
            >
              ⚙️ Panel de Control
            </Link>
          )}
        </div>

        <LiveAttendanceClient
          eventId={eventId}
          eventTitle={event.title}
          isCoach={isCoach}
          currentUserId={session.user.id}
          initialAttendances={initialAttendances}
        />
      </main>
    </div>
  );
}
