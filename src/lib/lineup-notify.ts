import "server-only";
import * as React from "react";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { trackEmailBudget } from "@/lib/email-budget";
import { sendEmail } from "@/lib/resend";
import { sendRsvpNotifications } from "@/lib/rsvp-notify";
import { LineupChangedEmail } from "@/emails/lineup-changed";

export interface LineupDiff {
  entered: string[];
  left: string[];
  /** Quien sigue convocado pero cambia de titular/suplente o de dorsal, con su descripción nueva. */
  changed: { userId: string; description: string }[];
}

/**
 * Avisa solo a las personas afectadas por un cambio de alineación. Sin datos de salud.
 * Nunca lanza: el cambio ya está guardado.
 */
export async function notifyLineupChanges(event: { id: string; title: string }, diff: LineupDiff): Promise<void> {
  try {
    if (diff.entered.length > 0) await sendRsvpNotifications(event.id, diff.entered);

    const others = [...diff.left, ...diff.changed.map((c) => c.userId)];
    if (others.length === 0) return;

    const users = await prisma.user.findMany({
      where: { id: { in: others } },
      select: { id: true, email: true, name: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    const messages = [
      ...diff.left.map((userId) => ({ userId, subject: `Ya no estás convocado para ${event.title}` })),
      ...diff.changed.map((c) => ({
        userId: c.userId,
        subject: `Tu convocatoria para ${event.title} ha cambiado: ${c.description}`,
      })),
    ].filter((m) => byId.has(m.userId));
    if (messages.length === 0) return;

    const allowed = await trackEmailBudget(messages.length, "HIGH", "lineup-change");
    if (!allowed) return;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
    const eventLink = `${appUrl}/events/${event.id}`;
    await Promise.all(
      messages.map(({ userId, subject }) => {
        const user = byId.get(userId)!;
        return sendEmail({
          to: user.email,
          subject,
          react: React.createElement(LineupChangedEmail, {
            userName: user.name ?? "Jugador",
            eventTitle: event.title,
            headline: subject,
            eventLink,
          }),
        });
      })
    );
  } catch (err) {
    logger.error({ eventId: event.id, errMessage: err instanceof Error ? err.message : "unknown" }, "Lineup notification failed");
  }
}
