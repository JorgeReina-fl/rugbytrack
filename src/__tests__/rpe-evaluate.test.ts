/**
 * @jest-environment node
 */

import { evaluatePlayerRpe } from "@/lib/rpe-submit";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findUnique: jest.fn() },
    teamMember: { findFirst: jest.fn() },
    rpeEntry: { create: jest.fn(), findUnique: jest.fn() },
  },
}));

const db = prisma as any;
const H = 60 * 60 * 1000;
const att = (over: Record<string, unknown> = {}) => ({ userId: "u1", status: "CONFIRMED", checkedIn: true, ...over });
const event = (over: Record<string, unknown> = {}) => ({
  id: "e1",
  teamId: "t1",
  title: "Entreno",
  type: "TRAINING",
  startDate: new Date(Date.now() - 2 * H),
  endDate: null,
  attendances: [att()],
  _count: { attendances: 1 },
  team: { name: "Club", timezone: "Europe/Madrid" },
  ...over,
});

describe("evaluatePlayerRpe — sin escribir", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.event.findUnique.mockResolvedValue(event());
    db.teamMember.findFirst.mockResolvedValue({ isCoach: false });
    db.rpeEntry.findUnique.mockResolvedValue(null);
  });
  afterEach(() => expect(db.rpeEntry.create).not.toHaveBeenCalled());

  const code = async (opts = { requireCheckIn: true }) => {
    const r = await evaluatePlayerRpe("u1", "e1", opts);
    return r.ok ? "OK" : r.code;
  };

  test("ok con el evento y su equipo", async () => {
    const r = await evaluatePlayerRpe("u1", "e1", { requireCheckIn: true });
    expect(r.ok && r.event.team.name).toBe("Club");
  });
  test("EVENT_NOT_FOUND", async () => {
    db.event.findUnique.mockResolvedValue(null);
    expect(await code()).toBe("EVENT_NOT_FOUND");
  });
  test("NOT_MEMBER", async () => {
    db.teamMember.findFirst.mockResolvedValue(null);
    expect(await code()).toBe("NOT_MEMBER");
  });
  test("IS_COACH", async () => {
    db.teamMember.findFirst.mockResolvedValue({ isCoach: true });
    expect(await code()).toBe("IS_COACH");
  });
  test("NOT_STARTED", async () => {
    db.event.findUnique.mockResolvedValue(event({ startDate: new Date(Date.now() + H) }));
    expect(await code()).toBe("NOT_STARTED");
  });
  test("requireCheckIn: confirmado sin check-in → NOT_CHECKED_IN; en modo app vale el RSVP → ok", async () => {
    db.event.findUnique.mockResolvedValue(event({ attendances: [att({ checkedIn: false })], _count: { attendances: 0 } }));
    expect(await code({ requireCheckIn: true })).toBe("NOT_CHECKED_IN");
    expect(await code({ requireCheckIn: false })).toBe("OK");
  });
  test("modo app sin asistencia confirmada → NOT_ATTENDED", async () => {
    db.event.findUnique.mockResolvedValue(event({ attendances: [att({ status: "PENDING", checkedIn: false })], _count: { attendances: 0 } }));
    expect(await code({ requireCheckIn: false })).toBe("NOT_ATTENDED");
  });
  test("ALREADY_RECORDED (antes que el plazo)", async () => {
    db.rpeEntry.findUnique.mockResolvedValue({ id: "x" });
    db.event.findUnique.mockResolvedValue(event({ startDate: new Date(Date.now() - 60 * H) }));
    expect(await code()).toBe("ALREADY_RECORDED");
  });
  test("WINDOW_CLOSED con closesAt y zona", async () => {
    const start = new Date(Date.now() - 60 * H);
    db.event.findUnique.mockResolvedValue(event({ startDate: start }));
    const r = await evaluatePlayerRpe("u1", "e1", { requireCheckIn: true });
    expect(r).toEqual({
      ok: false,
      code: "WINDOW_CLOSED",
      closesAt: new Date(start.getTime() + 51 * H),
      timezone: "Europe/Madrid",
    });
  });
});
