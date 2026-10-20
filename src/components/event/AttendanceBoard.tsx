"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useVisibleRefresh } from "@/hooks/useVisibleRefresh";
import { RugbyPosition } from "@prisma/client";
import { Warning } from "@phosphor-icons/react/dist/ssr";
import { PlayerRpeControl, type PlayerRpeEntry } from "@/components/event/PlayerRpeControl";
import { attendanceState, countsForEvent, listTaken, type EventTimesLike } from "@/lib/attendance";

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

export function AttendanceBoard({ eventId, initialAttendances, event, nowIso }: AttendanceBoardProps) {
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

  // Contadores (reglas comunes en src/lib/attendance.ts)
  const rows = attendances.map((a) => ({
    status: a.status as "PENDING" | "CONFIRMED" | "DECLINED",
    checkedIn: a.checkedIn,
  }));
  const taken = listTaken(rows);
  const started = now.getTime() >= eventTimes.startDate.getTime();
  const counts = countsForEvent(rows, eventTimes, now);
  const totalConvocados = attendances.length;
  const presentes = counts.present;
  const ausentes = counts.absent + counts.declined;
  const pendientes = counts.pending + counts.confirmed + counts.notTaken;

  return (
    <div className="space-y-6">
      {error && (
        <div className="border border-destructive bg-destructive/10 p-4 text-sm font-mono font-bold text-destructive">
          <Warning size={24} weight="regular" className="inline mr-2" /> {error}
        </div>
      )}

      {/* Contadores Estadísticos */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border border-primary/30 bg-primary/5 p-4 text-center shadow-sm">
          <div className="text-4xl font-heading font-black text-primary">{presentes}</div>
          <div className="text-xs font-mono mt-1 font-bold uppercase tracking-widest text-muted-foreground">Presentes</div>
        </div>
        <div className="border border-destructive/30 bg-destructive/5 p-4 text-center shadow-sm">
          <div className="text-4xl font-heading font-black text-destructive">{ausentes}</div>
          <div className="text-xs font-mono mt-1 font-bold uppercase tracking-widest text-muted-foreground">Ausentes</div>
        </div>
        <div className="border border-border bg-card p-4 text-center shadow-sm">
          <div className="text-4xl font-heading font-black text-foreground">{pendientes}</div>
          <div className="text-xs font-mono mt-1 font-bold uppercase tracking-widest text-muted-foreground">Pendientes</div>
        </div>
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
            attendances.map((player) => (
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
                    <h4 className="font-bold text-sm text-foreground">{player.name}</h4>
                    <p className="text-[11px] font-mono text-muted-foreground mt-0.5 uppercase tracking-widest">
                      {player.position ? positionLabels[player.position] : "Sin posición asignada"}
                    </p>
                  </div>
                </div>

                {/* RSVP y Estado real-time */}
                <div className="flex items-center gap-4 pl-13 sm:pl-0 justify-between sm:justify-end">
                  <div className="flex flex-col items-end gap-1">
                    {(() => {
                      const state = attendanceState(
                        { status: player.status as "PENDING" | "CONFIRMED" | "DECLINED", checkedIn: player.checkedIn },
                        eventTimes,
                        now,
                        taken
                      );
                      if (state === "present") {
                        return (
                          <span className="bg-primary/10 border border-primary/30 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-widest text-primary">
                            Presente (Check-In)
                          </span>
                        );
                      }
                      if (state === "declined" || state === "absent") {
                        return (
                          <span className="bg-destructive/10 border border-destructive/30 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-widest text-destructive">
                            {player.status === "DECLINED" ? "Ausente (Declinó)" : "Ausente"}
                          </span>
                        );
                      }
                      return (
                        <span className="bg-secondary border border-border px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
                          Pendiente
                        </span>
                      );
                    })()}

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
