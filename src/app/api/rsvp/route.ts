import "server-only";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRsvpToken } from "@/lib/tokens";
import { handleUnknownError } from "@/lib/api-response";

const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return fail("Invalid request payload", 400);
    }

    const { token, status } = (body ?? {}) as { token?: unknown; status?: unknown };

    if (
      typeof token !== "string" ||
      !token ||
      (status !== "CONFIRMED" && status !== "DECLINED")
    ) {
      return fail("Invalid request payload", 400);
    }

    const payload = verifyRsvpToken(token);

    if (!payload) {
      return fail("Invalid or expired token", 401);
    }

    const { userId, eventId } = payload;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { teamId: true, startDate: true, rsvpDeadline: true },
    });

    if (!event) return fail("Attendance record not found", 404);

    // Mismas reglas que POST /api/events/[id]/rsvp
    const membership = await prisma.teamMember.findFirst({
      where: { userId, teamId: event.teamId, leftAt: null },
      select: { id: true },
    });

    if (!membership) return fail("Not a team member", 403);

    const now = new Date();
    if (
      (event.rsvpDeadline && now > event.rsvpDeadline) ||
      now >= event.startDate
    ) {
      return fail("RSVP closed", 409);
    }

    const updated = await prisma.attendance.updateMany({
      where: { userId, eventId },
      data: { status },
    });

    if (updated.count === 0) return fail("Attendance record not found", 404);

    return NextResponse.json({ data: { status } });
  } catch (error) {
    return handleUnknownError(error, "POST /api/rsvp");
  }
}
