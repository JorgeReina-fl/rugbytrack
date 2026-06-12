import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRsvpToken } from "@/lib/tokens";

export async function POST(req: Request) {
  try {
    const { token, status } = await req.json();

    if (!token || !status || (status !== "CONFIRMED" && status !== "DECLINED")) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const payload = verifyRsvpToken(token);

    if (!payload) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    const { userId, eventId } = payload;

    const updated = await prisma.attendance.updateMany({
      where: {
        userId,
        eventId,
      },
      data: {
        status,
      },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: "Attendance record not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error("Error in RSVP route:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
