import "server-only";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AttendanceBoard } from "@/components/event/AttendanceBoard";
import { LogoutButton } from "@/components/auth/LogoutButton";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function AttendancePage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  // Carga el evento
  const event = await prisma.event.findUnique({
    where: { id },
  });

  if (!event) {
    redirect("/events");
  }

  // Valida que el usuario sea COACH en el equipo
  const membership = await prisma.teamMember.findFirst({
    where: { userId: session.user.id, teamId: event.teamId, isCoach: true },
  });

  if (!membership) {
    redirect(`/events/${id}`);
  }

  // Carga la lista inicial de asistencia de la base de datos
  const attendances = await prisma.attendance.findMany({
    where: { eventId: id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          image: true,
          memberships: {
            where: { teamId: event.teamId },
            select: {
              position: true,
              jerseyNumber: true,
            },
          },
        },
      },
    },
    orderBy: {
      user: {
        name: "asc",
      },
    },
  });

  // Mapea al mismo formato que espera el AttendanceBoard
  const mappedAttendances = attendances.map((att) => {
    const memberDetails = att.user.memberships[0] ?? null;
    return {
      userId: att.userId,
      name: att.user.name,
      image: att.user.image,
      position: memberDetails?.position ?? null,
      jerseyNumber: memberDetails?.jerseyNumber ?? null,
      status: att.status,
      checkedIn: att.checkedIn,
      checkedInAt: att.checkedInAt?.toISOString() ?? null,
    };
  });

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
            <span className="bg-primary/10 px-3 py-1 text-xs font-mono font-bold uppercase tracking-widest text-primary hidden sm:inline-block">
              Entrenador
            </span>
            <div className="w-px h-4 bg-border hidden sm:block"></div>
            <LogoutButton />
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href={`/events/${id}`}
            className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-all"
          >
            ← Volver al Evento
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-5xl font-heading font-extrabold tracking-tighter uppercase">Panel de Asistencia</h1>
          <p className="mt-2 text-xs font-mono uppercase tracking-widest font-bold text-muted-foreground">
            Gestión en tiempo real de asistencia para "{event.title}".
          </p>
        </div>

        <AttendanceBoard eventId={id} initialAttendances={mappedAttendances} />
      </main>
    </div>
  );
}
