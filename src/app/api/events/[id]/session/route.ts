import "server-only";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sessionActionSchema } from "@/modules/events/events.schema";
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

export async function POST(
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

    const body = await request.json();
    const data = sessionActionSchema.parse(body);

    if (!REDIS_URL) {
      throw new Error("REDIS_URL is not defined in environment variables");
    }

    const redisLocal = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
    const sessionKey = `session:active:${id}`;

    const active = data.action === "start";

    if (active) {
      // Inicia sesión: guarda en Redis con TTL de 4 horas (14400 segundos)
      await redisLocal.set(sessionKey, "active", "EX", 14400);
    } else {
      // Detiene sesión: elimina de Redis
      await redisLocal.del(sessionKey);
    }

    // Publica en canal Redis pub/sub para que el servidor de Socket.io se entere y retransmita
    await redisLocal.publish(
      "session:status",
      JSON.stringify({
        eventId: id,
        active,
      })
    );

    await redisLocal.quit();

    return apiSuccess({
      eventId: id,
      active,
    });
  } catch (err) {
    if (err instanceof ZodError) return handleZodError(err);
    return handleUnknownError(err, "POST /api/events/[id]/session");
  }
}
