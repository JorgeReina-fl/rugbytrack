import { eventEnd, type EventTimesLike } from "./attendance";

/** El jugador puede registrar su RPE desde el inicio del evento hasta 48 h después de su fin. */
export const RPE_PLAYER_WINDOW_MS = 48 * 60 * 60 * 1000;

export type RpeWindowState = "not_started" | "open" | "closed";

export interface RpeWindow {
  opensAt: Date;
  closesAt: Date;
  state: RpeWindowState;
}

/** Pura y sin Prisma: la usan la API, las páginas y los componentes de cliente. El coach no tiene plazo. */
export function rpeWindow(event: Pick<EventTimesLike, "startDate" | "endDate">, now: Date): RpeWindow {
  const opensAt = event.startDate;
  const closesAt = new Date(eventEnd(event).getTime() + RPE_PLAYER_WINDOW_MS);
  const state: RpeWindowState =
    now.getTime() < opensAt.getTime() ? "not_started" : now.getTime() >= closesAt.getTime() ? "closed" : "open";
  return { opensAt, closesAt, state };
}

export type PlayerRpeUi = "form" | "closed" | "registered" | "none";

/** Qué muestra la UI a un jugador que ya tiene permiso para registrar RPE. */
export function playerRpeUi(state: RpeWindowState, hasEntry: boolean): PlayerRpeUi {
  if (hasEntry) return "registered";
  if (state === "open") return "form";
  if (state === "closed") return "closed";
  return "none";
}
