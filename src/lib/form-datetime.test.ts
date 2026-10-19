/** @jest-environment node */
import { localInputToIso } from "./form-datetime";

describe("localInputToIso", () => {
  test("2026-10-20T18:00 en Europe/Madrid → 16:00Z (CEST), sea cual sea el TZ del proceso", () => {
    expect(localInputToIso("2026-10-20T18:00", "Europe/Madrid")).toBe("2026-10-20T16:00:00.000Z");
  });

  test("invierno (CET): 18:00 → 17:00Z", () => {
    expect(localInputToIso("2026-12-21T18:00", "Europe/Madrid")).toBe("2026-12-21T17:00:00.000Z");
  });

  test("día del cambio de hora (25-10-2026): 00:30 CEST y 12:00 CET", () => {
    expect(localInputToIso("2026-10-25T00:30", "Europe/Madrid")).toBe("2026-10-24T22:30:00.000Z");
    expect(localInputToIso("2026-10-25T12:00", "Europe/Madrid")).toBe("2026-10-25T11:00:00.000Z");
  });

  test("otra zona", () => {
    expect(localInputToIso("2026-07-20T18:00", "America/Mexico_City")).toBe("2026-07-21T00:00:00.000Z");
  });

  test("con segundos se ignoran (datetime-local con step)", () => {
    expect(localInputToIso("2026-10-20T18:00:30", "Europe/Madrid")).toBe("2026-10-20T16:00:00.000Z");
  });

  test("vacío o inválido → null", () => {
    expect(localInputToIso("", "Europe/Madrid")).toBeNull();
    expect(localInputToIso("mañana", "Europe/Madrid")).toBeNull();
    expect(localInputToIso("2026-02-31T10:00", "Europe/Madrid")).toBeNull();
  });
});
