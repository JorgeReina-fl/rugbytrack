import "server-only";
import * as React from "react";
import { Resend } from "resend";
import { render } from "@react-email/components";
import { logger } from "@/lib/logger";
import { trackEmailBudget } from "@/lib/email-budget";
import { CallupCreatedEmail } from "@/emails/callup-created";
import { ReminderEmail } from "@/emails/reminder";
import { PollCreatedEmail } from "@/emails/poll-created";
import { ProposalCreatedEmail } from "@/emails/proposal-created";
import { ThreadCreatedEmail } from "@/emails/thread-created";

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
  const allowed = await trackEmailBudget(1, "HIGH", "callup");
  if (!allowed) return null;

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

  const allowed = await trackEmailBudget(members.length, "LOW", "poll-notification");
  if (!allowed) return;

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
    if (result.error) {
      logger.error({ teamId, pollTitle, resendError: result.error }, "Resend batch returned error");
      return;
    }
    logger.info({ teamId, pollTitle, count: members.length, ids: result.data?.data?.map((r) => r.id) }, "Poll notification batch sent");
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

  const allowed = await trackEmailBudget(members.length, "LOW", "proposal-notification");
  if (!allowed) return;

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
    if (result.error) {
      logger.error({ teamId, proposalTitle, resendError: result.error }, "Resend batch returned error");
      return;
    }
    logger.info({ teamId, proposalTitle, count: members.length, ids: result.data?.data?.map((r) => r.id) }, "Proposal notification batch sent");
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
  const allowed = await trackEmailBudget(1, "LOW", "reminder");
  if (!allowed) return null;

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

export async function sendThreadNotification({
  members,
  teamName,
  teamId,
  threadId,
  threadTitle,
  authorName,
}: {
  members: { email: string; name: string | null }[];
  teamName: string;
  teamId: string;
  threadId: string;
  threadTitle: string;
  authorName: string;
}) {
  if (!resend || members.length === 0) {
    logger.info({ teamId, threadId, count: members.length }, "Skipping thread notification (no resend or no members)");
    return;
  }

  const allowed = await trackEmailBudget(members.length, "LOW", "thread-notification");
  if (!allowed) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  const threadLink = `${appUrl}/teams/${teamId}/forum/${threadId}`;
  const from = process.env.EMAIL_FROM || "RugbyTrack <rugbytrack@mivia.es>";
  const subject = `Nuevo hilo en ${teamName}: ${threadTitle}`;

  try {
    const messages = await Promise.all(
      members.map(async ({ email, name }) => ({
        from,
        to: email,
        subject,
        html: await render(
          React.createElement(ThreadCreatedEmail, {
            userName: name ?? "Miembro",
            teamName,
            threadTitle,
            authorName,
            threadLink,
          })
        ),
      }))
    );

    const result = await resend.batch.send(messages);
    if (result.error) {
      logger.error({ teamId, threadId, resendError: result.error }, "Resend batch returned error");
      return;
    }
    logger.info({ teamId, threadId, count: members.length, ids: result.data?.data?.map((r) => r.id) }, "Thread notification batch sent");
  } catch (err) {
    logger.error({ err, teamId, threadId }, "Failed to send thread notification batch");
  }
}
