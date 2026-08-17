import "server-only";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiError,
  handleUnknownError,
} from "@/lib/api-response";
import { z } from "zod";

interface Params {
  params: Promise<{ id: string; userId: string }>;
}

const bodySchema = z.object({
  isCoach: z.boolean(),
});

/** PATCH /api/teams/[id]/members/[userId]/role — Coach promotes/demotes a member */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return apiUnauthorized();

    const { id: teamId, userId: targetUserId } = await params;

    // Caller must be active coach
    const callerMembership = await prisma.teamMember.findFirst({
      where: { userId: session.user.id, teamId, isCoach: true, leftAt: null },
    });
    if (!callerMembership) return apiForbidden();

    // Cannot change own role via this endpoint
    if (session.user.id === targetUserId) {
      return apiError("No puedes modificar tu propio rol por esta vía", 400);
    }

    const target = await prisma.teamMember.findFirst({
      where: { userId: targetUserId, teamId, leftAt: null },
    });
    if (!target) return apiNotFound("Miembro");

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Body JSON inválido", 400);
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Se requiere { isCoach: boolean }", 422);
    }

    const { isCoach } = parsed.data;

    // Prevent demoting the last coach
    if (!isCoach && target.isCoach) {
      const activeCoachCount = await prisma.teamMember.count({
        where: { teamId, isCoach: true, leftAt: null },
      });
      if (activeCoachCount <= 1) {
        return apiError("No puedes quitar el rol al único coach activo del equipo", 400);
      }
    }

    const updated = await prisma.teamMember.update({
      where: { id: target.id },
      data: { isCoach },
      select: { userId: true, isCoach: true },
    });

    return apiSuccess({ member: updated });
  } catch (err) {
    return handleUnknownError(err, "PATCH /api/teams/[id]/members/[userId]/role");
  }
}
