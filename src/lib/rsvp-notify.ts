import "server-only";
import * as React from "react";
import { render } from "@react-email/components";
import { resend } from "@/lib/resend";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { trackEmailBudget } from "@/lib/email-budget";
import { generateRsvpToken } from "@/lib/tokens";
import { RsvpRequestEmail } from "@/emails/rsvp-request";
import { eventWhen } from "@/lib/event-when";

/**
 * Sends RSVP request emails (with magic-link token) to all PENDING attendance
 * records for the given event (or only to `onlyUserIds`). Safe to call fire-and-forget.
 */
export async function sendRsvpNotifications(eventId: string, onlyUserIds?: string[]): Promise<void> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, teamId: true, title: true, startDate: true, location: true, team: { select: { timezone: true } } },
  });
  if (!event) return;

  const attendances = await prisma.attendance.findMany({
    // Solo miembros activos del equipo del evento: un ex-miembro no recibe convocatorias
    where: { eventId, status: "PENDING", ...(onlyUserIds ? { userId: { in: onlyUserIds } } : {}), user: { memberships: { some: { teamId: event.teamId, leftAt: null } } } },
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
  const eventDate = eventWhen(event.startDate, event.team.timezone, new Date()).dateTime;

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
