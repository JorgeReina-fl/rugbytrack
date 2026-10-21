/**
 * @jest-environment node
 */

import {
  SLOTS,
  positionFor,
  labelFor,
  slotFor,
  describeSlot,
  validateLineup,
  defaultFormatForTeam,
} from "@/lib/lineup";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({ prisma: { event: { findFirst: jest.fn() } } }));

const db = prisma as any;

const POS_15 = [
  "PROP_LOOSEHEAD", "HOOKER", "PROP_TIGHTHEAD", "LOCK", "LOCK", "FLANKER_BLINDSIDE", "FLANKER_OPENSIDE",
  "NUMBER_EIGHT", "SCRUM_HALF", "FLY_HALF", "WING_LEFT", "CENTER_INSIDE", "CENTER_OUTSIDE", "WING_RIGHT", "FULLBACK",
];
const LAB_15 = [
  "Pilar izquierdo", "Talonador", "Pilar derecho", "Segunda línea", "Segunda línea", "Flanker ciego", "Flanker abierto",
  "Número 8", "Medio melé", "Apertura", "Ala izquierdo", "Primer centro", "Segundo centro", "Ala derecho", "Zaguero",
];
const POS_7 = ["PROP_LOOSEHEAD", "HOOKER", "PROP_TIGHTHEAD", "SCRUM_HALF", "FLY_HALF", "CENTER_INSIDE", "WING_RIGHT"];
const LAB_7 = ["Pilar izquierdo", "Talonador", "Pilar derecho", "Medio melé", "Apertura", "Centro", "Ala"];

describe("SLOTS", () => {
  test("7s: titulares 1–7, suplentes 8–12; 15s: titulares 1–15, suplentes 16–23", () => {
    expect(SLOTS.SEVENS).toEqual({ starters: 7, total: 12 });
    expect(SLOTS.FIFTEENS).toEqual({ starters: 15, total: 23 });
  });
});

describe("dorsal → posición y etiqueta", () => {
  test.each(POS_15.map((p, i) => [i + 1, p, LAB_15[i]]))("15s dorsal %i → %s / %s", (n, pos, label) => {
    expect(positionFor("FIFTEENS", n as number)).toBe(pos);
    expect(labelFor("FIFTEENS", n as number)).toBe(label);
    expect(slotFor("FIFTEENS", n as number)).toEqual({ isStarter: true, position: pos });
  });

  test.each(POS_7.map((p, i) => [i + 1, p, LAB_7[i]]))("7s dorsal %i → %s / %s", (n, pos, label) => {
    expect(positionFor("SEVENS", n as number)).toBe(pos);
    expect(labelFor("SEVENS", n as number)).toBe(label);
    expect(slotFor("SEVENS", n as number)).toEqual({ isStarter: true, position: pos });
  });

  test("suplentes: 15s 16–23 y 7s 8–12 → REPLACEMENT / Suplente / no titular", () => {
    for (const n of [16, 19, 23]) {
      expect(positionFor("FIFTEENS", n)).toBe("REPLACEMENT");
      expect(labelFor("FIFTEENS", n)).toBe("Suplente");
      expect(slotFor("FIFTEENS", n).isStarter).toBe(false);
    }
    for (const n of [8, 10, 12]) {
      expect(positionFor("SEVENS", n)).toBe("REPLACEMENT");
      expect(labelFor("SEVENS", n)).toBe("Suplente");
      expect(slotFor("SEVENS", n).isStarter).toBe(false);
    }
  });

  test("sin número → «Convocado», no titular y sin posición", () => {
    expect(labelFor("SEVENS", null)).toBe("Convocado");
    expect(labelFor("FIFTEENS", undefined)).toBe("Convocado");
    expect(slotFor("FIFTEENS", null)).toEqual({ isStarter: false, position: null });
  });

  test("fuera de rango lanza (7s no tiene el 13)", () => {
    expect(() => positionFor("SEVENS", 13)).toThrow(RangeError);
    expect(() => labelFor("FIFTEENS", 24)).toThrow(RangeError);
    expect(() => positionFor("FIFTEENS", 0)).toThrow(RangeError);
  });

  test("describeSlot: titular, suplente y sin dorsal", () => {
    expect(describeSlot("FIFTEENS", 10)).toBe("Titular · Apertura (n.º 10)");
    expect(describeSlot("SEVENS", 5)).toBe("Titular · Apertura (n.º 5)");
    expect(describeSlot("SEVENS", 9)).toBe("Suplente (n.º 9)");
    expect(describeSlot("SEVENS", null)).toBe("Convocado");
  });
});

describe("validateLineup", () => {
  test("alineación válida (con y sin dorsal) → sin errores", () => {
    expect(validateLineup("SEVENS", [{ userId: "a", shirtNumber: 1 }, { userId: "b", shirtNumber: 12 }, { userId: "c", shirtNumber: null }])).toEqual([]);
    expect(validateLineup("FIFTEENS", [{ userId: "a", shirtNumber: 23 }])).toEqual([]);
  });

  test("dorsal fuera de rango (depende del formato)", () => {
    expect(validateLineup("SEVENS", [{ userId: "a", shirtNumber: 13 }])).toEqual(["Dorsal 13 fuera de rango (1-12)"]);
    expect(validateLineup("FIFTEENS", [{ userId: "a", shirtNumber: 0 }])).toEqual(["Dorsal 0 fuera de rango (1-23)"]);
    expect(validateLineup("FIFTEENS", [{ userId: "a", shirtNumber: 24 }])).toEqual(["Dorsal 24 fuera de rango (1-23)"]);
    expect(validateLineup("FIFTEENS", [{ userId: "a", shirtNumber: 1.5 }])).toHaveLength(1);
  });

  test("dorsal repetido", () => {
    expect(validateLineup("FIFTEENS", [{ userId: "a", shirtNumber: 4 }, { userId: "b", shirtNumber: 4 }])).toEqual(["Dorsal 4 repetido"]);
  });

  test("userId repetido", () => {
    expect(validateLineup("SEVENS", [{ userId: "a", shirtNumber: 1 }, { userId: "a", shirtNumber: 2 }])).toEqual(["Jugador repetido en la alineación"]);
  });

  test("varios sin dorsal no cuentan como repetidos", () => {
    expect(validateLineup("SEVENS", [{ userId: "a", shirtNumber: null }, { userId: "b", shirtNumber: null }])).toEqual([]);
  });
});

describe("defaultFormatForTeam", () => {
  beforeEach(() => jest.clearAllMocks());

  test("usa el formato del último MATCH/TOURNAMENT con formato del equipo", async () => {
    db.event.findFirst.mockResolvedValue({ format: "FIFTEENS" });
    await expect(defaultFormatForTeam("team1")).resolves.toBe("FIFTEENS");
    expect(db.event.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { teamId: "team1", type: { in: ["MATCH", "TOURNAMENT"] }, format: { not: null } },
        orderBy: { createdAt: "desc" },
      })
    );
  });

  test("sin ninguno → SEVENS", async () => {
    db.event.findFirst.mockResolvedValue(null);
    await expect(defaultFormatForTeam("team1")).resolves.toBe("SEVENS");
  });
});
