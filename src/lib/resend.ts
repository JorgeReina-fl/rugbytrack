import "server-only";
import * as React from "react";
import { Resend } from "resend";
import { render } from "@react-email/components";
import { logger } from "@/lib/logger";
import { CallupCreatedEmail } from "@/emails/callup-created";
import { ReminderEmail } from "@/emails/reminder";

const RESEND_API_KEY = process.env.RESEND_API_KEY;

export const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

if (!resend) {
  logger.warn("RESEND_API_KEY is not defined in environment variables. Email notifications will be skipped.");
}

interface SendEmailParams {
  to: string;
  subject: string;
  react: React.ReactElement;
}

export async function sendEmail({ to, subject, react }: SendEmailParams) {
  if (!resend) {
    logger.info({ to, subject }, "Skipping email send (RESEND_API_KEY missing)");
    return { id: "mock-id" };
  }

  try {
    const html = await render(react);
    const data = await resend.emails.send({
      from: "RugbyTrack <onboarding@resend.dev>", // Usamos el remitente de prueba en desarrollo/sandbox
      to,
      subject,
      html,
    });
    logger.info({ to, subject, emailId: data.data?.id }, "Email sent successfully");
    return data;
  } catch (err) {
    logger.error({ err, to, subject }, "Failed to send email via Resend");
    // No arrojamos el error para no romper flujos principales del servidor
    return null;
  }
}

export async function sendCallupNotification({
  to,
  userName,
  eventTitle,
  eventDate,
  eventLocation,
  rsvpLink,
}: {
  to: string;
  userName: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  rsvpLink: string;
}) {
  return sendEmail({
    to,
    subject: `📋 Nueva Convocatoria: ${eventTitle}`,
    react: React.createElement(CallupCreatedEmail, {
      userName,
      eventTitle,
      eventDate,
      eventLocation,
      rsvpLink,
    }),
  });
}

export async function sendReminderNotification({
  to,
  userName,
  eventTitle,
  eventDate,
  rsvpLink,
}: {
  to: string;
  userName: string;
  eventTitle: string;
  eventDate: string;
  rsvpLink: string;
}) {
  return sendEmail({
    to,
    subject: `⏰ Recordatorio: Confirma tu asistencia para ${eventTitle}`,
    react: React.createElement(ReminderEmail, {
      userName,
      eventTitle,
      eventDate,
      rsvpLink,
    }),
  });
}
