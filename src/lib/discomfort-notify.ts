import "server-only";
import * as React from "react";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { trackEmailBudget } from "@/lib/email-budget";
import { sendEmail } from "@/lib/resend";
import { DiscomfortReportedEmail } from "@/emails/discomfort-reported";

/**
 * Avisa a los coaches activos del equipo de que hay una molestia nueva sin ver en el evento.
 * Dato de salud: ni el email ni los logs llevan jugador, zona, intensidad ni nota.
 * Nunca lanza: si falla, la molestia ya está guardada.
 *
 * No hay preferencia de notificación específica para este aviso (las notify* del usuario
 * son de encuestas, propuestas, foro y recordatorios RSVP), así que no se filtra por ellas.
 */
export async function notifyCoachesOfDiscomfort(event: { id: string; teamId: string; title: string }): Promise<void> {
  try {
    const coaches = await prisma.teamMember.findMany({
      where: { teamId: event.teamId, isCoach: true, leftAt: null },
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
    logger.error({ eventId: event.id, errMessage: err instanceof Error ? err.message : "unknown" }, "Discomfort notification failed");
  }
}
