import { prisma } from "@/lib/prisma";
import { z, ZodError } from "zod";
import {
  apiSuccess,
  apiError,
  handleZodError,
  handleUnknownError,
} from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { createResetToken, sendResetEmail } from "@mivia/auth-reset";

const forgotSchema = z.object({
  email: z.string().email().toLowerCase().trim().max(254),
});

// Respuesta SIEMPRE neutra para no filtrar existencia de cuentas.
const NEUTRAL_MESSAGE =
  "Si el email existe en nuestra base de datos, recibirás un enlace para restablecer tu contraseña.";

// Rate limit: 3 solicitudes por hora, clave IP+email (best-effort).
const RATE_LIMIT = 3;
const RATE_WINDOW_SECONDS = 60 * 60;
const TOKEN_EXPIRES_MIN = 60;

function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = forgotSchema.parse(body);
    const ip = getClientIp(request);

    // Rate limit ANTES de tocar BBDD (mitigación DoS/enumeración por timing).
    const rl = await checkRateLimit(
      `pwreset:${ip}:${email}`,
      RATE_LIMIT,
      RATE_WINDOW_SECONDS
    );
    if (!rl.allowed) {
      return apiError(
        `Has superado el límite de solicitudes. Vuelve a intentarlo en ${Math.ceil(rl.resetInSeconds / 60)} minutos.`,
        429
      );
    }

    const secret = process.env.AUTH_RESET_SECRET;
    if (!secret) {
      logger.error("AUTH_RESET_SECRET no definido — /forgot-password no puede firmar tokens");
      return apiError("El servicio no está disponible temporalmente", 503);
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });

    // Existe → firmar y enviar. Cualquier fallo de envío se loggea pero devolvemos neutro.
    if (user) {
      try {
        const token = createResetToken({
          email: user.email,
          secret,
          expiresInMinutes: TOKEN_EXPIRES_MIN,
        });
        const baseUrl =
          process.env.NEXT_PUBLIC_APP_URL ?? "https://rugbytrack.mivia.es";
        const resetUrl = `${baseUrl.replace(/\/$/, "")}/reset-password/${encodeURIComponent(token)}`;

        const smtpHost = process.env.SMTP_HOST;
        const smtpPort = Number(process.env.SMTP_PORT ?? "587");
        const smtpUser = process.env.SMTP_USER;
        const smtpPass = process.env.SMTP_PASS;
        const from = process.env.EMAIL_FROM ?? "RugbyTrack <rugbytrack@mivia.es>";

        if (!smtpHost || !smtpUser || !smtpPass) {
          logger.error("SMTP_* incompleto — no se envía email de reset");
        } else {
          await sendResetEmail({
            to: user.email,
            resetUrl,
            smtp: { host: smtpHost, port: smtpPort, user: smtpUser, pass: smtpPass },
            from,
            appName: "RugbyTrack",
            appLogoUrl: `${baseUrl.replace(/\/$/, "")}/logo.png`,
            primaryColor: "#0f172a",
            expiresInMinutes: TOKEN_EXPIRES_MIN,
          });
          logger.info({ email: user.email }, "password reset email sent");
        }
      } catch (sendErr) {
        logger.error({ err: sendErr, email: user.email }, "failed to send password reset email");
      }
    } else {
      logger.info({ email }, "password reset requested for unknown email — neutral response");
    }

    return apiSuccess({ message: NEUTRAL_MESSAGE });
  } catch (err) {
    if (err instanceof ZodError) return handleZodError(err);
    return handleUnknownError(err, "POST /api/auth/forgot-password");
  }
}
