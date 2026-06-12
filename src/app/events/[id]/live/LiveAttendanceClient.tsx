"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveSocket } from "@/hooks/useLiveSocket";
import type { RugbyPosition } from "@prisma/client";

interface PlayerRecord {
  userId: string;
  name: string;
  image: string | null;
  position: RugbyPosition | null;
  jerseyNumber: number | null;
  status: string;
  checkedIn: boolean;
  checkedInAt: string | null;
}

interface Props {
  eventId: string;
  eventTitle: string;
  isCoach: boolean;
  currentUserId: string;
  initialAttendances: PlayerRecord[];
}

const POSITION_LABELS: Partial<Record<RugbyPosition, string>> = {
  PROP_LOOSEHEAD: "1 Pilar Zurdo",
  HOOKER: "2 Talonador",
  PROP_TIGHTHEAD: "3 Pilar Derecho",
  LOCK: "4/5 Segundo Línea",
  FLANKER_BLINDSIDE: "6 Ala Ciega",
  FLANKER_OPENSIDE: "7 Ala Abierta",
  NUMBER_EIGHT: "8 Octavo",
  SCRUM_HALF: "9 Medio Mêlée",
  FLY_HALF: "10 Apertura",
  CENTER_INSIDE: "12 Centro Int.",
  CENTER_OUTSIDE: "13 Centro Ext.",
  WING_LEFT: "11 Ala Izq.",
  WING_RIGHT: "14 Ala Der.",
  FULLBACK: "15 Zaguero",
  REPLACEMENT: "Reserva",
};

function getStatusStyle(player: PlayerRecord) {
  if (player.checkedIn)
    return {
      card: "border-primary/40 bg-primary/5",
      badge: "bg-primary/15 border-primary/30 text-primary",
      dot: "bg-primary animate-pulse",
      label: "Presente",
    };
  if (player.status === "DECLINED")
    return {
      card: "border-red-300/40 bg-red-50/30",
      badge: "bg-red-100/40 border-red-300/30 text-red-600",
      dot: "bg-red-400",
      label: "Ausente",
    };
  if (player.status === "CONFIRMED")
    return {
      card: "border-amber-300/40 bg-amber-50/30",
      badge: "bg-amber-100/40 border-amber-300/30 text-amber-600",
      dot: "bg-amber-400",
      label: "Confirmado",
    };
  return {
    card: "border-border bg-card",
    badge: "bg-secondary border-border text-muted-foreground",
    dot: "bg-muted-foreground/40",
    label: "Pendiente",
  };
}

/** Animated counter — smoothly transitions to new value */
function AnimatedCount({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  const [flash, setFlash] = useState(false);
  const prevRef = useRef(value);

  useEffect(() => {
    if (value !== prevRef.current) {
      setFlash(true);
      setDisplay(value);
      prevRef.current = value;
      const t = setTimeout(() => setFlash(false), 600);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [value]);

  return (
    <span
      className={`transition-all duration-300 ${flash ? "scale-110 text-primary" : ""} ${className ?? ""}`}
      style={{ display: "inline-block" }}
    >
      {display}
    </span>
  );
}

export function LiveAttendanceClient({
  eventId,
  eventTitle,
  isCoach,
  currentUserId,
  initialAttendances,
}: Props) {
  const [attendances, setAttendances] = useState<PlayerRecord[]>(initialAttendances);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [checkInError, setCheckInError] = useState("");
  const [checkingIn, setCheckingIn] = useState(false);

  const { socket, connected, sessionActive, checkIn } = useLiveSocket(eventId);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = (data: {
      userId: string;
      name: string;
      checkedIn: boolean;
      checkedInAt: string | null;
      status: string;
    }) => {
      setAttendances((prev) => {
        const existing = prev.find((a) => a.userId === data.userId);
        if (existing) {
          return prev.map((a) =>
            a.userId === data.userId
              ? { ...a, checkedIn: data.checkedIn, checkedInAt: data.checkedInAt, status: data.status }
              : a
          );
        }
        // New player appeared (e.g., late callup) — append
        return [
          ...prev,
          {
            userId: data.userId,
            name: data.name,
            image: null,
            position: null,
            jerseyNumber: null,
            status: data.status,
            checkedIn: data.checkedIn,
            checkedInAt: data.checkedInAt,
          },
        ];
      });
      setLastUpdate(new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };

    const handleError = (err: { message: string }) => {
      setCheckInError(err.message);
      setCheckingIn(false);
    };

    socket.on("attendance_update", handleUpdate);
    socket.on("error", handleError);

    return () => {
      socket.off("attendance_update", handleUpdate);
      socket.off("error", handleError);
    };
  }, [socket]);

  const handleSelfCheckIn = () => {
    setCheckInError("");
    setCheckingIn(true);
    checkIn();
    // Reset spinner after 3s (socket event will update state)
    setTimeout(() => setCheckingIn(false), 3000);
  };

  // Counters
  const total = attendances.length;
  const confirmed = attendances.filter((a) => a.checkedIn).length;
  const rsvpd = attendances.filter((a) => a.status === "CONFIRMED" && !a.checkedIn).length;
  const declined = attendances.filter((a) => a.status === "DECLINED").length;
  const pending = total - confirmed - rsvpd - declined;

  // Visible players: coach sees all; player sees all (read-only diff)
  const visible = attendances;
  const currentPlayer = attendances.find((a) => a.userId === currentUserId);
  const alreadyCheckedIn = currentPlayer?.checkedIn ?? false;

  const progressPct = total > 0 ? Math.round((confirmed / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Connection + session status bar */}
      <div className="flex items-center justify-between border border-border bg-card px-5 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <span
            className={`h-2 w-2 rounded-full ${connected ? "bg-primary animate-pulse" : "bg-muted-foreground/40"}`}
          />
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">
            WebSocket:{" "}
            <span className={connected ? "text-primary" : "text-muted-foreground"}>
              {connected ? "Conectado" : "Reconectando..."}
            </span>
          </span>
          {lastUpdate && (
            <span className="text-xs font-mono text-muted-foreground hidden sm:inline">
              Última actualización: {lastUpdate}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${sessionActive ? "bg-primary animate-pulse" : "bg-muted-foreground/30"}`}
          />
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">
            Sesión:{" "}
            <span className={sessionActive ? "text-primary" : "text-muted-foreground"}>
              {sessionActive ? "Activa" : "Cerrada"}
            </span>
          </span>
        </div>
      </div>

      {/* Animated summary counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Confirmed / Total hero counter */}
        <div className="col-span-2 border border-primary/30 bg-primary/5 p-5 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-mono font-bold uppercase tracking-widest text-primary mb-1">
              Confirmados
            </div>
            <div className="text-5xl font-heading font-black text-primary leading-none">
              <AnimatedCount value={confirmed} /> 
              <span className="text-2xl text-muted-foreground font-bold">/{total}</span>
            </div>
            {/* Progress bar */}
            <div className="mt-3 w-full h-1.5 bg-border overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-700 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
          <div className="text-5xl font-heading font-black text-primary/20 select-none">
            {progressPct}%
          </div>
        </div>

        <div className="border border-amber-300/30 bg-amber-50/20 p-4 text-center shadow-sm">
          <div className="text-3xl font-heading font-black text-amber-600">
            <AnimatedCount value={rsvpd} />
          </div>
          <div className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground mt-1">
            Confirmó RSVP
          </div>
        </div>

        <div className="border border-red-300/30 bg-red-50/20 p-4 text-center shadow-sm">
          <div className="text-3xl font-heading font-black text-red-500">
            <AnimatedCount value={declined} />
          </div>
          <div className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground mt-1">
            Ausentes
          </div>
        </div>
      </div>

      {/* Self check-in button (players only, session active) */}
      {!isCoach && sessionActive && (
        <div className="border border-primary/30 bg-primary/5 p-5">
          {alreadyCheckedIn ? (
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 bg-primary rounded-full animate-pulse" />
              <p className="text-sm font-mono font-bold text-primary">
                ✅ Tu asistencia está registrada
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <p className="text-sm font-mono text-foreground">
                La sesión está activa — marca tu presencia ahora
              </p>
              <button
                id="btn-self-checkin"
                onClick={handleSelfCheckIn}
                disabled={checkingIn}
                className="bg-primary text-primary-foreground px-6 py-2.5 text-xs font-mono font-bold uppercase tracking-widest hover:bg-primary/90 disabled:opacity-50 transition-all"
              >
                {checkingIn ? "Registrando..." : "✓ Marcar presencia"}
              </button>
            </div>
          )}
          {checkInError && (
            <p className="mt-3 text-xs font-mono text-red-600">{checkInError}</p>
          )}
        </div>
      )}

      {!isCoach && !sessionActive && !alreadyCheckedIn && (
        <div className="border border-border bg-secondary/40 px-5 py-4">
          <p className="text-xs font-mono text-muted-foreground">
            La sesión de check-in está cerrada. El entrenador debe activarla para que puedas marcar tu presencia.
          </p>
        </div>
      )}

      {/* Player grid */}
      <div className="border border-border bg-card shadow-sm overflow-hidden">
        <div className="border-b border-border bg-secondary px-5 py-4 flex items-center justify-between">
          <h2 className="font-mono font-bold text-sm uppercase tracking-widest text-foreground">
            Plantilla en tiempo real
          </h2>
          <span className="text-xs font-mono text-muted-foreground">
            {pending > 0 && `${pending} sin respuesta`}
          </span>
        </div>

        {visible.length === 0 ? (
          <div className="p-10 text-center text-xs font-mono text-muted-foreground">
            No hay jugadores convocados todavía.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 sm:gap-px sm:bg-border">
            {visible.map((player) => {
              const style = getStatusStyle(player);
              const isMe = player.userId === currentUserId;
              return (
                <div
                  key={player.userId}
                  className={`flex items-center gap-3 p-4 border ${style.card} sm:bg-card transition-all duration-300 ${isMe ? "ring-2 ring-primary/40" : ""}`}
                >
                  {/* Jersey number */}
                  <div className="flex-shrink-0 w-9 h-9 flex items-center justify-center border border-border bg-secondary font-heading font-black text-sm text-foreground">
                    {player.jerseyNumber ?? "—"}
                  </div>

                  {/* Name + position */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">
                      {player.name}
                      {isMe && (
                        <span className="ml-1 text-xs font-mono text-primary">(tú)</span>
                      )}
                    </p>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground truncate">
                      {player.position
                        ? (POSITION_LABELS[player.position] ?? player.position)
                        : "Sin posición"}
                    </p>
                  </div>

                  {/* Status badge */}
                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                      <span
                        className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-widest border ${style.badge}`}
                      >
                        {style.label}
                      </span>
                    </div>
                    {player.checkedInAt && (
                      <span className="text-[9px] font-mono text-muted-foreground">
                        {new Date(player.checkedInAt).toLocaleTimeString("es-ES", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
