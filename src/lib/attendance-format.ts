/**
 * Tasa de asistencia (fracción 0-1) como porcentaje. null/undefined (sin datos, o stats antiguos
 * que no traían el campo) → null: quien llama decide el texto. 0 es un dato real: "0%".
 */
export function formatAttendancePct(rate: number | null | undefined): string | null {
  if (rate === null || rate === undefined || Number.isNaN(rate)) return null;
  return `${(rate * 100).toFixed(0)}%`;
}
