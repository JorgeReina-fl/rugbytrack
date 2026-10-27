import "server-only";
import { canSubmitRpe } from "@/lib/attendance";
import { TAKEN_COUNT, isListTakenFromCount } from "@/lib/attendance-taken";
import { prisma } from "@/lib/prisma";
import { getActiveMembership } from "@/lib/membership";
import { rpeWorkload } from "@/lib/rpe";
import { rpeWindow } from "@/lib/rpe-window";
import type { RpeEntryInput } from "@/lib/validations/rpe";

export type SubmitRpeFailure =
  | "EVENT_NOT_FOUND"
  | "NOT_MEMBER"
  | "IS_COACH"
  | "NOT_STARTED"
  | "NOT_CHECKED_IN"
  | "NOT_ATTENDED"
  | "ALREADY_RECORDED"
  | "WINDOW_CLOSED";

export type SubmitRpeResult =
  | { ok: true; entry: Awaited<ReturnType<typeof prisma.rpeEntry.create>> }
  // raced: la unicidad de BD saltó entre la comprobación y el create
  | { ok: false; code: SubmitRpeFailure; raced?: boolean };

type EligibleEvent = NonNullable<Awaited<ReturnType<typeof loadEvent>>>;

export type EvaluateRpeResult =
  | { ok: true; event: EligibleEvent }
  // closesAt/timezone solo en WINDOW_CLOSED (ya verificado miembro, no coach y check-in): para el aviso de la página
  | { ok: false; code: SubmitRpeFailure; closesAt?: Date; timezone?: string };

function loadEvent(eventId: string, userId: string) {
  return prisma.event.findUnique({
    where: { id: eventId },
    include: {
      attendances: { where: { userId } },
      team: { select: { name: true, timezone: true } },
      ...TAKEN_COUNT,
    },
  });
}

/**
 * Elegibilidad del jugador para registrar su RPE, sin escribir nada.
 * Orden: evento → miembro activo → no coach → evento empezado → asistencia/check-in →
 * ya existe → plazo de 48 h.
 *
 * requireCheckIn=false: vale el RSVP confirmado cuando no se ha pasado lista (app).
 * requireCheckIn=true: solo con check-in del coach (enlace público).
 */
export async function evaluatePlayerRpe(
  userId: string,
  eventId: string,
  opts: { requireCheckIn: boolean },
): Promise<EvaluateRpeResult> {
  const event = await loadEvent(eventId, userId);
  if (!event) return { ok: false, code: "EVENT_NOT_FOUND" };

  const membership = await getActiveMembership(event.teamId, userId);
  if (!membership) return { ok: false, code: "NOT_MEMBER" };
  if (membership.isCoach) return { ok: false, code: "IS_COACH" };

  const now = new Date();
  if (new Date(event.startDate) > now) return { ok: false, code: "NOT_STARTED" };

  const attendance = event.attendances[0];
  if (opts.requireCheckIn) {
    if (!attendance?.checkedIn) return { ok: false, code: "NOT_CHECKED_IN" };
  } else if (!attendance || !canSubmitRpe(attendance, isListTakenFromCount(event))) {
    return { ok: false, code: "NOT_ATTENDED" };
  }

  const existing = await prisma.rpeEntry.findUnique({
    where: { eventId_userId: { eventId, userId } },
  });
  if (existing) return { ok: false, code: "ALREADY_RECORDED" };

  const window = rpeWindow(event, now);
  if (window.state === "closed") {
    return { ok: false, code: "WINDOW_CLOSED", closesAt: window.closesAt, timezone: event.team?.timezone ?? undefined };
  }

  return { ok: true, event };
}

/**
 * Escritura del RPE de un jugador por sí mismo (recordedById = userId).
 * Sin respuestas HTTP ni logs: eso es cosa de quien la llama.
 */
export async function submitPlayerRpe(
  userId: string,
  eventId: string,
  input: RpeEntryInput,
  opts: { requireCheckIn: boolean },
): Promise<SubmitRpeResult> {
  const evaluation = await evaluatePlayerRpe(userId, eventId, opts);
  if (!evaluation.ok) return { ok: false, code: evaluation.code };

  try {
    const entry = await prisma.rpeEntry.create({
      data: {
        eventId,
        userId,
        rpe: input.rpe,
        duration: input.duration,
        workload: rpeWorkload(input.rpe, input.duration),
        notes: input.notes ?? null,
        recordedById: userId,
      },
    });
    return { ok: true, entry };
  } catch (error: unknown) {
    if (error && typeof error === "object" && (error as { code?: unknown }).code === "P2002") {
      return { ok: false, code: "ALREADY_RECORDED", raced: true };
    }
    throw error;
  }
}
