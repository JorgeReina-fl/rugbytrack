/** @jest-environment node */
import { isoWeekKeyInTz } from "./week";

const MAD = "Europe/Madrid";
const wk = (iso: string, tz = MAD) => isoWeekKeyInTz(new Date(iso), tz);

// Copia de la implementación anterior (getISOWeek/getISOWeekYear/getWeekLabel). Usaba la zona local del
// proceso (UTC en el contenedor); aquí con getters/setters UTC para que la paridad no dependa del TZ del test.
function oldGetISOWeek(d: Date) {
  const date = new Date(d.getTime());
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + 3 - ((date.getUTCDay() + 6) % 7));
  const week1 = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getUTCDay() + 6) % 7)) / 7);
}
function oldGetISOWeekYear(d: Date) {
  const date = new Date(d.getTime());
  date.setUTCDate(date.getUTCDate() + 3 - ((date.getUTCDay() + 6) % 7));
  return date.getUTCFullYear();
}
const oldWeekLabel = (date: Date) => `${oldGetISOWeekYear(date)}-W${String(oldGetISOWeek(date)).padStart(2, "0")}`;

describe("isoWeekKeyInTz", () => {
  test("domingo 22:30Z = lunes 00:30 en Madrid (CEST) → semana nueva; en UTC sigue la anterior", () => {
    expect(wk("2026-10-18T22:30:00Z")).toBe("2026-W43");
    expect(wk("2026-10-18T22:30:00Z", "UTC")).toBe("2026-W42");
  });

  test("domingo 21:30Z = domingo 23:30 en Madrid (CEST) → semana anterior", () => {
    expect(wk("2026-10-18T21:30:00Z")).toBe("2026-W42");
  });

  test("invierno (CET): domingo 22:30Z = domingo 23:30 → anterior; 23:30Z = lunes 00:30 → nueva", () => {
    expect(wk("2026-11-01T22:30:00Z")).toBe("2026-W44");
    expect(wk("2026-11-01T23:30:00Z")).toBe("2026-W45");
  });

  test("cambio de año ISO: 2026-12-31/2027-01-01 y 2027-01-03/04", () => {
    expect(wk("2026-12-31T12:00:00Z")).toBe("2026-W53");
    expect(wk("2027-01-01T12:00:00Z")).toBe("2026-W53");
    expect(wk("2027-01-03T12:00:00Z")).toBe("2026-W53");
    expect(wk("2027-01-04T12:00:00Z")).toBe("2027-W01");
    expect(wk("2027-01-03T23:30:00Z")).toBe("2027-W01"); // lunes 00:30 en Madrid
  });

  test("semana del cambio de hora (25-10-2026): los siete días son la misma semana", () => {
    const keys = ["2026-10-19T12:00:00Z", "2026-10-22T12:00:00Z", "2026-10-25T00:30:00Z", "2026-10-25T22:30:00Z"].map((i) => wk(i));
    expect(new Set(keys)).toEqual(new Set(["2026-W43"]));
    expect(wk("2026-10-25T22:30:00Z")).toBe("2026-W43"); // domingo 23:30 CET
    expect(wk("2026-10-25T23:30:00Z")).toBe("2026-W44"); // lunes 00:30 CET
  });

  test("tz inválida o ausente → Europe/Madrid", () => {
    for (const tz of ["no/existe", "", null, undefined]) {
      expect(isoWeekKeyInTz(new Date("2026-10-18T22:30:00Z"), tz)).toBe("2026-W43");
    }
  });

  test("acepta fecha como string", () => {
    expect(isoWeekKeyInTz("2026-10-18T22:30:00Z", MAD)).toBe("2026-W43");
  });

  describe("paridad con la copia antigua (tz = UTC)", () => {
    test("50 fechas, incluidos fines de semana y cambios de año", () => {
      let seed = 12345;
      const dates: Date[] = [];
      for (let i = 0; i < 44; i++) {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        dates.push(new Date(Date.UTC(2024, 0, 1) + (seed % (4 * 365 * 24 * 3600)) * 1000));
      }
      dates.push(
        new Date("2024-12-30T00:00:00Z"), new Date("2026-12-31T23:59:59Z"), new Date("2027-01-03T23:59:59Z"),
        new Date("2027-01-04T00:00:00Z"), new Date("2025-12-28T23:59:59Z"), new Date("2026-01-01T00:00:00Z")
      );
      expect(dates).toHaveLength(50);
      for (const d of dates) expect(isoWeekKeyInTz(d, "UTC")).toBe(oldWeekLabel(d));
    });
  });
});
