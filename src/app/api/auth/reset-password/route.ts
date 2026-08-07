import { prisma } from "@/lib/prisma";
import { z, ZodError } from "zod";
import {
  apiSuccess,
  apiError,
  handleZodError,
  handleUnknownError,
} from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { verifyResetToken } from "@mivia/auth-reset";

const resetSchema = z.object({
  token: z.string().min(10).max(4096),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(128),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, password } = resetSchema.parse(body);

    const secret = process.env.AUTH_RESET_SECRET;
    if (!secret) {
      logger.error("AUTH_RESET_SECRET no definido — /reset-password no puede verificar tokens");
      return apiError("El servicio no está disponible temporalmente", 503);
    }

    const check = verifyResetToken({ token, secret });
    if (!check.valid) {
      return apiError(
        check.expired
          ? "El enlace ha caducado. Solicita uno nuevo."
          : "El enlace no es válido.",
        400
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: check.email },
      select: { id: true, email: true, passwordResetAt: true },
    });

    if (!user) {
      // Firma válida pero email inexistente — respuesta genérica, no filtrar.
      return apiError("El enlace no es válido.", 400);
    }

    // Single-use: si el token se emitió antes del último reset, ya fue consumido.
    if (user.passwordResetAt && check.iat <= user.passwordResetAt.getTime()) {
      return apiError("Este enlace ya ha sido utilizado. Solicita uno nuevo.", 400);
    }

    const argon2 = await import("argon2");
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetAt: new Date(),
      },
    });

    logger.info({ userId: user.id }, "password reset completed");

    return apiSuccess({ message: "Contraseña actualizada. Ya puedes iniciar sesión." });
  } catch (err) {
    if (err instanceof ZodError) return handleZodError(err);
    return handleUnknownError(err, "POST /api/auth/reset-password");
  }
}
