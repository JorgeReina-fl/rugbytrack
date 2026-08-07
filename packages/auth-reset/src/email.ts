import nodemailer from "nodemailer";
import { renderResetEmailHtml, renderResetEmailText } from "./template";

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  /** true = implicit TLS (465), false = STARTTLS/plain (25/587). Default: derived from port. */
  secure?: boolean;
  /** Ignore self-signed certs (dev only). Default false. */
  ignoreTls?: boolean;
}

export interface SendResetEmailParams {
  to: string;
  resetUrl: string;
  smtp: SmtpConfig;
  from: string;
  appName: string;
  appLogoUrl?: string;
  primaryColor?: string;
  expiresInMinutes: number;
  subject?: string;
}

export interface SendResetEmailResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
}

export async function sendResetEmail(
  params: SendResetEmailParams
): Promise<SendResetEmailResult> {
  const { to, resetUrl, smtp, from, appName, appLogoUrl, primaryColor, expiresInMinutes } = params;

  const secure = smtp.secure ?? smtp.port === 465;
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure,
    auth: { user: smtp.user, pass: smtp.pass },
    tls: smtp.ignoreTls ? { rejectUnauthorized: false } : undefined,
  });

  const html = renderResetEmailHtml({
    appName,
    appLogoUrl,
    primaryColor,
    resetUrl,
    expiresInMinutes,
  });
  const text = renderResetEmailText({
    appName,
    appLogoUrl,
    primaryColor,
    resetUrl,
    expiresInMinutes,
  });

  const info = await transporter.sendMail({
    from,
    to,
    subject: params.subject ?? `Recupera tu contraseña — ${appName}`,
    text,
    html,
  });

  return {
    messageId: info.messageId,
    accepted: (info.accepted as string[]) ?? [],
    rejected: (info.rejected as string[]) ?? [],
  };
}
