import type { MatchFormat, RugbyPosition } from "@prisma/client";

/** Dorsales por formato: titulares 1..starters, suplentes starters+1..total. */
export const SLOTS: Record<MatchFormat, { starters: number; total: number }> = {
  SEVENS: { starters: 7, total: 12 },
  FIFTEENS: { starters: 15, total: 23 },
};

const POSITIONS: Record<MatchFormat, readonly RugbyPosition[]> = {
  FIFTEENS: [
    "PROP_LOOSEHEAD",
    "HOOKER",
    "PROP_TIGHTHEAD",
    "LOCK",
    "LOCK",
    "FLANKER_BLINDSIDE",
    "FLANKER_OPENSIDE",
    "NUMBER_EIGHT",
    "SCRUM_HALF",
    "FLY_HALF",
    "WING_LEFT",
    "CENTER_INSIDE",
    "CENTER_OUTSIDE",
    "WING_RIGHT",
    "FULLBACK",
  ],
  // En 7s el centro y el ala no tienen lado: se usan CENTER_INSIDE y WING_RIGHT
  SEVENS: ["PROP_LOOSEHEAD", "HOOKER", "PROP_TIGHTHEAD", "SCRUM_HALF", "FLY_HALF", "CENTER_INSIDE", "WING_RIGHT"],
};

const LABELS: Record<MatchFormat, readonly string[]> = {
  FIFTEENS: [
    "Pilar izquierdo",
    "Talonador",
    "Pilar derecho",
    "Segunda línea",
    "Segunda línea",
    "Flanker ciego",
    "Flanker abierto",
    "Número 8",
    "Medio melé",
    "Apertura",
    "Ala izquierdo",
    "Primer centro",
    "Segundo centro",
    "Ala derecho",
    "Zaguero",
  ],
  SEVENS: ["Pilar izquierdo", "Talonador", "Pilar derecho", "Medio melé", "Apertura", "Centro", "Ala"],
};

function inRange(format: MatchFormat, n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= SLOTS[format].total;
}

export function isStarterNumber(format: MatchFormat, n: number): boolean {
  return n <= SLOTS[format].starters;
}

export function positionFor(format: MatchFormat, n: number): RugbyPosition {
  if (!inRange(format, n)) throw new RangeError(`Dorsal ${n} fuera de rango para ${format}`);
  return isStarterNumber(format, n) ? (POSITIONS[format][n - 1] as RugbyPosition) : "REPLACEMENT";
}

/** Etiqueta en español del dorsal; sin número, «Convocado». */
export function labelFor(format: MatchFormat, n: number | null | undefined): string {
  if (n == null) return "Convocado";
  if (!inRange(format, n)) throw new RangeError(`Dorsal ${n} fuera de rango para ${format}`);
  return isStarterNumber(format, n) ? (LABELS[format][n - 1] as string) : "Suplente";
}

/** isStarter y posición derivados del dorsal (sin dorsal: suplente sin posición). */
export function slotFor(format: MatchFormat, n: number | null): { isStarter: boolean; position: RugbyPosition | null } {
  if (n == null) return { isStarter: false, position: null };
  return { isStarter: isStarterNumber(format, n), position: positionFor(format, n) };
}

/** Descripción para el aviso: «Titular · Apertura (n.º 5)», «Suplente (n.º 9)» o «Convocado». */
export function describeSlot(format: MatchFormat, n: number | null): string {
  if (n == null) return "Convocado";
  return isStarterNumber(format, n) ? `Titular · ${labelFor(format, n)} (n.º ${n})` : `Suplente (n.º ${n})`;
}

export interface LineupPlayer {
  userId: string;
  shirtNumber: number | null;
}

/** Errores (en español) de la alineación; vacío si es válida. */
export function validateLineup(format: MatchFormat, players: LineupPlayer[]): string[] {
  const errors: string[] = [];
  const numbers = new Set<number>();
  const users = new Set<string>();
  const total = SLOTS[format].total;
  for (const p of players) {
    if (users.has(p.userId)) errors.push("Jugador repetido en la alineación");
    users.add(p.userId);
    if (p.shirtNumber == null) continue;
    if (!inRange(format, p.shirtNumber)) {
      errors.push(`Dorsal ${p.shirtNumber} fuera de rango (1-${total})`);
      continue;
    }
    if (numbers.has(p.shirtNumber)) errors.push(`Dorsal ${p.shirtNumber} repetido`);
    numbers.add(p.shirtNumber);
  }
  return Array.from(new Set(errors));
}
