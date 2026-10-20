import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveMembership } from "@/lib/membership";
import { logger } from "@/lib/logger";
import { sendRsvpNotifications } from "@/lib/rsvp-notify";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;

    // Confirm the event exists
    const event = await prisma.event.findUnique({ where: { id }, select: { id: true, teamId: true } });
    if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

    const membership = await getActiveMembership(event.teamId, session.user.id);
    if (!membership?.isCoach) {
      return NextResponse.json({ error: "Se requiere rol de entrenador" }, { status: 403 });
    }

    // Count pending before sending (for the response)
    const pending = await prisma.attendance.count({ where: { eventId: id, status: "PENDING" } });

    await sendRsvpNotifications(id);

    logger.info({ eventId: id, coachId: session.user.id, pending }, "Manual RSVP notify triggered");
    return NextResponse.json({ sent: pending });
  } catch (error) {
    logger.error({ err: error }, "Error in notify route");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
