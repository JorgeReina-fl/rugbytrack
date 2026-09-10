/**
 * send-rsvp-reminders.ts — Cron de recordatorio de RSVP 24h antes del evento.
 *
 * Busca eventos cuya fecha esté entre 23h y 25h desde ahora.
 * Para cada uno, envía recordatorio a miembros con Attendance PENDING
 * que aún no hayan recibido el recordatorio (reminderSentAt IS NULL).
 * Marca reminderSentAt al enviar para evitar reenvío si el cron corre varias veces.
 *
 * Uso standalone (dentro del container):
 *   node --experimental-strip-types --no-warnings /app/prisma/send-rsvp-reminders.ts
 *
 * Depende solo de @prisma/client y fetch nativo (Node 22) — no requiere el
 * paquete 'resend' ni otros módulos ausentes en el standalone build.
 */

import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// RSVP token (misma lógica que src/lib/tokens.ts)
// ---------------------------------------------------------------------------

function generateRsvpToken(userId: string, eventId: string): string {
  const payloadStr = JSON.stringify({
    userId,
    eventId,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });
  const secret = process.env.NEXTAUTH_SECRET || "fallback_secret_for_development";
  const hmac = crypto.createHmac("sha256", secret).update(payloadStr).digest("hex");
  return Buffer.from(JSON.stringify({ payload: payloadStr, hmac })).toString("base64url");
}

// ---------------------------------------------------------------------------
// Email HTML (inline — evita importar @react-email fuera de Next.js)
// ---------------------------------------------------------------------------

function buildReminderHtml(opts: {
  userName: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  rsvpLink: string;
}): string {
  const { userName, eventTitle, eventDate, eventLocation, rsvpLink } = opts;
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f9fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Ubuntu,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 0">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;padding:24px 48px 40px;max-width:560px">
      <tr><td>
        <p style="color:#808CFD;font-size:13px;font-weight:bold;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 20px">RugbyTrack</p>
        <p style="color:#333;font-size:15px;line-height:24px;margin:0 0 14px">Hola ${userName},</p>
        <p style="color:#333;font-size:15px;line-height:24px;margin:0 0 14px">Mañana tienes un evento y aún no has confirmado tu asistencia. El entrenador necesita saber si cuentan contigo:</p>
        <div style="background:#f4f4f5;border:1px solid #e4e4e7;border-radius:6px;padding:12px 16px;margin:0 0 14px">
          <p style="color:#444;font-size:14px;line-height:22px;margin:2px 0"><strong>Evento:</strong> ${eventTitle}</p>
          <p style="color:#444;font-size:14px;line-height:22px;margin:2px 0"><strong>Fecha:</strong> ${eventDate}</p>
          <p style="color:#444;font-size:14px;line-height:22px;margin:2px 0"><strong>Lugar:</strong> ${eventLocation}</p>
        </div>
        <p style="color:#333;font-size:15px;line-height:24px;margin:0 0 14px">
          <a href="${rsvpLink}" style="color:#808CFD;text-decoration:underline;font-weight:bold">Confirmar / declinar asistencia &#8594;</a>
        </p>
        <p style="color:#9ca3af;font-size:11px;line-height:16px;margin-top:32px;border-top:1px solid #e4e4e7;padding-top:16px">RugbyTrack &#8212; Gestión de rugby amateur</p>
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Resend batch via fetch (sin paquete 'resend' — standalone compatible)
// ---------------------------------------------------------------------------

interface ResendMessage {
  from: string;
  to: string;
  subject: string;
  html: string;
}

interface ResendBatchResult {
  data?: { data?: { id: string }[] } | null;
  error?: { message: string; name: string } | null;
}

async function resendBatchSend(messages: ResendMessage[], apiKey: string): Promise<ResendBatchResult> {
  const res = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });
  return res.json() as Promise<ResendBatchResult>;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const now = new Date();
  const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  console.log(`[${now.toISOString()}] Ventana: ${windowStart.toISOString()} → ${windowEnd.toISOString()}`);

  const events = await prisma.event.findMany({
    where: { startDate: { gte: windowStart, lte: windowEnd } },
    select: { id: true, title: true, startDate: true, location: true },
  });

  console.log(`Eventos en ventana 24h: ${events.length}`);

  if (events.length === 0) {
    await prisma.$disconnect();
    return;
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.warn("RESEND_API_KEY no definido — abortando");
    await prisma.$disconnect();
    return;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const from = process.env.EMAIL_FROM || "RugbyTrack <rugbytrack@mivia.es>";

  let totalSent = 0;

  for (const event of events) {
    const attendances = await prisma.attendance.findMany({
      where: { eventId: event.id, status: "PENDING", reminderSentAt: null },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    if (attendances.length === 0) {
      console.log(`  [${event.id}] "${event.title}" — sin pendientes sin recordatorio`);
      continue;
    }

    const eventDate = event.startDate.toLocaleString("es-ES", {
      weekday: "long", day: "numeric", month: "long",
      year: "numeric", hour: "2-digit", minute: "2-digit",
    });

    const messages: ResendMessage[] = attendances.map(({ user }) => ({
      from,
      to: user.email,
      subject: `Recuerda confirmar tu asistencia — ${event.title} es mañana`,
      html: buildReminderHtml({
        userName: user.name ?? "Jugador",
        eventTitle: event.title,
        eventDate,
        eventLocation: event.location ?? "Por confirmar",
        rsvpLink: `${appUrl}/rsvp/${generateRsvpToken(user.id, event.id)}`,
      }),
    }));

    const result = await resendBatchSend(messages, resendKey);

    if (result.error) {
      console.error(`  [${event.id}] ERROR Resend: ${result.error.name} — ${result.error.message}`);
      continue;
    }

    // Marcar reminderSentAt para todos los enviados (idempotencia)
    await prisma.attendance.updateMany({
      where: { eventId: event.id, userId: { in: attendances.map((a) => a.user.id) } },
      data: { reminderSentAt: now },
    });

    const ids = result.data?.data?.map((r) => r.id) ?? [];
    console.log(`  [${event.id}] "${event.title}" — ${messages.length} recordatorios. IDs: ${ids.join(", ")}`);
    totalSent += messages.length;
  }

  console.log(`\nTotal enviados: ${totalSent}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error fatal:", err);
  prisma.$disconnect().finally(() => process.exit(1));
});
