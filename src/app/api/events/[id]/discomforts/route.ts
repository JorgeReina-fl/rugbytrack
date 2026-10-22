import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getActiveMembership } from "@/lib/membership";
import { eventEnd } from "@/lib/attendance";
import { hasCurrentConsent } from "@/lib/health-consent";
import { checkRateLimit } from "@/lib/rate-limit";
import { discomfortSchema } from "@/lib/validations/discomfort";
import { notifyCoachesOfDiscomfort } from "@/lib/discomfort-notify";
import { apiError, apiForbidden, apiNotFound, apiUnauthorized, handleUnknownError } from "@/lib/api-response";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/events/[id]/discomforts
 *
 * Jugador activo (no coach) con consentimiento vigente, hasta el fin del evento. Avisa a los
 * coaches (sin detalles) si es la primera molestia sin ver del evento.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return apiUnauthorized();
    const userId = session.user.id;
    const { id: eventId } = await params;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, teamId: true, title: true, startDate: true, endDate: true },
    });
    if (!event) return apiNotFound("Evento");

    const membership = await getActiveMembership(event.teamId, userId);
    if (!membership || membership.isCoach) return apiForbidden();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { healthConsentAt: true, healthConsentVersion: true },
    });
    if (!hasCurrentConsent(user)) {
      return NextResponse.json({ error: "Falta el consentimiento de datos de salud", code: "CONSENT_REQUIRED" }, { status: 403 });
    }

    if (eventEnd(event) < new Date()) return apiError("El evento ya ha terminado", 409);

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 422 });
    }
    const parsed = discomfortSchema.safeParse(json);
    if (!parsed.success) {
      // Sin eco de los valores recibidos: son datos de salud
      return NextResponse.json(
        { error: "Datos inválidos", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
        { status: 422 }
      );
    }

    const rl = await checkRateLimit(`rate_limit:discomfort:${userId}`, 10, 3600);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Inténtalo más tarde." },
        { status: 429, headers: { "Retry-After": String(rl.resetInSeconds) } }
      );
    }

    const unseen = await prisma.discomfort.count({ where: { eventId, seenByCoachAt: null } });

    const discomfort = await prisma.discomfort.create({
      data: { eventId, userId, ...parsed.data },
      select: { id: true, eventId: true, bodyArea: true, intensity: true, note: true, seenByCoachAt: true, createdAt: true },
    });
    logger.info({ discomfortId: discomfort.id, eventId }, "Discomfort created");

    if (unseen === 0) await notifyCoachesOfDiscomfort(event);

    return NextResponse.json({ discomfort }, { status: 201 });
  } catch (error) {
    return handleUnknownError(error, "POST /api/events/[id]/discomforts");
  }
}

/** GET /api/events/[id]/discomforts — el jugador ve las suyas; el coach activo, todas las del evento. */
export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return apiUnauthorized();
    const userId = session.user.id;
    const { id: eventId } = await params;

    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, teamId: true } });
    if (!event) return apiNotFound("Evento");

    const membership = await getActiveMembership(event.teamId, userId);
    if (!membership) return apiForbidden();

    const select = { id: true, userId: true, bodyArea: true, intensity: true, note: true, seenByCoachAt: true, createdAt: true } as const;
    const discomforts = membership.isCoach
      ? await prisma.discomfort.findMany({
          where: { eventId },
          select: { ...select, user: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        })
      : await prisma.discomfort.findMany({ where: { eventId, userId }, select, orderBy: { createdAt: "desc" } });

    return NextResponse.json({ discomforts });
  } catch (error) {
    return handleUnknownError(error, "GET /api/events/[id]/discomforts");
  }
}
