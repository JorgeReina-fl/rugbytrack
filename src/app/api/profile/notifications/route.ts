import "server-only";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z, ZodError } from "zod";
import {
  apiSuccess,
  apiUnauthorized,
  handleZodError,
  handleUnknownError,
} from "@/lib/api-response";

const notificationsSchema = z
  .object({
    notifyPolls: z.boolean().optional(),
    notifyProposals: z.boolean().optional(),
    notifyForumThreads: z.boolean().optional(),
    notifyRsvpReminders: z.boolean().optional(),
  })
  .refine(
    (d) => Object.values(d).some((v) => v !== undefined),
    { message: "Al menos un campo es requerido" }
  );

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return apiUnauthorized();

    const body = await request.json();
    const parsed = notificationsSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const data = Object.fromEntries(
      Object.entries(parsed.data).filter(([, v]) => v !== undefined)
    ) as Record<string, boolean>;

    await prisma.user.update({
      where: { id: session.user.id },
      data,
    });

    return apiSuccess({ updated: data });
  } catch (err) {
    if (err instanceof ZodError) return handleZodError(err);
    return handleUnknownError(err, "PATCH /api/profile/notifications");
  }
}
