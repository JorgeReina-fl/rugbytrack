"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useVisibleRefresh } from "@/hooks/useVisibleRefresh";
import { RugbyPosition } from "@prisma/client";
import { Warning } from "@phosphor-icons/react/dist/ssr";
import { PlayerRpeControl, type PlayerRpeEntry } from "@/components/event/PlayerRpeControl";
import { attendanceState, countsForEvent, listTaken, type AttendanceState, type EventTimesLike } from "@/lib/attendance";

interface PlayerAttendance {
  userId: string;
  name: string;
  image: string | null;
  position: RugbyPosition | null;
  jerseyNumber: number | null;
  status: string;
  checkedIn: boolean;
  checkedInAt: string | null;
  rpe: PlayerRpeEntry | null;
}

interface AttendanceBoardProps {
  eventId: string;
  initialAttendances: PlayerAttendance[];
  /** Fechas ISO del evento y hora del servidor: las reglas de asistencia dependen de ellas. */
  event: { startDate: string; endDate: string | null; rsvpDeadline: string | null };
  nowIso: string;
  /** Solo el coach ve la acción masiva; la página del panel ya exige coach activo. */
  isCoach?: boolean;
  /** Jugadores con alguna molestia en este evento: se marcan con «Molestia» (enlaza a la lista). */
  discomfortUserIds?: string[];
}

const positionLabels: Record<RugbyPosition, string> = {
  PROP_LOOSEHEAD: "Pilar Izquierdo",
  HOOKER: "Talonador",
  PROP_TIGHTHEAD: "Pilar Derecho",
  LOCK: "Segunda Línea",
  FLANKER_BLINDSIDE: "Flanker Ciego",
  FLANKER_OPENSIDE: "Flanker Abierto",
  NUMBER_EIGHT: "Número 8",
  SCRUM_HALF: "Medio Melé",
  FLY_HALF: "Apertura",
  CENTER_INSIDE: "Primer Centro",
  CENTER_OUTSIDE: "Segundo Centro",
  WING_LEFT: "Ala Izquierdo",
  WING_RIGHT: "Ala Derecho",
  FULLBACK: "Zaguero",
  REPLACEMENT: "Suplente",
};

/** Orden de los grupos de la lista. */
const STATE_ORDER: AttendanceState[] = ["present", "confirmed", "pending", "declined", "absent", "not_taken"];

const BADGE = "px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-widest border";
const stateBadge: Record<AttendanceState, { cls: string; label: string }> = {
  present: { cls: "bg-primary/10 border-primary/30 text-primary", label: "Presente" },
  confirmed: { cls: "bg-blue-100 text-blue-800 border-blue-200", label: "Confirmado" },
  pending: { cls: "bg-secondary border-border text-muted-foreground", label: "Sin respuesta" },
  declined: { cls: "bg-destructive/10 border-destructive/30 text-destructive", label: "No asistirá" },
  absent: { cls: "bg-destructive/10 border-destructive/30 text-destructive", label: "Ausente" },
  not_taken: { cls: "bg-secondary border-border text-muted-foreground", label: "Sin pasar lista" },
};

export function AttendanceBoard({ eventId, initialAttendances, event, nowIso, isCoach = false, discomfortUserIds = [] }: AttendanceBoardProps) {
  const [attendances, setAttendances] = useState<PlayerAttendance[]>(initialAttendances);
  const [now, setNow] = useState(() => new Date(nowIso));

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const eventTimes: EventTimesLike = {
    startDate: new Date(event.startDate),
    endDate: event.endDate ? new Date(event.endDate) : null,
    rsvpDeadline: event.rsvpDeadline ? new Date(event.rsvpDeadline) : null,
  };
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const router = useRouter();

  // Varios coaches pueden marcar a la vez: refresco periódico solo con la pestaña visible
  useVisibleRefresh();

  // Cada refresh trae filas nuevas del servidor
  useEffect(() => {
    setAttendances(initialAttendances);
  }, [initialAttendances]);

  const handleManualCheckIn = async (userId: string, checkedIn: boolean) => {
    setError(null);

    try {
      const response = await fetch(`/api/events/${eventId}/attendance/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkedIn }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al registrar asistencia manual");
      }

      // Actualiza estado local inmediatamente para respuesta instantánea
      setAttendances((prev) =>
        prev.map((att) =>
          att.userId === userId
            ? {
                ...att,
                checkedIn: result.data.checkedIn,
                checkedInAt: result.data.checkedInAt,
                status: result.data.status,
              }
            : att
        )
      );
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Ocurrió un error al registrar la asistencia");
    }
  };

  const handleMarkConfirmed = async () => {
    setError(null);
    setBulkBusy(true);

    try {
      const response = await fetch(`/api/events/${eventId}/attendance/confirmed-present`, { method: "POST" });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al marcar a los confirmados");
      }

      // Mismo tratamiento que tras setPresence: se aplican las filas devueltas por la API
      const updated = new Map<string, { checkedIn: boolean; checkedInAt: string | null; status: string }>(
        result.data.attendances.map((a: { userId: string; checkedIn: boolean; checkedInAt: string | null; status: string }) => [a.userId, a])
      );
      setAttendances((prev) =>
        prev.map((att) => {
          const row = updated.get(att.userId);
          return row ? { ...att, checkedIn: row.checkedIn, checkedInAt: row.checkedInAt, status: row.status } : att;
        })
      );
      setConfirmOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Ocurrió un error al marcar a los confirmados");
      setConfirmOpen(false);
    } finally {
      setBulkBusy(false);
    }
  };

  // Contadores y orden (reglas comunes en src/lib/attendance.ts)
  const rows = attendances.map((a) => ({
    status: a.status as "PENDING" | "CONFIRMED" | "DECLINED",
    checkedIn: a.checkedIn,
  }));
  const taken = listTaken(rows);
  const started = now.getTime() >= eventTimes.startDate.getTime();
  const counts = countsForEvent(rows, eventTimes, now);
  const totalConvocados = attendances.length;
  const confirmedToMark = attendances.filter((a) => a.status === "CONFIRMED" && !a.checkedIn).length;
  const noAsisten = counts.declined + counts.absent;

  const stateOf = (p: PlayerAttendance): AttendanceState =>
    attendanceState({ status: p.status as "PENDING" | "CONFIRMED" | "DECLINED", checkedIn: p.checkedIn }, eventTimes, now, taken);
  const sorted = attendances
    .map((player) => ({ player, state: stateOf(player) }))
    .sort(
      (a, b) =>
        STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state) || a.player.name.localeCompare(b.player.name, "es")
    );

  return (
    <div className="space-y-6">
      {error && (
        <div className="border border-destructive bg-destructive/10 p-4 text-sm font-mono font-bold text-destructive">
          <Warning size={24} weight="regular" className="inline mr-2" /> {error}
        </div>
      )}

      {isCoach && confirmedToMark > 0 && (
        <div className="flex justify-end">
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={bulkBusy}
            className="px-4 py-2 text-xs font-mono font-bold uppercase tracking-widest border border-primary/30 bg-primary text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50"
          >
            Marcar confirmados como presentes
          </button>
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="bulk-present-title" className="w-full max-w-md border border-border bg-card p-6 shadow-sm space-y-4">
            <h3 id="bulk-present-title" className="font-mono font-bold text-sm uppercase tracking-widest">
              Marcar {confirmedToMark} {confirmedToMark === 1 ? "confirmado" : "confirmados"} como {confirmedToMark === 1 ? "presente" : "presentes"}
            </h3>
            <p className="text-sm text-muted-foreground">
              Se registrará la asistencia de los jugadores con respuesta «Asistiré» que aún no están marcados. Puedes corregir cada marca después.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={bulkBusy}
                className="px-4 py-2 text-xs font-mono font-bold uppercase tracking-widest border border-border text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleMarkConfirmed}
                disabled={bulkBusy}
                className="px-4 py-2 text-xs font-mono font-bold uppercase tracking-widest border border-primary/30 bg-primary text-primary-foreground disabled:opacity-50"
              >
                {bulkBusy ? "Marcando…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contadores Estadísticos */}
      <div className={`grid grid-cols-2 gap-4 ${counts.notTaken > 0 ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}>
        <div className="border border-primary/30 bg-primary/5 p-4 text-center shadow-sm">
          <div className="text-4xl font-heading font-black text-primary">{counts.present}</div>
          <div className="text-xs font-mono mt-1 font-bold uppercase tracking-widest text-muted-foreground">Presentes</div>
        </div>
        <div className="border border-blue-200 bg-blue-100 p-4 text-center shadow-sm">
          <div className="text-4xl font-heading font-black text-blue-800">{counts.confirmed}</div>
          <div className="text-xs font-mono mt-1 font-bold uppercase tracking-widest text-muted-foreground">Confirmados</div>
        </div>
        <div className="border border-border bg-card p-4 text-center shadow-sm">
          <div className="text-4xl font-heading font-black text-foreground">{counts.pending}</div>
          <div className="text-xs font-mono mt-1 font-bold uppercase tracking-widest text-muted-foreground">Sin respuesta</div>
        </div>
        <div className="border border-destructive/30 bg-destructive/5 p-4 text-center shadow-sm">
          <div className="text-4xl font-heading font-black text-destructive">{noAsisten}</div>
          <div className="text-xs font-mono mt-1 font-bold uppercase tracking-widest text-muted-foreground">No asisten / Ausentes</div>
        </div>
        {counts.notTaken > 0 && (
          <div className="border border-border bg-card p-4 text-center shadow-sm">
            <div className="text-4xl font-heading font-black text-foreground">{counts.notTaken}</div>
            <div className="text-xs font-mono mt-1 font-bold uppercase tracking-widest text-muted-foreground">Sin pasar lista</div>
          </div>
        )}
      </div>

      {/* Tabla/Lista de jugadores */}
      <div className="border border-border bg-card shadow-sm overflow-hidden">
        <div className="border-b border-border bg-secondary px-4 py-4">
          <h3 className="font-mono font-bold text-sm uppercase tracking-widest">Plantilla Convocada ({totalConvocados})</h3>
        </div>

        <div className="divide-y divide-border">
          {attendances.length === 0 ? (
            <div className="p-8 text-center text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground italic">
              No hay jugadores convocados para este evento.
            </div>
          ) : (
            sorted.map(({ player, state }) => (
              <div
                key={player.userId}
                className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between p-4 gap-3 hover:bg-secondary/40 transition-all"
              >
                {/* Info Jugador */}
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center border border-border bg-secondary font-heading font-black text-sm text-foreground">
                    {player.jerseyNumber || "—"}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground">
                      {player.name}
                      {discomfortUserIds.includes(player.userId) && (
                        <a
                          href="#molestias"
                          className="ml-2 align-middle bg-destructive/10 text-destructive border border-destructive/20 px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider hover:underline"
                        >
                          Molestia
                        </a>
                      )}
                    </h4>
                    <p className="text-[11px] font-mono text-muted-foreground mt-0.5 uppercase tracking-widest">
                      {player.position ? positionLabels[player.position] : "Sin posición asignada"}
                    </p>
                  </div>
                </div>

                {/* RSVP y Estado real-time */}
                <div className="flex items-center gap-4 pl-13 sm:pl-0 justify-between sm:justify-end">
                  <div className="flex flex-col items-end gap-1">
                    <span className={`${BADGE} ${stateBadge[state].cls}`}>
                      {state === "absent" && player.status === "DECLINED" ? "Ausente (no asistirá)" : stateBadge[state].label}
                    </span>

                    {player.checkedInAt && (
                      <span className="text-[9px] font-mono text-muted-foreground">
                        {new Date(player.checkedInAt).toLocaleTimeString("es-ES", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>

                  {/* Manual Overrides */}
                  <div className="flex border border-border bg-card p-0.5">
                    <button
                      onClick={() => handleManualCheckIn(player.userId, true)}
                      className={`px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-widest transition-all ${
                        player.checkedIn
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                      }`}
                    >
                      Presente
                    </button>
                    <button
                      onClick={() => handleManualCheckIn(player.userId, false)}
                      className={`px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-widest transition-all ${
                        !player.checkedIn
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                      }`}
                    >
                      Ausente
                    </button>
                  </div>
                </div>

                <PlayerRpeControl
                  eventId={eventId}
                  userId={player.userId}
                  name={player.name}
                  checkedIn={player.checkedIn}
                  started={started}
                  entry={player.rpe}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
