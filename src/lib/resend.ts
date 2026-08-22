import "server-only";
import * as React from "react";
import { Resend } from "resend";
import { render } from "@react-email/components";
import { logger } from "@/lib/logger";
import { CallupCreatedEmail } from "@/emails/callup-created";
import { ReminderEmail } from "@/emails/reminder";
import { PollCreatedEmail } from "@/emails/poll-created";
import { ProposalCreatedEmail } from "@/emails/proposal-created";

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
      from: process.env.EMAIL_FROM || "RugbyTrack <rugbytrack@mivia.es>",
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

export async function sendPollNotification({
  members,
  teamName,
  teamId,
  pollTitle,
}: {
  members: { email: string; name: string | null }[];
  teamName: string;
  teamId: string;
  pollTitle: string;
}) {
  if (!resend || members.length === 0) {
    logger.info({ teamId, pollTitle, count: members.length }, "Skipping poll notification (no resend or no members)");
    return;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  const pollLink = `${appUrl}/teams/${teamId}/polls`;
  const from = process.env.EMAIL_FROM || "RugbyTrack <rugbytrack@mivia.es>";
  const subject = `Nueva encuesta en ${teamName}: ${pollTitle}`;

  try {
    const messages = await Promise.all(
      members.map(async ({ email, name }) => ({
        from,
        to: email,
        subject,
        html: await render(
          React.createElement(PollCreatedEmail, {
            userName: name ?? "Miembro",
            teamName,
            pollTitle,
            pollLink,
          })
        ),
      }))
    );

    const result = await resend.batch.send(messages);
    logger.info({ teamId, pollTitle, count: members.length, ids: result.data?.data?.map((r: { id: string }) => r.id) }, "Poll notification batch sent");
  } catch (err) {
    logger.error({ err, teamId, pollTitle }, "Failed to send poll notification batch");
  }
}

export async function sendProposalNotification({
  members,
  teamName,
  teamId,
  proposalTitle,
  authorName,
}: {
  members: { email: string; name: string | null }[];
  teamName: string;
  teamId: string;
  proposalTitle: string;
  authorName: string;
}) {
  if (!resend || members.length === 0) {
    logger.info({ teamId, proposalTitle, count: members.length }, "Skipping proposal notification (no resend or no members)");
    return;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  const proposalLink = `${appUrl}/teams/${teamId}/proposals`;
  const from = process.env.EMAIL_FROM || "RugbyTrack <rugbytrack@mivia.es>";
  const subject = `Nueva propuesta en ${teamName}: ${proposalTitle}`;

  try {
    const messages = await Promise.all(
      members.map(async ({ email, name }) => ({
        from,
        to: email,
        subject,
        html: await render(
          React.createElement(ProposalCreatedEmail, {
            userName: name ?? "Miembro",
            teamName,
            proposalTitle,
            proposalLink,
            authorName,
          })
        ),
      }))
    );

    const result = await resend.batch.send(messages);
    logger.info({ teamId, proposalTitle, count: members.length, ids: result.data?.data?.map((r: { id: string }) => r.id) }, "Proposal notification batch sent");
  } catch (err) {
    logger.error({ err, teamId, proposalTitle }, "Failed to send proposal notification batch");
  }
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
