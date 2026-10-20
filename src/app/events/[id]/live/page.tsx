import "server-only";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

interface PageProps {
  params: Promise<{ id: string }>;
}

// Ruta retirada (dashboard en vivo con Socket.IO). Se mantiene solo para los enlaces antiguos:
// el coach va al panel de asistencia y el resto a la página del evento.
export default async function LiveAttendanceRedirect({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const event = await prisma.event.findUnique({ where: { id }, select: { teamId: true } });
  if (!event) redirect("/events");

  const membership = await prisma.teamMember.findFirst({
    where: { userId: session.user.id, teamId: event.teamId, isCoach: true, leftAt: null },
    select: { id: true },
  });

  redirect(membership ? `/events/${id}/attendance` : `/events/${id}`);
}
