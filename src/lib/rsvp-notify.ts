import "server-only";
import * as React from "react";
import { render } from "@react-email/components";
import { resend } from "@/lib/resend";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { trackEmailBudget } from "@/lib/email-budget";
import { generateRsvpToken } from "@/lib/tokens";
import { RsvpRequestEmail } from "@/emails/rsvp-request";

/**
 * Sends RSVP request emails (with magic-link token) to all PENDING attendance
 * records for the given event. Safe to call fire-and-forget.
 */
export async function sendRsvpNotifications(eventId: string): Promise<void> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, startDate: true, location: true },
  });
  if (!event) return;

  const attendances = await prisma.attendance.findMany({
    where: { eventId, status: "PENDING" },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (attendances.length === 0) {
    logger.info({ eventId }, "RSVP notify: no pending attendances");
    return;
  }

  if (!resend) {
    logger.warn({ eventId }, "RSVP emails skipped — RESEND_API_KEY not set");
    return;
  }

  const allowed = await trackEmailBudget(attendances.length, "HIGH", "rsvp");
  if (!allowed) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const from = process.env.EMAIL_FROM || "RugbyTrack <rugbytrack@mivia.es>";
  const subject = `Convocatoria: ${event.title}`;
  const eventDate = event.startDate.toLocaleString("es-ES", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const messages = await Promise.all(
    attendances.map(async ({ user }) => ({
      from,
      to: user.email,
      subject,
      html: await render(
        React.createElement(RsvpRequestEmail, {
          userName: user.name ?? "Jugador",
          eventTitle: event.title,
          eventDate,
          eventLocation: event.location ?? "Por confirmar",
          rsvpLink: `${appUrl}/rsvp/${generateRsvpToken(user.id, eventId)}`,
        })
      ),
    }))
  );

  const result = await resend.batch.send(messages);
  if (result.error) {
    logger.error({ eventId, resendError: result.error }, "RSVP batch send failed");
    return;
  }
  logger.info(
    { eventId, count: messages.length, ids: result.data?.data?.map((r) => r.id) },
    "RSVP notifications sent"
  );
}
