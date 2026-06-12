import "server-only";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { manualAttendanceSchema } from "@/modules/events/events.schema";
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  handleZodError,
  handleUnknownError,
} from "@/lib/api-response";
import { ZodError } from "zod";
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return apiUnauthorized();

  try {
    const { id, userId } = await params;
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

    const body = await request.json();
    const data = manualAttendanceSchema.parse(body);

    const checkedInAt = data.checkedIn ? new Date() : null;

    const attendance = await prisma.attendance.upsert({
      where: {
        eventId_userId: {
          eventId: id,
          userId: userId,
        },
      },
      update: {
        checkedIn: data.checkedIn,
        checkedInAt: checkedInAt,
        status: data.status,
      },
      create: {
        eventId: id,
        userId: userId,
        checkedIn: data.checkedIn,
        checkedInAt: checkedInAt,
        status: data.status,
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    // Publica el cambio en Redis para que el servidor Socket.io lo retransmita en tiempo real
    if (REDIS_URL) {
      const redisPublisher = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
      await redisPublisher.publish(
        "attendance:update",
        JSON.stringify({
          eventId: id,
          userId: userId,
          name: attendance.user.name,
          checkedIn: attendance.checkedIn,
          checkedInAt: attendance.checkedInAt?.toISOString() ?? null,
          status: attendance.status,
        })
      );
      await redisPublisher.quit();
    }

    return apiSuccess(attendance);
  } catch (err) {
    if (err instanceof ZodError) return handleZodError(err);
    return handleUnknownError(err, "PATCH /api/events/[id]/attendance/[userId]");
  }
}
