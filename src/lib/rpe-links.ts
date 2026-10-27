import "server-only";
import * as React from "react";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { trackEmailBudget } from "@/lib/email-budget";
import { sendEmail } from "@/lib/resend";
import { generateRpeToken } from "@/lib/tokens";
import { eventEnd } from "@/lib/attendance";
import { rpeWindow } from "@/lib/rpe-window";
import { eventWhen } from "@/lib/event-when";
import { formatInTz, safeTz } from "@/lib/datetime";
import { RpeLinkEmail } from "@/emails/rpe-link";

import { RPE_LINKS_MIN_INTERVAL_MS } from "@/lib/rpe-links-ui";
import { rpeRecipientsWhere } from "@/lib/rpe-recipients";

export { RPE_LINKS_MIN_INTERVAL_MS };

const EVENT_TYPE_LABEL: Record<string, string> = {
  TRAINING: "Entrenamiento",
  MATCH: "Partido",
  TOURNAMENT: "Torneo",
  TRIP: "Viaje",
  OTHER: "Evento",
};

export type SendRpeLinksResult =
  | { code: "OK"; sent: number; failed: number; skipped: number }
  | { code: "EVENT_NOT_FOUND" | "NOT_ENDED" | "WINDOW_CLOSED" | "SKIPPED" }
  | { code: "TOO_SOON"; retryAt: Date };

/**
 * Envía por email el enlace /rpe/[token] a los jugadores con check-in que aún no tienen RPE.
 * Solo registra en logs eventId, trigger, código y recuentos.
 */
export async function sendRpeLinks(
  eventId: string,
  opts: { trigger: "manual" | "auto"; now: Date },
): Promise<SendRpeLinksResult> {
  const { trigger, now } = opts;
  const done = <T extends SendRpeLinksResult>(result: T): T => {
    logger.info(
      { eventId, trigger, code: result.code, ...(result.code === "OK" && { sent: result.sent, failed: result.failed, skipped: result.skipped }) },
      "RPE links",
    );
    return result;
  };

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      teamId: true,
      title: true,
      type: true,
      startDate: true,
      endDate: true,
      rpeLinksSentAt: true,
      team: { select: { timezone: true, rpeLinksAuto: true } },
    },
  });
  if (!event) return done({ code: "EVENT_NOT_FOUND" });

  const window = rpeWindow(event, now);
  if (now.getTime() < eventEnd(event).getTime()) return done({ code: "NOT_ENDED" });
  if (window.state === "closed") return done({ code: "WINDOW_CLOSED" });

  const previousSentAt = event.rpeLinksSentAt;

  // El automático envía una sola vez y solo si el equipo lo tiene activado: no toca nada si no
  if (trigger === "auto" && (!event.team.rpeLinksAuto || previousSentAt !== null)) {
    return done({ code: "SKIPPED" });
  }

  // Antiduplicados atómico: solo una llamada concurrente consigue marcar el evento
  const claim = await prisma.event.updateMany({
    where:
      trigger === "auto"
        ? { id: eventId, rpeLinksSentAt: null }
        : {
            id: eventId,
            OR: [
              { rpeLinksSentAt: null },
              { rpeLinksSentAt: { lt: new Date(now.getTime() - RPE_LINKS_MIN_INTERVAL_MS) } },
            ],
          },
    data: { rpeLinksSentAt: now },
  });
  if (claim.count === 0) {
    if (trigger === "auto") return done({ code: "SKIPPED" });
    const retryAt = new Date((previousSentAt ?? now).getTime() + RPE_LINKS_MIN_INTERVAL_MS);
    return done({ code: "TOO_SOON", retryAt });
  }

  const recipients = await prisma.attendance.findMany({
    where: rpeRecipientsWhere(eventId, event.teamId),
    select: { user: { select: { id: true, email: true, name: true } } },
  });

  const tz = safeTz(event.team.timezone);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const eventDate = eventWhen(event.startDate, tz, now).dateTime;
  const deadline = formatInTz(window.closesAt, tz, "d 'de' MMMM 'a las' HH:mm 'hs'");
  const subject = `Registra tu RPE: ${event.title}`;

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let budgetExhausted = false;

  for (const { user } of recipients) {
    if (!user.email) {
      skipped++;
      continue;
    }
    if (!budgetExhausted && !(await trackEmailBudget(1, "LOW", "rpe-links"))) budgetExhausted = true;
    if (budgetExhausted) {
      skipped++;
      continue;
    }

    const token = generateRpeToken(user.id, eventId, window.closesAt);
    const result = await sendEmail({
      to: user.email,
      subject,
      react: React.createElement(RpeLinkEmail, {
        userName: user.name ?? "Jugador",
        eventTitle: event.title,
        eventType: EVENT_TYPE_LABEL[event.type] ?? "Evento",
        eventDate,
        deadline,
        rpeLink: `${appUrl}/rpe/${token}`,
      }),
    });
    if (result) sent++;
    else failed++;
  }

  // Si no salió ningún correo y hubo fallos u omisiones, se libera el marcado para poder reintentar
  // (solo si sigue siendo el nuestro: updateMany con rpeLinksSentAt = now)
  if (sent === 0 && failed + skipped > 0) {
    await prisma.event.updateMany({
      where: { id: eventId, rpeLinksSentAt: now },
      data: { rpeLinksSentAt: previousSentAt },
    });
  }

  return done({ code: "OK", sent, failed, skipped });
}
