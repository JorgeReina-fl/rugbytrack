export interface ResetEmailTemplateParams {
  appName: string;
  appLogoUrl?: string | undefined;
  primaryColor?: string | undefined;
  resetUrl: string;
  expiresInMinutes: number;
}

const DEFAULT_PRIMARY = "#0f172a";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderResetEmailHtml(p: ResetEmailTemplateParams): string {
  const primary = p.primaryColor ?? DEFAULT_PRIMARY;
  const appName = escapeHtml(p.appName);
  const url = escapeHtml(p.resetUrl);
  const logo = p.appLogoUrl
    ? `<img src="${escapeHtml(p.appLogoUrl)}" alt="${appName}" style="height:40px;display:block;margin:0 auto 16px">`
    : "";

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Recuperar contraseña — ${appName}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f4f4f5;padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e5e7eb">
        <tr><td align="center">${logo}
          <h1 style="margin:0 0 8px;font-size:20px;color:${primary};letter-spacing:.02em">Recupera tu contraseña</h1>
          <p style="margin:0 0 24px;font-size:14px;color:#475569">Recibimos una solicitud para restablecer tu contraseña en <strong>${appName}</strong>.</p>
          <a href="${url}" style="display:inline-block;background:${primary};color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:12px;font-weight:700;font-size:14px">Restablecer contraseña</a>
          <p style="margin:24px 0 8px;font-size:12px;color:#64748b">El enlace caduca en ${p.expiresInMinutes} minutos y sólo puede usarse una vez.</p>
          <p style="margin:0 0 24px;font-size:12px;color:#64748b">Si no fuiste tú, ignora este mensaje — tu contraseña no cambiará.</p>
          <p style="margin:0;font-size:11px;color:#94a3b8;word-break:break-all">Si el botón no funciona, copia este enlace:<br><span style="color:#64748b">${url}</span></p>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:11px;color:#94a3b8">© ${new Date().getFullYear()} ${appName}</p>
    </td></tr>
  </table>
</body></html>`;
}

export function renderResetEmailText(p: ResetEmailTemplateParams): string {
  return [
    `Recuperar contraseña — ${p.appName}`,
    "",
    `Recibimos una solicitud para restablecer tu contraseña en ${p.appName}.`,
    "",
    `Abre este enlace para restablecerla (caduca en ${p.expiresInMinutes} minutos, un solo uso):`,
    p.resetUrl,
    "",
    "Si no fuiste tú, ignora este mensaje.",
  ].join("\n");
}
