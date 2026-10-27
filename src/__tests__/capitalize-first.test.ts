/**
 * @jest-environment node
 */

import { capitalizeFirst, formatInTz } from "@/lib/datetime";

describe("capitalizeFirst", () => {
  test("solo el primer carácter", () => {
    expect(capitalizeFirst("martes 27 de octubre")).toBe("Martes 27 de octubre");
    expect(capitalizeFirst("sábado, 24 de octubre a las 12:05 hs")).toBe("Sábado, 24 de octubre a las 12:05 hs");
  });
  test("con acentos y letras especiales", () => {
    expect(capitalizeFirst("miércoles 28 de octubre")).toBe("Miércoles 28 de octubre");
    expect(capitalizeFirst("ñandú")).toBe("Ñandú");
    expect(capitalizeFirst("él")).toBe("Él");
  });
  test("cadena vacía, ya capitalizada y que empieza por dígito", () => {
    expect(capitalizeFirst("")).toBe("");
    expect(capitalizeFirst("Martes")).toBe("Martes");
    expect(capitalizeFirst("27 de octubre")).toBe("27 de octubre");
  });
  test("no altera el resto aunque tenga mayúsculas", () => {
    expect(capitalizeFirst("mARTES")).toBe("MARTES");
  });
  test("sobre una fecha real de formatInTz", () => {
    const d = new Date("2026-10-24T10:05:00Z");
    expect(capitalizeFirst(formatInTz(d, "Europe/Madrid", "EEEE, d 'de' MMMM 'a las' HH:mm 'hs'"))).toBe(
      "Sábado, 24 de octubre a las 12:05 hs"
    );
  });
});
