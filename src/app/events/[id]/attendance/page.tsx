import "server-only";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getActiveMembership } from "@/lib/membership";
import { AttendanceBoard } from "@/components/event/AttendanceBoard";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";

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
  const membership = await getActiveMembership(event.teamId, session.user.id);

  if (!membership?.isCoach) {
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

  // RPE del evento en una sola consulta; se asocia a cada jugador por userId
  const rpeEntries = await prisma.rpeEntry.findMany({
    where: { eventId: id },
    select: { userId: true, rpe: true, duration: true, workload: true, recordedById: true, updatedAt: true },
  });
  const rpeByUser = new Map(rpeEntries.map((r) => [r.userId, r]));

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
      rpe: (() => {
        const r = rpeByUser.get(att.userId);
        return r
          ? {
              rpe: r.rpe,
              duration: r.duration,
              workload: r.workload,
              recordedById: r.recordedById,
              updatedAt: r.updatedAt.toISOString(),
            }
          : null;
      })(),
    };
  });

  return (
    <div className="min-h-screen bg-background text-foreground pb-10">
      <DashboardHeader badgeLabel="Entrenador" />

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

        <AttendanceBoard
          eventId={id}
          initialAttendances={mappedAttendances}
          event={{
            startDate: event.startDate.toISOString(),
            endDate: event.endDate?.toISOString() ?? null,
            rsvpDeadline: event.rsvpDeadline?.toISOString() ?? null,
          }}
          nowIso={new Date().toISOString()}
        />
      </main>
    </div>
  );
}
