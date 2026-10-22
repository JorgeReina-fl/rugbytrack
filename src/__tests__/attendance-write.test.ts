/**
 * @jest-environment node
 */

import { setPresence, setRsvp } from "@/lib/attendance-write";
import { prisma } from "@/lib/prisma";
import { manualAttendanceSchema } from "@/modules/events/events.schema";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findUnique: jest.fn() },
    attendance: { upsert: jest.fn(), updateMany: jest.fn() },
  },
}));

jest.mock("@/lib/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const db = prisma as any;
const DAY = 24 * 60 * 60 * 1000;

describe("setPresence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.attendance.upsert.mockImplementation(async ({ update, create }: any) => ({
      eventId: "e1",
      userId: "u1",
      status: "DECLINED", // estado previo en BD; el update no debe cambiarlo
      checkedIn: update.checkedIn,
      checkedInAt: update.checkedInAt,
      _create: create,
    }));
  });
  test("marcar: escribe solo checkedIn/checkedInAt; DECLINED queda DECLINED + checkedIn", async () => {
    const att = await setPresence("e1", "u1", true);
    const args = db.attendance.upsert.mock.calls[0][0];
    expect(Object.keys(args.update).sort()).toEqual(["checkedIn", "checkedInAt"]);
    expect(args.update.checkedIn).toBe(true);
    expect(args.update.checkedInAt).toBeInstanceOf(Date);
    expect(args.create.status).toBe("PENDING");
    expect(att.status).toBe("DECLINED");
    expect(att.checkedIn).toBe(true);
  });

  test("desmarcar: checkedInAt null y no toca status", async () => {
    await setPresence("e1", "u1", false);
    const args = db.attendance.upsert.mock.calls[0][0];
    expect(args.update).toEqual({ checkedIn: false, checkedInAt: null });
    expect("status" in args.update).toBe(false);
  });
});

describe("setRsvp", () => {
  const now = new Date();
  beforeEach(() => {
    jest.clearAllMocks();
    db.event.findUnique.mockResolvedValue({ startDate: new Date(now.getTime() + DAY), rsvpDeadline: null });
    db.attendance.updateMany.mockResolvedValue({ count: 1 });
  });

  test("plazo cerrado → CLOSED sin escribir", async () => {
    db.event.findUnique.mockResolvedValue({
      startDate: new Date(now.getTime() + DAY),
      rsvpDeadline: new Date(now.getTime() - 1000),
    });
    expect(await setRsvp("e1", "u1", "CONFIRMED", now, { createIfMissing: true, source: "app" })).toEqual({
      ok: false,
      reason: "CLOSED",
    });
    db.event.findUnique.mockResolvedValue({ startDate: new Date(now.getTime() - 1000), rsvpDeadline: null });
    expect((await setRsvp("e1", "u1", "CONFIRMED", now, { createIfMissing: false, source: "email" })).ok).toBe(false);
    expect(db.attendance.upsert).not.toHaveBeenCalled();
    expect(db.attendance.updateMany).not.toHaveBeenCalled();
  });

  test("abierto: escribe solo status (createIfMissing → upsert sin checkedIn en update)", async () => {
    const r = await setRsvp("e1", "u1", "DECLINED", now, { createIfMissing: true, source: "app" });
    expect(r).toEqual({ ok: true, status: "DECLINED" });
    const args = db.attendance.upsert.mock.calls[0][0];
    expect(args.update).toEqual({ status: "DECLINED" });
  });

  test("abierto sin createIfMissing: updateMany solo status; sin fila → NO_ATTENDANCE", async () => {
    expect(await setRsvp("e1", "u1", "CONFIRMED", now, { createIfMissing: false, source: "email" })).toEqual({
      ok: true,
      status: "CONFIRMED",
    });
    expect(db.attendance.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", eventId: "e1" },
      data: { status: "CONFIRMED" },
    });
    db.attendance.updateMany.mockResolvedValue({ count: 0 });
    expect(await setRsvp("e1", "u1", "CONFIRMED", now, { createIfMissing: false, source: "email" })).toEqual({
      ok: false,
      reason: "NO_ATTENDANCE",
    });
  });

  test("evento inexistente", async () => {
    db.event.findUnique.mockResolvedValue(null);
    expect(await setRsvp("e1", "u1", "CONFIRMED", now, { createIfMissing: true, source: "app" })).toEqual({
      ok: false,
      reason: "EVENT_NOT_FOUND",
    });
  });
  test("loguea eventId, status y origen tras escribir; sin userId ni datos personales", async () => {
    const { logger } = jest.requireMock("@/lib/logger");
    db.event.findUnique.mockResolvedValue({ startDate: new Date(now.getTime() + DAY), rsvpDeadline: null });
    db.attendance.updateMany.mockResolvedValue({ count: 1 });
    await setRsvp("e1", "u-secreto", "CONFIRMED", now, { createIfMissing: false, source: "email" });
    expect(logger.info).toHaveBeenCalledWith({ eventId: "e1", status: "CONFIRMED", source: "email" }, "RSVP recorded");
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain("u-secreto");
  });

  test("no loguea si no se escribió (cerrado o sin fila)", async () => {
    const { logger } = jest.requireMock("@/lib/logger");
    db.event.findUnique.mockResolvedValue({ startDate: new Date(now.getTime() + DAY), rsvpDeadline: null });
    db.attendance.updateMany.mockResolvedValue({ count: 0 });
    await setRsvp("e1", "u1", "CONFIRMED", now, { createIfMissing: false, source: "email" });
    expect(logger.info).not.toHaveBeenCalled();
  });
});

describe("manualAttendanceSchema", () => {
  test("acepta y descarta status por compatibilidad", () => {
    expect(manualAttendanceSchema.parse({ checkedIn: false, status: "PENDING" })).toEqual({ checkedIn: false });
  });
});
