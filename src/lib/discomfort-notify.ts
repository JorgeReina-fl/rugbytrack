import "server-only";
import * as React from "react";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { trackEmailBudget } from "@/lib/email-budget";
import { sendEmail } from "@/lib/resend";
import { DiscomfortReportedEmail } from "@/emails/discomfort-reported";
import { errInfo } from "@/lib/log-safe";

/**
 * Avisa a los coaches activos del equipo de que hay una molestia nueva sin ver en el evento.
 * Dato de salud: ni el email ni los logs llevan jugador, zona, intensidad ni nota.
 * Nunca lanza: si falla, la molestia ya está guardada.
 *
 * Solo a coaches con notifyDiscomforts activado. La insignia y la lista en la app no dependen de la preferencia.
 */
export async function notifyCoachesOfDiscomfort(event: { id: string; teamId: string; title: string }): Promise<void> {
  try {
    const coaches = await prisma.teamMember.findMany({
      where: { teamId: event.teamId, isCoach: true, leftAt: null, user: { notifyDiscomforts: true } },
      select: { user: { select: { email: true } } },
    });
    if (coaches.length === 0) return;

    const allowed = await trackEmailBudget(coaches.length, "HIGH", "discomfort-notification");
    if (!allowed) return;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
    const eventLink = `${appUrl}/events/${event.id}`;
    await Promise.all(
      coaches.map(({ user }) =>
        sendEmail({
          to: user.email,
          subject: `Molestia reportada: ${event.title}`,
          react: React.createElement(DiscomfortReportedEmail, { eventTitle: event.title, eventLink }),
        })
      )
    );
  } catch (err) {
    logger.error({ eventId: event.id, err: errInfo(err) }, "Discomfort notification failed");
  }
}
