import "server-only";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { lineupSchema } from "@/modules/events/events.schema";
import { getActiveMembership } from "@/lib/membership";
import { describeSlot, labelFor, slotFor, validateLineup } from "@/lib/lineup";
import { notifyLineupChanges, type LineupDiff } from "@/lib/lineup-notify";
import { logger } from "@/lib/logger";
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
import { errInfo } from "@/lib/log-safe";

/** Alineación completa de un partido o torneo, editable hasta el inicio. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return apiUnauthorized();

  try {
    const { id } = await params;
    const event = await prisma.event.findUnique({
      where: { id },
      select: { id: true, teamId: true, title: true, type: true, startDate: true },
    });
    if (!event) return apiNotFound("Evento");

    const membership = await getActiveMembership(event.teamId, session.user.id);
    if (!membership?.isCoach) return apiForbidden();

    if (event.type !== "MATCH" && event.type !== "TOURNAMENT") {
      return apiError("La alineación solo se edita en partidos y torneos", 422);
    }
    if (new Date(event.startDate) <= new Date()) return apiError("El partido ya ha empezado", 409);

    const { format, players } = lineupSchema.parse(await request.json());

    const errors = validateLineup(format, players);
    if (errors.length > 0) return apiError(errors[0] ?? "Alineación inválida", 422);

    if (players.length > 0) {
      const activeMembers = await prisma.teamMember.findMany({
        where: { teamId: event.teamId, leftAt: null, userId: { in: players.map((p) => p.userId) } },
        select: { userId: true },
      });
      if (activeMembers.length !== players.length) {
        return apiError("Algún jugador convocado no pertenece al equipo", 422);
      }
    }

    const next = players.map((p) => ({ userId: p.userId, shirtNumber: p.shirtNumber, ...slotFor(format, p.shirtNumber) }));
    const nextIds = new Set(next.map((p) => p.userId));

    const diff: LineupDiff = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const current = await tx.callup.findMany({
        where: { eventId: id },
        select: { userId: true, shirtNumber: true, isStarter: true, position: true },
      });
      const byUser = new Map(current.map((c) => [c.userId, c]));

      const entered = next.filter((p) => !byUser.has(p.userId));
      const left = current.filter((c) => !nextIds.has(c.userId)).map((c) => c.userId);
      const changed = next.filter((p) => {
        const c = byUser.get(p.userId);
        return c && (c.shirtNumber !== p.shirtNumber || c.isStarter !== p.isStarter || c.position !== p.position);
      });

      await tx.event.update({ where: { id }, data: { format } });

      // Primero salen y se liberan los dorsales de quien cambia, para no chocar con el índice único al reasignar
      if (left.length > 0) {
        await tx.callup.deleteMany({ where: { eventId: id, userId: { in: left } } });
        await tx.attendance.deleteMany({ where: { eventId: id, userId: { in: left }, checkedIn: false } });
      }
      if (changed.length > 0) {
        await tx.callup.updateMany({
          where: { eventId: id, userId: { in: changed.map((p) => p.userId) } },
          data: { shirtNumber: null },
        });
        for (const p of changed) {
          await tx.callup.update({
            where: { eventId_userId: { eventId: id, userId: p.userId } },
            data: { shirtNumber: p.shirtNumber, isStarter: p.isStarter, position: p.position },
          });
        }
      }
      if (entered.length > 0) {
        await tx.callup.createMany({
          data: entered.map((p) => ({
            eventId: id,
            userId: p.userId,
            shirtNumber: p.shirtNumber,
            isStarter: p.isStarter,
            position: p.position,
          })),
        });
        await tx.attendance.createMany({
          data: entered.map((p) => ({ eventId: id, userId: p.userId, status: "PENDING" as const, checkedIn: false })),
          skipDuplicates: true,
        });
      }

      return {
        entered: entered.map((p) => p.userId),
        left,
        changed: changed.map((p) => ({ userId: p.userId, description: describeSlot(format, p.shirtNumber) })),
      };
    });

    logger.info(
      { eventId: id, entran: diff.entered.length, salen: diff.left.length, cambian: diff.changed.length },
      "Lineup updated"
    );

    if (diff.entered.length > 0 || diff.left.length > 0 || diff.changed.length > 0) {
      notifyLineupChanges({ id, title: event.title }, diff).catch((err: unknown) => {
        logger.error({ err: errInfo(err), eventId: id }, "Failed to dispatch lineup notifications");
      });
    }

    const result = next
      .map((p) => ({ ...p, label: labelFor(format, p.shirtNumber) }))
      .sort((a, b) => (a.shirtNumber ?? Infinity) - (b.shirtNumber ?? Infinity));
    return apiSuccess({ eventId: id, format, players: result });
  } catch (err) {
    if (err instanceof ZodError) return handleZodError(err);
    return handleUnknownError(err, "PUT /api/events/[id]/lineup");
  }
}
