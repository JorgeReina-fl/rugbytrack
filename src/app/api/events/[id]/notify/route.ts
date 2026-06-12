import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateRsvpToken } from "@/lib/tokens";
import { Resend } from "resend";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      return NextResponse.json({ sent: 0, links: [] });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
    const resendApiKey = process.env.RESEND_API_KEY;
    const resend = resendApiKey ? new Resend(resendApiKey) : null;

    const links: string[] = [];
    let sentCount = 0;

    for (const attendance of attendances) {
      const token = generateRsvpToken(attendance.userId, attendance.eventId);
      const url = `${baseUrl}/rsvp/${token}`;
      links.push(url);

      if (resend) {
        try {
          await resend.emails.send({
            from: "RugbyTrack <onboarding@resend.dev>",
            to: attendance.user.email,
            subject: "Convocatoria de RugbyTrack",
            html: `<p>Hola ${attendance.user.name},</p><p>Has sido convocado a un evento. Confirma tu asistencia aquí:</p><p><a href="${url}">${url}</a></p>`,
          });
          sentCount++;
        } catch (error) {
          console.error("Error sending email:", error);
        }
      } else {
        console.log(`[MAGIC_LINK] userId=${attendance.userId} eventId=${attendance.eventId} url=${url}`);
        sentCount++;
      }
    }

    // En producción no devolveríamos los links, pero para depurar/desarrollo lo dejamos
    return NextResponse.json({ sent: sentCount, links });
  } catch (error) {
    console.error("Error in notify route:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
