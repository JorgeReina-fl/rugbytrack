import "server-only";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendReminderNotification } from "@/lib/resend";
import { apiSuccess, apiUnauthorized, apiError, handleUnknownError } from "@/lib/api-response";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const CRON_SECRET = process.env.CRON_SECRET;

  if (!CRON_SECRET) {
    logger.error("CRON_SECRET is not configured in the environment variables.");
    return apiError("Error interno: configuración de cron faltante", 500);
  }

  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    logger.warn("Unauthorized access attempt to cron reminders endpoint");
    return apiUnauthorized();
  }

  try {
    const now = new Date();
    const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const next48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    // Busca eventos que inicien en las próximas 24 a 48 horas
    const events = await prisma.event.findMany({
      where: {
        startDate: {
          gte: next24h,
          lte: next48h,
        },
      },
      include: {
        attendances: {
          where: {
            status: "PENDING",
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    let sentCount = 0;

    for (const event of events) {
      for (const att of event.attendances) {
        const rsvpLink = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/events/${event.id}`;

        // Fire-and-forget recordatorio asíncrono
        sendReminderNotification({
          to: att.user.email,
          userName: att.user.name,
          eventTitle: event.title,
          eventDate: event.startDate.toLocaleString("es-ES"),
          rsvpLink,
        }).catch((emailErr) => {
          logger.error({ err: emailErr, userId: att.userId, eventId: event.id }, "Failed to send async cron reminder email");
        });

        sentCount++;
      }
    }

    logger.info({ sentCount }, "Cron reminders job processed successfully");
    return apiSuccess({
      message: "Recordatorios procesados correctamente",
      sent: sentCount,
    });
  } catch (err) {
    return handleUnknownError(err, "GET /api/cron/reminders");
  }
}
