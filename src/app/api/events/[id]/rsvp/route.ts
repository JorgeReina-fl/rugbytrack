import "server-only";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { setRsvp } from "@/lib/attendance-write";
import { rsvpSchema } from "@/modules/events/events.schema";
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiError,
  handleZodError,
  handleUnknownError,
} from "@/lib/api-response";
import { ZodError } from "zod";

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
    });

    if (!event) {
      return apiNotFound("Evento");
    }

    // Valida que el jugador sea miembro activo del equipo del evento
    const membership = await prisma.teamMember.findFirst({
      where: { userId: session.user.id, teamId: event.teamId, leftAt: null },
    });

    if (!membership) {
      return apiForbidden();
    }

    const body = await request.json();
    const data = rsvpSchema.parse(body);

    const result = await setRsvp(id, session.user.id, data.status, new Date(), {
      createIfMissing: true,
    });

    if (!result.ok) {
      if (result.reason === "EVENT_NOT_FOUND") return apiNotFound("Evento");
      return apiError("La fecha límite para confirmar asistencia ha expirado", 409);
    }

    return apiSuccess({ eventId: id, userId: session.user.id, status: result.status });
  } catch (err) {
    if (err instanceof ZodError) return handleZodError(err);
    return handleUnknownError(err, "POST /api/events/[id]/rsvp");
  }
}
