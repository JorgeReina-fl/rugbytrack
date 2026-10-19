/** @jest-environment node */
import { buildMonthGrid, gridRangeUtc, monthRangeUtc } from "./calendar";

const MAD = "Europe/Madrid";
const ev = (id: string, iso: string) => ({ id, startDate: new Date(iso) });
const flat = <T,>(w: T[][]) => w.flat();

describe("monthRangeUtc", () => {
  test("octubre 2026 en Madrid (CEST→CET): [30/09 22:00Z, 31/10 23:00Z)", () => {
    const { start, end } = monthRangeUtc(2026, 9, MAD);
    expect(start.toISOString()).toBe("2026-09-30T22:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-31T23:00:00.000Z");
  });

  test("evento 00:30 locales del 1-11 queda dentro de noviembre y fuera de octubre", () => {
    const t = new Date("2026-10-31T23:30:00Z"); // 01/11 00:30 CET
    const oct = monthRangeUtc(2026, 9, MAD);
    const nov = monthRangeUtc(2026, 10, MAD);
    expect(t >= oct.start && t < oct.end).toBe(false);
    expect(t >= nov.start && t < nov.end).toBe(true);
  });

  test("diciembre → enero cruza de año", () => {
    expect(monthRangeUtc(2026, 11, MAD).end.toISOString()).toBe("2026-12-31T23:00:00.000Z");
  });

  test("tz inválida → Europe/Madrid", () => {
    expect(monthRangeUtc(2026, 9, "no/existe").start.toISOString()).toBe("2026-09-30T22:00:00.000Z");
  });
});

describe("gridRangeUtc", () => {
  test("octubre 2026: lunes 28/09 a domingo 01/11 inclusive", () => {
    const { start, end } = gridRangeUtc(2026, 9, MAD);
    expect(start.toISOString()).toBe("2026-09-27T22:00:00.000Z"); // 28/09 00:00 CEST
    expect(end.toISOString()).toBe("2026-11-01T23:00:00.000Z"); // 02/11 00:00 CET
  });
});

describe("buildMonthGrid", () => {
  const now = new Date("2026-10-10T10:00:00Z");

  test("evento 23:30 locales del 31-10 → celda 2026-10-31 (no 1-11)", () => {
    const e = ev("a", "2026-10-31T22:30:00Z"); // 31/10 23:30 CET
    const cells = flat(buildMonthGrid(2026, 9, MAD, [e], now));
    const hit = cells.filter((c) => c.events.length > 0);
    expect(hit.map((c) => c.dayKey)).toEqual(["2026-10-31"]);
    expect(hit[0]!.events[0]!.time).toBe("23:30");
  });

  test("evento 00:30 locales del 1-11 va a la celda 2026-11-01 (inMonth false en octubre)", () => {
    const e = ev("b", "2026-10-31T23:30:00Z");
    const cell = flat(buildMonthGrid(2026, 9, MAD, [e], now)).find((c) => c.dayKey === "2026-11-01")!;
    expect(cell.inMonth).toBe(false);
    expect(cell.events.map((x) => x.event.id)).toEqual(["b"]);
    expect(cell.events[0]!.time).toBe("00:30");
  });

  test("semanas de lunes a domingo y sin días duplicados ni perdidos en el cambio de hora (25-10-2026)", () => {
    const weeks = buildMonthGrid(2026, 9, MAD, [], now);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    const keys = flat(weeks).map((c) => c.dayKey);
    expect(keys[0]).toBe("2026-09-28");
    expect(keys[keys.length - 1]).toBe("2026-11-01");
    expect(new Set(keys).size).toBe(keys.length);
    for (let i = 1; i < keys.length; i++) {
      expect(Date.parse(keys[i]!) - Date.parse(keys[i - 1]!)).toBe(86_400_000);
    }
    expect(keys).toContain("2026-10-25");
  });

  test("isToday con now a las 23:30 locales (22:30Z) y con now a las 00:30 locales del día siguiente", () => {
    const a = flat(buildMonthGrid(2026, 9, MAD, [], new Date("2026-10-09T21:30:00Z"))); // 09/10 23:30 CEST
    expect(a.filter((c) => c.isToday).map((c) => c.dayKey)).toEqual(["2026-10-09"]);
    const b = flat(buildMonthGrid(2026, 9, MAD, [], new Date("2026-10-09T22:30:00Z"))); // 10/10 00:30 CEST
    expect(b.filter((c) => c.isToday).map((c) => c.dayKey)).toEqual(["2026-10-10"]);
  });

  test("inMonth e isToday solo marcan lo que toca; eventos en orden de entrada", () => {
    const evs = [ev("x", "2026-10-12T07:00:00Z"), ev("y", "2026-10-12T15:00:00Z")];
    const cell = flat(buildMonthGrid(2026, 9, MAD, evs, now)).find((c) => c.dayKey === "2026-10-12")!;
    expect(cell.inMonth).toBe(true);
    expect(cell.events.map((x) => [x.event.id, x.time])).toEqual([["x", "09:00"], ["y", "17:00"]]);
  });

  test("desbordamiento de mes como new Date(y, m, 1): mes 12 → enero siguiente", () => {
    const keys = flat(buildMonthGrid(2026, 12, MAD, [], now));
    expect(keys.filter((c) => c.inMonth)[0]!.dayKey).toBe("2027-01-01");
  });
});
