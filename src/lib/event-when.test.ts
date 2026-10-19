/** @jest-environment node */
import { eventWhen } from "./event-when";

const MAD = "Europe/Madrid";

describe("eventWhen", () => {
  test("18:00 Madrid en CEST (verano)", () => {
    const r = eventWhen(new Date("2026-07-20T16:00:00Z"), MAD, new Date("2026-07-01T10:00:00Z"));
    expect(r.dateTime).toBe("lunes, 20 de julio de 2026, 18:00");
    expect(r.tz).toBe(MAD);
  });

  test("18:00 Madrid en CET (invierno)", () => {
    const r = eventWhen(new Date("2026-12-21T17:00:00Z"), MAD, new Date("2026-12-01T10:00:00Z"));
    expect(r.dateTime).toBe("lunes, 21 de diciembre de 2026, 18:00");
  });

  test("evento a las 00:30 locales con now a las 23:00 locales del día anterior → mañana (en UTC sería el mismo día)", () => {
    const start = new Date("2026-10-19T22:30:00Z"); // 20/10 00:30 CEST
    const now = new Date("2026-10-19T21:00:00Z"); // 19/10 23:00 CEST
    expect(start.toISOString().slice(0, 10)).toBe(now.toISOString().slice(0, 10));
    const r = eventWhen(start, MAD, now);
    expect(r.relative).toBe("mañana");
    expect(r.dateTime).toBe("martes, 20 de octubre de 2026, 00:30");
  });

  test("now 10:00 y evento 20:00 del mismo día → hoy", () => {
    const r = eventWhen(new Date("2026-10-20T18:00:00Z"), MAD, new Date("2026-10-20T08:00:00Z"));
    expect(r.relative).toBe("hoy");
  });

  test("a 2 días → null", () => {
    const r = eventWhen(new Date("2026-10-21T16:00:00Z"), MAD, new Date("2026-10-19T10:00:00Z"));
    expect(r.relative).toBeNull();
  });

  test.each([["no/existe"], [""], [null], [undefined]])("tz inválida (%p) → Europe/Madrid", (tz) => {
    const r = eventWhen(new Date("2026-07-20T16:00:00Z"), tz, new Date("2026-07-20T08:00:00Z"));
    expect(r.tz).toBe(MAD);
    expect(r.dateTime).toBe("lunes, 20 de julio de 2026, 18:00");
    expect(r.relative).toBe("hoy");
  });

  test("otra zona: mismo instante, otra hora de pared", () => {
    const r = eventWhen(new Date("2026-07-20T16:00:00Z"), "America/Mexico_City", new Date("2026-07-20T08:00:00Z"));
    expect(r.dateTime).toBe("lunes, 20 de julio de 2026, 10:00");
    expect(r.tz).toBe("America/Mexico_City");
  });
});
