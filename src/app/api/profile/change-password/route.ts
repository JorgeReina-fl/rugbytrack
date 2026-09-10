import "server-only";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { z, ZodError } from "zod";
import {
  apiSuccess,
  apiUnauthorized,
  apiError,
  handleZodError,
  handleUnknownError,
} from "@/lib/api-response";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "La contraseña actual es requerida"),
    newPassword: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres")
      .max(128),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return apiUnauthorized();

    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { currentPassword, newPassword } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, passwordHash: true },
    });

    if (!user?.passwordHash) {
      return apiError("Esta cuenta no tiene contraseña configurada", 400);
    }

    const argon2 = await import("argon2");
    const valid = await argon2.verify(user.passwordHash, currentPassword);
    if (!valid) {
      logger.warn({ userId: user.id }, "Failed password change — wrong current password");
      return apiError("La contraseña actual es incorrecta", 400);
    }

    const newHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        // Invalidates email-reset tokens issued before now.
        // JWT sessions are stateless (30-day maxAge) and remain active after this change.
        passwordResetAt: new Date(),
      },
    });

    logger.info({ userId: user.id }, "Password changed by authenticated user");

    return apiSuccess({
      message: "Contraseña actualizada correctamente.",
    });
  } catch (err) {
    if (err instanceof ZodError) return handleZodError(err);
    return handleUnknownError(err, "POST /api/profile/change-password");
  }
}
