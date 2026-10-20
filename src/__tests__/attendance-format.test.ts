/**
 * @jest-environment node
 */

import { formatAttendancePct } from "@/lib/attendance-format";
import { buildPlayerStatsText } from "@/lib/gemini-embeddings";

const base = { name: "Jugador", position: null, avgRpe: 6, totalEvents: 10, avgWorkload: 400 };

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
