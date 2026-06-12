"use client";

import React, { useEffect, useState } from "react";
import { useSocket } from "@/hooks/useSocket";
import { RugbyPosition } from "@prisma/client";

interface PlayerAttendance {
  userId: string;
  name: string;
  image: string | null;
  position: RugbyPosition | null;
  jerseyNumber: number | null;
  status: string;
  checkedIn: boolean;
  checkedInAt: string | null;
}

interface AttendanceBoardProps {
  eventId: string;
  initialAttendances: PlayerAttendance[];
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

export function AttendanceBoard({ eventId, initialAttendances }: AttendanceBoardProps) {
  const [attendances, setAttendances] = useState<PlayerAttendance[]>(initialAttendances);
  const [sessionActive, setSessionActive] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { socket, connected } = useSocket(eventId);

  useEffect(() => {
    if (!socket) return;

    socket.on("session_status_change", ({ active }) => {
      setSessionActive(active);
    });

    socket.on("attendance_update", (data) => {
      setAttendances((prev) =>
        prev.map((att) =>
          att.userId === data.userId
            ? {
                ...att,
                checkedIn: data.checkedIn,
                checkedInAt: data.checkedInAt,
                status: data.status,
              }
            : att
        )
      );
    });

    socket.on("error", (err) => {
      setError(err.message);
    });

    // Solicita estado inicial al conectar
    socket.emit("join_session", { eventId });

    return () => {
      socket.off("session_status_change");
      socket.off("attendance_update");
      socket.off("error");
    };
  }, [socket, eventId]);

  const handleToggleSession = async (action: "start" | "stop") => {
    setError(null);
    setLoadingSession(true);

    try {
      const response = await fetch(`/api/events/${eventId}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al modificar la sesión");
      }

      setSessionActive(action === "start");
    } catch (err: any) {
      setError(err.message || "Ocurrió un error con la sesión");
    } finally {
      setLoadingSession(false);
    }
  };

  const handleManualCheckIn = async (userId: string, checkedIn: boolean) => {
    setError(null);

    try {
      const response = await fetch(`/api/events/${eventId}/attendance/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkedIn,
          status: checkedIn ? "CONFIRMED" : "PENDING",
        }),
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
    } catch (err: any) {
      setError(err.message || "Ocurrió un error al registrar la asistencia");
    }
  };

  // Contadores
  const totalConvocados = attendances.length;
  const presentes = attendances.filter((a) => a.checkedIn).length;
  const ausentes = attendances.filter((a) => !a.checkedIn && a.status === "DECLINED").length;
  const pendientes = totalConvocados - presentes - ausentes;

  return (
    <div className="space-y-6">
      {error && (
        <div className="border border-destructive bg-destructive/10 p-4 text-sm font-mono font-bold text-destructive">
          ⚠️ {error}
        </div>
      )}

      {/* Control de Sesión Activa */}
      <div className="border border-border bg-card shadow-sm p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-heading font-extrabold tracking-tighter uppercase">Sesión de Check-In</h2>
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                sessionActive ? "bg-primary animate-pulse" : "bg-muted-foreground"
              }`}
            />
          </div>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
            {sessionActive
              ? "Los jugadores pueden marcar su presente ingresando al detalle del evento."
              : "La sesión está cerrada. Los jugadores no pueden registrar su asistencia por sí mismos."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground font-bold">
            WebSocket:{" "}
            <span className={connected ? "text-primary font-bold" : "text-destructive font-bold"}>
              {connected ? "Conectado" : "Desconectado"}
            </span>
          </span>

          {sessionActive ? (
            <button
              onClick={() => handleToggleSession("stop")}
              disabled={loadingSession}
              className="bg-destructive hover:opacity-90 text-white px-5 py-2.5 text-xs font-mono uppercase tracking-widest font-bold transition-all disabled:opacity-50"
            >
              Detener Sesión
            </button>
          ) : (
            <button
              onClick={() => handleToggleSession("start")}
              disabled={loadingSession}
              className="bg-primary hover:opacity-90 text-primary-foreground px-5 py-2.5 text-xs font-mono uppercase tracking-widest font-bold transition-all disabled:opacity-50"
            >
              Iniciar Sesión (4h)
            </button>
          )}
        </div>
      </div>

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
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-secondary/40 transition-all"
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
                    {player.checkedIn ? (
                      <span className="bg-primary/10 border border-primary/30 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-widest text-primary">
                        Presente (Check-In)
                      </span>
                    ) : player.status === "DECLINED" ? (
                      <span className="bg-destructive/10 border border-destructive/30 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-widest text-destructive">
                        Ausente (Declinó)
                      </span>
                    ) : (
                      <span className="bg-secondary border border-border px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
                        Pendiente
                      </span>
                    )}

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
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
