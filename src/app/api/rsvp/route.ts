import "server-only";
import { prisma } from "@/lib/prisma";
import { verifyRsvpToken } from "@/lib/tokens";
import {
  apiSuccess,
  apiError,
  apiNotFound,
  handleUnknownError,
} from "@/lib/api-response";

export async function POST(req: Request) {
  try {
    const { token, status } = await req.json();

    if (!token || !status || (status !== "CONFIRMED" && status !== "DECLINED")) {
      return apiError("Invalid request payload", 400);
    }

    const payload = verifyRsvpToken(token);

    if (!payload) {
      return apiError("Invalid or expired token", 401);
    }

    const { userId, eventId } = payload;

    const updated = await prisma.attendance.updateMany({
      where: { userId, eventId },
      data: { status },
    });

    if (updated.count === 0) return apiNotFound("Attendance record");

    return apiSuccess({ status });
  } catch (error) {
    return handleUnknownError(error, "POST /api/rsvp");
  }
}
