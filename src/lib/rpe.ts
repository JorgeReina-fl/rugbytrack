/** Carga de la sesión en unidades arbitrarias: RPE × minutos. */
export function rpeWorkload(rpe: number, duration: number): number {
  return rpe * duration;
}
