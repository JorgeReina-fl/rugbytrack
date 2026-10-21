/**
 * @jest-environment node
 */

import { formatAttendancePct } from "@/lib/attendance-format";
import { buildPlayerStatsText } from "@/lib/gemini-embeddings";

const base = { position: null, avgRpe: 6, totalEvents: 10, avgWorkload: 400 };

describe("formatAttendancePct", () => {
  test("número → porcentaje; 0 es un dato real", () => {
    expect(formatAttendancePct(0.857)).toBe("86%");
    expect(formatAttendancePct(1)).toBe("100%");
    expect(formatAttendancePct(0)).toBe("0%");
  });

  test("null, undefined y NaN → null (sin datos)", () => {
    expect(formatAttendancePct(null)).toBeNull();
    expect(formatAttendancePct(undefined)).toBeNull();
    expect(formatAttendancePct(NaN)).toBeNull();
  });
});

describe("buildPlayerStatsText — asistencia", () => {
  test("con número", () => {
    expect(buildPlayerStatsText({ ...base, attendanceRate: 0.5 })).toContain("Asistencia: 50%");
    expect(buildPlayerStatsText({ ...base, attendanceRate: 0 })).toContain("Asistencia: 0%");
  });

  test("con null → sin datos", () => {
    const text = buildPlayerStatsText({ ...base, attendanceRate: null });
    expect(text).toContain("Asistencia: sin datos");
    expect(text).not.toContain("0%");
  });
});

describe("buildPlayerStatsText — sin identificadores (el texto se envía a Gemini)", () => {
  const stats = { position: "FLY_HALF", avgRpe: 6.5, totalEvents: 12, avgWorkload: 410, attendanceRate: 0.75 };

  test("no contiene el nombre ni el userId aunque lleguen en el objeto", () => {
    const withIds = { ...stats, name: "Marta Pérez Soto", userId: "user-cuid-123" };
    const text = buildPlayerStatsText(withIds);
    expect(text).not.toContain("Marta");
    expect(text).not.toContain("Pérez");
    expect(text).not.toContain("user-cuid-123");
    expect(text).not.toContain("Jugador:");
  });

  test("empieza por la posición y mantiene RPE, carga, asistencia y eventos", () => {
    const text = buildPlayerStatsText(stats);
    expect(text.startsWith("Posición: FLY_HALF")).toBe(true);
    expect(text).toContain("RPE promedio: 6.5 / 10");
    expect(text).toContain("Carga promedio: 410 UA");
    expect(text).toContain("Asistencia: 75%");
    expect(text).toContain("Eventos totales: 12");
  });

  test("posición no asignada y asistencia sin datos", () => {
    const text = buildPlayerStatsText({ ...stats, position: null, attendanceRate: null });
    expect(text).toContain("Posición: no asignada");
    expect(text).toContain("Asistencia: sin datos");
  });
});
