import "server-only";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  handleUnknownError,
} from "@/lib/api-response";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return apiUnauthorized();

  try {
    const { id } = await params;
    const event = await prisma.event.findUnique({
      where: { id },
      select: { teamId: true },
    });

    if (!event) {
      return apiNotFound("Evento");
    }

    // Valida que el usuario sea COACH en el equipo del evento
    const membership = await prisma.teamMember.findFirst({
      where: { userId: session.user.id, teamId: event.teamId, isCoach: true },
    });

    if (!membership) {
      return apiForbidden();
    }

    // Obtiene la lista de asistencia del evento
    const attendances = await prisma.attendance.findMany({
      where: { eventId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            memberships: {
              where: { teamId: event.teamId },
              select: {
                position: true,
                jerseyNumber: true,
              },
            },
          },
        },
      },
      orderBy: {
        user: {
          name: "asc",
        },
      },
    });

    // Mapea a un formato de respuesta limpio
    const attendanceList = attendances.map((att) => {
      const memberDetails = att.user.memberships[0] ?? null;
      return {
        userId: att.userId,
        name: att.user.name,
        image: att.user.image,
        position: memberDetails?.position ?? null,
        jerseyNumber: memberDetails?.jerseyNumber ?? null,
        status: att.status,
        checkedIn: att.checkedIn,
        checkedInAt: att.checkedInAt?.toISOString() ?? null,
      };
    });

    return apiSuccess(attendanceList);
  } catch (err) {
    return handleUnknownError(err, "GET /api/events/[id]/attendance");
  }
}
