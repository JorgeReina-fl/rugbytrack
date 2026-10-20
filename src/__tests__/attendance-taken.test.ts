/**
 * @jest-environment node
 */

import { listTaken, attendanceRate } from "@/lib/attendance";
import { isListTakenFromCount, takenEventIds } from "@/lib/attendance-taken";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({ prisma: { attendance: { groupBy: jest.fn() } } }));

type Row = { eventId: string; status: "PENDING" | "CONFIRMED" | "DECLINED"; checkedIn: boolean };
const fixture: Row[] = [
  { eventId: "a", status: "CONFIRMED", checkedIn: true },
  { eventId: "a", status: "DECLINED", checkedIn: false },
  { eventId: "b", status: "CONFIRMED", checkedIn: false },
  { eventId: "b", status: "PENDING", checkedIn: false },
  { eventId: "c", status: "DECLINED", checkedIn: true },
];
const ids = ["a", "b", "c", "d"]; // "d" sin filas

describe("paridad takenEventIds / _count / listTaken", () => {
  beforeEach(() => {
    // Simula la BD: where {eventId in, checkedIn: true}, by eventId
    (prisma.attendance.groupBy as jest.Mock).mockImplementation(async ({ where }: any) => {
      expect(where.checkedIn).toBe(true);
      const found = new Set(fixture.filter((r) => where.eventId.in.includes(r.eventId) && r.checkedIn).map((r) => r.eventId));
      return [...found].map((eventId) => ({ eventId }));
    });
  });

  test("takenEventIds == listTaken sobre todas las filas del evento", async () => {
    const set = await takenEventIds(ids);
    for (const id of ids) {
      expect(set.has(id)).toBe(listTaken(fixture.filter((r) => r.eventId === id)));
    }
  });

  test("conteo filtrado == listTaken", () => {
    for (const id of ids) {
      const rows = fixture.filter((r) => r.eventId === id);
      const count = rows.filter((r) => r.checkedIn).length;
      expect(isListTakenFromCount({ _count: { attendances: count } })).toBe(listTaken(rows));
    }
  });

  test("sin ids no consulta", async () => {
    (prisma.attendance.groupBy as jest.Mock).mockClear();
    expect((await takenEventIds([])).size).toBe(0);
    expect(prisma.attendance.groupBy).not.toHaveBeenCalled();
  });

  test("attendanceRate con solo las filas de un jugador + taken externo == con todas las filas", () => {
    const START = new Date("2026-01-01T10:00:00Z");
    const event = { startDate: START, endDate: new Date("2026-01-01T12:00:00Z") };
    const now = new Date("2026-02-01T00:00:00Z");
    const all = fixture.filter((r) => r.eventId === "a");
    const mine = all[1]!; // DECLINED, no checkedIn
    const full = attendanceRate([{ event, rows: all }], now, (r) => r === mine);
    const lean = attendanceRate([{ event, rows: [mine], taken: true }], now);
    expect(lean).toBe(full);
    expect(lean).toBe(0);
    // sin taken explícito, las filas de un solo jugador no bastan: se deduce de ellas
    expect(attendanceRate([{ event, rows: [mine] }], now)).toBeNull();
  });
});
