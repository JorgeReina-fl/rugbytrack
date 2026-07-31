import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { generateRsvpToken } from "@/lib/tokens";
import { Resend } from "resend";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (session.user.role !== "COACH") {
      return NextResponse.json({ error: "Se requiere rol de entrenador" }, { status: 403 });
    }

    const { id } = await params;

    const attendances = await prisma.attendance.findMany({
      where: {
        eventId: id,
        status: "PENDING",
      },
      include: {
        user: true,
      },
    });

    if (attendances.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
    const resendApiKey = process.env.RESEND_API_KEY;
    const resend = resendApiKey ? new Resend(resendApiKey) : null;

    let sentCount = 0;

    for (const attendance of attendances) {
      const token = generateRsvpToken(attendance.userId, attendance.eventId);
      const url = `${baseUrl}/rsvp/${token}`;

      if (resend) {
        try {
          await resend.emails.send({
            from: process.env.EMAIL_FROM ?? "RugbyTrack <onboarding@resend.dev>",
            to: attendance.user.email,
            subject: "Convocatoria de RugbyTrack",
            html: `<p>Hola ${attendance.user.name},</p><p>Has sido convocado a un evento. Confirma tu asistencia aquí:</p><p><a href="${url}">${url}</a></p>`,
          });
          sentCount++;
        } catch (error) {
          logger.error({ userId: attendance.userId, eventId: id }, "Failed to send RSVP email");
        }
      } else {
        logger.warn({ userId: attendance.userId, eventId: id }, "RESEND_API_KEY not set — email skipped");
        sentCount++;
      }
    }

    return NextResponse.json({ sent: sentCount });
  } catch (error) {
    logger.error({ err: error }, "Error in notify route");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
