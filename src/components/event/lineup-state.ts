import type { MatchFormat } from "@prisma/client";
import { SLOTS, type LineupPlayer } from "@/lib/lineup-core";

/** Alineación en edición: dorsal → jugador, más los convocados sin dorsal. */
export interface LineupState {
  format: MatchFormat;
  slots: Record<number, string>;
  unnumbered: string[];
}

export interface LineupValue {
  format: MatchFormat;
  players: LineupPlayer[];
}

export function starterNumbers(format: MatchFormat): number[] {
  return Array.from({ length: SLOTS[format].starters }, (_, i) => i + 1);
}

export function substituteNumbers(format: MatchFormat): number[] {
  const { starters, total } = SLOTS[format];
  return Array.from({ length: total - starters }, (_, i) => starters + i + 1);
}

export function fromValue(value: LineupValue): LineupState {
  const total = SLOTS[value.format].total;
  const slots: Record<number, string> = {};
  const unnumbered: string[] = [];
  const seen = new Set<string>();
  for (const p of value.players) {
    if (seen.has(p.userId)) continue;
    seen.add(p.userId);
    const n = p.shirtNumber;
    if (n != null && n >= 1 && n <= total && slots[n] === undefined) slots[n] = p.userId;
    else unnumbered.push(p.userId);
  }
  return { format: value.format, slots, unnumbered };
}

export function toValue(state: LineupState): LineupValue {
  const numbered = Object.entries(state.slots)
    .map(([n, userId]) => ({ userId, shirtNumber: Number(n) }))
    .sort((a, b) => a.shirtNumber - b.shirtNumber);
  return { format: state.format, players: [...numbered, ...state.unnumbered.map((userId) => ({ userId, shirtNumber: null }))] };
}

export function slotOf(state: LineupState, userId: string): number | null {
  for (const [n, id] of Object.entries(state.slots)) if (id === userId) return Number(n);
  return null;
}

/** Asigna (o libera con null) un dorsal. Un jugador ya colocado en otro dorsal no se repite: se ignora. */
export function assign(state: LineupState, shirtNumber: number, userId: string | null): LineupState {
  const slots = { ...state.slots };
  if (userId === null) {
    delete slots[shirtNumber];
    return { ...state, slots };
  }
  const current = slotOf(state, userId);
  if (current !== null && current !== shirtNumber) return state;
  slots[shirtNumber] = userId;
  return { ...state, slots, unnumbered: state.unnumbered.filter((id) => id !== userId) };
}

/** Marca o desmarca a un jugador sin dorsal. Quien tiene dorsal no se toca desde la lista. */
export function toggleUnnumbered(state: LineupState, userId: string): LineupState {
  if (slotOf(state, userId) !== null) return state;
  const unnumbered = state.unnumbered.includes(userId)
    ? state.unnumbered.filter((id) => id !== userId)
    : [...state.unnumbered, userId];
  return { ...state, unnumbered };
}

/** Cambia de formato: conserva a quien tiene un dorsal válido en el nuevo y pasa al resto a sin dorsal. */
export function changeFormat(state: LineupState, format: MatchFormat): { state: LineupState; demoted: string[] } {
  if (format === state.format) return { state, demoted: [] };
  const total = SLOTS[format].total;
  const slots: Record<number, string> = {};
  const demoted: string[] = [];
  for (const [n, userId] of Object.entries(state.slots)) {
    if (Number(n) <= total) slots[Number(n)] = userId;
    else demoted.push(userId);
  }
  return { state: { format, slots, unnumbered: [...state.unnumbered, ...demoted] }, demoted };
}

export function counts(state: LineupState): { starters: number; substitutes: number; unnumbered: number } {
  const starters = Object.keys(state.slots).filter((n) => Number(n) <= SLOTS[state.format].starters).length;
  return { starters, substitutes: Object.keys(state.slots).length - starters, unnumbered: state.unnumbered.length };
}
