/** @jest-environment node */
import {
  DEFAULT_TZ,
  dayDiffInTz,
  dayKeyInTz,
  formatInTz,
  isValidTimeZone,
  safeTz,
  startOfDayInTz,
  utcToZonedInput,
  zonedInputToUtc,
} from "./datetime";

const MAD = "Europe/Madrid";

describe("zonedInputToUtc / utcToZonedInput", () => {
  it("verano (CEST): 18:00 Madrid = 16:00Z", () => {
    expect(zonedInputToUtc("2026-10-19T18:00", MAD).toISOString()).toBe("2026-10-19T16:00:00.000Z");
  });

  it("invierno (CET): 18:00 Madrid = 17:00Z", () => {
    expect(zonedInputToUtc("2026-11-19T18:00", MAD).toISOString()).toBe("2026-11-19T17:00:00.000Z");
  });

  it.each(["2026-10-19T18:00", "2026-11-19T18:00"])("ida y vuelta %s", (v) => {
    expect(utcToZonedInput(zonedInputToUtc(v, MAD), MAD)).toBe(v);
  });

  it("acepta string ISO en utcToZonedInput", () => {
    expect(utcToZonedInput("2026-10-19T16:00:00.000Z", MAD)).toBe("2026-10-19T18:00");
  });

  it("otoño 2026-10-25: 01:59 y 03:00 correctos", () => {
    expect(zonedInputToUtc("2026-10-25T01:59", MAD).toISOString()).toBe("2026-10-24T23:59:00.000Z");
    expect(zonedInputToUtc("2026-10-25T03:00", MAD).toISOString()).toBe("2026-10-25T02:00:00.000Z");
  });

  it("otoño 2026-10-25: 02:30 ambigua → segunda ocurrencia (CET, 01:30Z)", () => {
    expect(zonedInputToUtc("2026-10-25T02:30", MAD).toISOString()).toBe("2026-10-25T01:30:00.000Z");
  });

  it("primavera 2027-03-28: 01:59 y 03:00 correctos", () => {
    expect(zonedInputToUtc("2027-03-28T01:59", MAD).toISOString()).toBe("2027-03-28T00:59:00.000Z");
    expect(zonedInputToUtc("2027-03-28T03:00", MAD).toISOString()).toBe("2027-03-28T01:00:00.000Z");
  });

  it("primavera 2027-03-28: 02:30 inexistente → se desplaza a 03:30 CEST (01:30Z)", () => {
    expect(zonedInputToUtc("2027-03-28T02:30", MAD).toISOString()).toBe("2027-03-28T01:30:00.000Z");
  });

  it.each(["", "2026-10-19", "2026-10-19 18:00", "2026-10-19T18:00:00", "2026-10-19T18:00Z", "19/10/2026 18:00"])(
    "rechaza formato inválido %p",
    (v) => {
      expect(() => zonedInputToUtc(v, MAD)).toThrow();
    },
  );

  it.each(["2026-13-01T10:00", "2026-02-30T10:00", "2026-10-19T24:00", "2026-10-19T10:60"])(
    "rechaza fecha inexistente %s",
    (v) => {
      expect(() => zonedInputToUtc(v, MAD)).toThrow();
    },
  );

  it("zona inválida cae a Europe/Madrid", () => {
    expect(zonedInputToUtc("2026-10-19T18:00", "Nowhere").toISOString()).toBe("2026-10-19T16:00:00.000Z");
  });
});

describe("dayKeyInTz / dayDiffInTz / startOfDayInTz", () => {
  it("dayKeyInTz depende de la zona", () => {
    const d = new Date("2026-10-19T22:30:00Z");
    expect(dayKeyInTz(d, MAD)).toBe("2026-10-20");
    expect(dayKeyInTz(d, "UTC")).toBe("2026-10-19");
  });

  it("dayDiffInTz: 23:30 local del día D frente a 00:30 local del D+1 → 1", () => {
    const a = zonedInputToUtc("2026-10-19T23:30", MAD);
    const b = zonedInputToUtc("2026-10-20T00:30", MAD);
    expect(dayDiffInTz(a, b, MAD)).toBe(1);
    expect(dayDiffInTz(b, a, MAD)).toBe(-1);
  });

  it("dayDiffInTz: mismo día → 0 y atraviesa el cambio de hora", () => {
    expect(dayDiffInTz(zonedInputToUtc("2026-10-19T08:00", MAD), zonedInputToUtc("2026-10-19T23:59", MAD), MAD)).toBe(0);
    expect(dayDiffInTz(zonedInputToUtc("2026-10-24T12:00", MAD), zonedInputToUtc("2026-10-26T12:00", MAD), MAD)).toBe(2);
  });

  it("startOfDayInTz devuelve el 00:00 local como instante UTC", () => {
    expect(startOfDayInTz(new Date("2026-10-19T22:30:00Z"), MAD).toISOString()).toBe("2026-10-19T22:00:00.000Z");
    expect(startOfDayInTz("2026-11-19T12:00:00Z", MAD).toISOString()).toBe("2026-11-18T23:00:00.000Z");
    expect(startOfDayInTz(new Date("2026-10-19T22:30:00Z"), "UTC").toISOString()).toBe("2026-10-19T00:00:00.000Z");
  });
});

describe("formatInTz", () => {
  it("formatea en la zona indicada", () => {
    expect(formatInTz(new Date("2026-10-19T16:00:00Z"), MAD, "dd/MM/yyyy HH:mm")).toBe("19/10/2026 18:00");
    expect(formatInTz("2026-10-19T16:00:00Z", "UTC", "dd/MM/yyyy HH:mm")).toBe("19/10/2026 16:00");
  });

  it("usa locale es", () => {
    expect(formatInTz(new Date("2026-10-19T16:00:00Z"), MAD, "EEEE")).toBe("lunes");
  });
});

describe("isValidTimeZone / safeTz", () => {
  it.each(["Europe/Madrid", "America/New_York", "UTC"])("%s es válida", (z) => {
    expect(isValidTimeZone(z)).toBe(true);
  });

  it.each(["Madrid", "", "Europe/Nowhere"])("%p no es válida", (z) => {
    expect(isValidTimeZone(z)).toBe(false);
  });

  it("safeTz", () => {
    expect(DEFAULT_TZ).toBe("Europe/Madrid");
    expect(safeTz("Europe/Nowhere")).toBe("Europe/Madrid");
    expect(safeTz("")).toBe("Europe/Madrid");
    expect(safeTz(null)).toBe("Europe/Madrid");
    expect(safeTz(undefined)).toBe("Europe/Madrid");
    expect(safeTz("America/New_York")).toBe("America/New_York");
  });
});
