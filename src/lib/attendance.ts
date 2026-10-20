/**
 * Reglas de producto de asistencia como funciones puras (sin Prisma, sin Date local).
 *
 * R1. RSVP abierto mientras now < min(rsvpDeadline ?? startDate, startDate).
 * R2. Lo que marca el coach (presente/ausente) es el estado final y lo único que cuenta en
 *     estadísticas, tasas y RPE. `status` conserva el RSVP original; el check-in nunca lo modifica.
 * R3. El coach puede corregir su marca en cualquier momento; desmarcar no toca `status`.
 * R4. Evento pasado sin lista → "sin pasar lista" (not_taken), no cuenta en tasas.
 *
 * Todas las comparaciones son entre instantes (Date.getTime()), independientes de la zona horaria.
 */

export type RsvpStatus = "PENDING" | "CONFIRMED" | "DECLINED";

export type AttendanceState =
  | "pending"
  | "confirmed"
  | "declined"
  | "present"
  | "absent"
  | "not_taken";

export interface AttendanceRowLike {
  status: RsvpStatus;
  checkedIn: boolean;
}

export interface EventTimesLike {
  startDate: Date;
  endDate?: Date | null;
  rsvpDeadline?: Date | null;
}

export interface EventCounts {
  present: number;
  absent: number;
  confirmed: number;
  declined: number;
  pending: number;
  notTaken: number;
}

/**
 * Duración asumida cuando el evento no tiene endDate, para decidir cuándo ha "terminado".
 * Es una suposición de producto: ajustar si los entrenos/partidos duran más.
 */
export const DEFAULT_EVENT_DURATION_MS = 3 * 60 * 60 * 1000;

export function eventEnd(event: EventTimesLike): Date {
  return event.endDate ?? new Date(event.startDate.getTime() + DEFAULT_EVENT_DURATION_MS);
}

/** R1: el RSVP se cierra en el plazo, o en el inicio si no hay plazo o el plazo es posterior. */
export function isRsvpOpen(event: EventTimesLike, now: Date): boolean {
  const start = event.startDate.getTime();
  const deadline = event.rsvpDeadline ? event.rsvpDeadline.getTime() : start;
  return now.getTime() < Math.min(deadline, start);
}

/**
 * ¿Se ha pasado lista? Hoy: al menos una fila con checkedIn.
 * Limitación conocida: no distingue "lista sin nadie presente" de "sin pasar lista".
 * Punto preparado para un campo futuro (p. ej. Event.attendanceTakenAt): bastaría con
 * añadirlo aquí y devolver true si está informado.
 */
export function listTaken(rows: ReadonlyArray<Pick<AttendanceRowLike, "checkedIn">>): boolean {
  return rows.some((r) => r.checkedIn);
}

/**
 * R2/R3: manda la marca del coach (checkedIn); status solo es histórico.
 * Evento terminado: con lista tomada y sin marca → absent; sin lista → not_taken (R4).
 * Evento en curso o futuro y sin marca → estado del RSVP.
 */
export function attendanceState(
  row: AttendanceRowLike,
  event: EventTimesLike,
  now: Date,
  taken: boolean
): AttendanceState {
  if (row.checkedIn) return "present";
  const ended = now.getTime() >= eventEnd(event).getTime();
  // Durante el evento la lista se va tomando: quien aún no ha llegado conserva su RSVP.
  if (ended) return taken ? "absent" : "not_taken";
  switch (row.status) {
    case "CONFIRMED":
      return "confirmed";
    case "DECLINED":
      return "declined";
    default:
      return "pending";
  }
}

const STATE_TO_KEY: Record<AttendanceState, keyof EventCounts> = {
  present: "present",
  absent: "absent",
  confirmed: "confirmed",
  declined: "declined",
  pending: "pending",
  not_taken: "notTaken",
};

export function countsForEvent(
  rows: ReadonlyArray<AttendanceRowLike>,
  event: EventTimesLike,
  now: Date
): EventCounts {
  const taken = listTaken(rows);
  const counts: EventCounts = {
    present: 0,
    absent: 0,
    confirmed: 0,
    declined: 0,
    pending: 0,
    notTaken: 0,
  };
  for (const row of rows) {
    counts[STATE_TO_KEY[attendanceState(row, event, now, taken)]]++;
  }
  return counts;
}

export interface EventRows {
  event: EventTimesLike;
  rows: ReadonlyArray<AttendanceRowLike>;
}

/**
 * present / (present + absent), contando solo eventos terminados con lista tomada (R4):
 * un evento en curso no cuenta, porque aún no se sabe quién será absent.
 * `filter` limita las filas contadas (p. ej. un jugador) DESPUÉS de decidir si la lista
 * se tomó con todas las filas del evento. null si no hay denominador.
 */
export function attendanceRate(
  events: ReadonlyArray<EventRows>,
  now: Date,
  filter: (row: AttendanceRowLike) => boolean = () => true
): number | null {
  let present = 0;
  let absent = 0;
  for (const { event, rows } of events) {
    if (now.getTime() < eventEnd(event).getTime() || !listTaken(rows)) continue;
    for (const row of rows) {
      if (!filter(row)) continue;
      if (row.checkedIn) present++;
      else absent++;
    }
  }
  const denom = present + absent;
  return denom === 0 ? null : present / denom;
}

/**
 * Con lista tomada solo cuenta quien fue marcado presente (R2); sin lista (evento en curso
 * o aún sin pasar lista) vale el RSVP confirmado.
 */
export function canSubmitRpe(row: AttendanceRowLike, taken: boolean): boolean {
  return taken ? row.checkedIn : row.status === "CONFIRMED";
}
