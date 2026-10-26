import { attendanceState, countsForEvent, listTaken, type EventTimesLike } from "@/lib/attendance";

/**
 * Regresión: un confirmado sin check-in solo es «absent» si la lista está tomada Y el evento ha
 * terminado (endDate, o inicio + 3 h). Antes de terminar sigue «confirmed».
 */
const H = 3600_000;
const now = new Date("2026-10-22T16:00:00Z");
type Row = { status: "PENDING" | "CONFIRMED" | "DECLINED"; checkedIn: boolean };
const rows: Row[] = [
  { status: "CONFIRMED", checkedIn: true },
  { status: "CONFIRMED", checkedIn: false },
  { status: "CONFIRMED", checkedIn: false },
  { status: "CONFIRMED", checkedIn: false },
];
const ago = (h: number) => new Date(now.getTime() - h * H);
const ahead = (h: number) => new Date(now.getTime() + h * H);

// Réplica de AttendanceBoard: fechas ISO del servidor → Date
const fromIso = (e: { startDate: string; endDate: string | null }): EventTimesLike => ({
  startDate: new Date(e.startDate),
  endDate: e.endDate ? new Date(e.endDate) : null,
  rsvpDeadline: null,
});
const tally = (r: Row[], t: EventTimesLike) => {
  const taken = listTaken(r);
  return r.reduce<Record<string, number>>((acc, x) => {
    const s = attendanceState(x, t, now, taken);
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});
};

describe("attendanceState — regresión del diagnóstico", () => {
  test("a) empezó hace 30 min, sin endDate: 1 present, 3 confirmed", () => {
    expect(tally(rows, { startDate: ago(0.5), endDate: null })).toEqual({ present: 1, confirmed: 3 });
  });
  test("b) terminó hace 1 h (inicio hace 4 h, sin endDate): 3 absent", () => {
    expect(tally(rows, { startDate: ago(4), endDate: null })).toEqual({ present: 1, absent: 3 });
  });
  test("c) endDate dentro de 2 h: sigue confirmed", () => {
    expect(tally(rows, { startDate: ago(0.5), endDate: ahead(2) })).toEqual({ present: 1, confirmed: 3 });
  });
  test("d) fechas como string ISO (serializadas del servidor)", () => {
    expect(tally(rows, fromIso({ startDate: ago(0.5).toISOString(), endDate: null }))).toEqual({ present: 1, confirmed: 3 });
    expect(tally(rows, fromIso({ startDate: ago(0.5).toISOString(), endDate: ahead(2).toISOString() }))).toEqual({ present: 1, confirmed: 3 });
    expect(tally(rows, fromIso({ startDate: ago(4).toISOString(), endDate: ago(1).toISOString() }))).toEqual({ present: 1, absent: 3 });
  });
  test("e) justo tras setPresence: la respuesta no toca status y el resto sigue confirmed", () => {
    const t = fromIso({ startDate: ago(0.5).toISOString(), endDate: null });
    const before = rows.map((r) => ({ ...r, checkedIn: false }));
    expect(tally(before, t)).toEqual({ confirmed: 4 });
    const after = before.map((r, i) => (i === 0 ? { ...r, checkedIn: true, status: "CONFIRMED" as const } : r));
    expect(tally(after, t)).toEqual({ present: 1, confirmed: 3 });
    expect(countsForEvent(after, t, now)).toMatchObject({ present: 1, confirmed: 3, absent: 0 });
  });
  test("límite: justo en eventEnd ya cuenta como terminado; un ms antes, no", () => {
    const end = new Date(now.getTime());
    expect(tally(rows, { startDate: ago(2), endDate: end })).toEqual({ present: 1, absent: 3 });
    expect(tally(rows, { startDate: ago(2), endDate: new Date(now.getTime() + 1) })).toEqual({ present: 1, confirmed: 3 });
  });
});
