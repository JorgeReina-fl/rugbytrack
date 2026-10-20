"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Warning } from "@phosphor-icons/react/dist/ssr";
import { getRpeColorClasses } from "@/components/training/rpe-styles";

export interface PlayerRpeEntry {
  rpe: number;
  duration: number;
  workload: number;
  recordedById: string | null;
  updatedAt: string;
}

interface PlayerRpeControlProps {
  eventId: string;
  userId: string;
  name: string;
  /** Jugador marcado como presente: solo entonces se puede anotar o corregir. */
  checkedIn: boolean;
  /** El evento ya ha empezado: antes no se muestran controles de RPE. */
  started: boolean;
  entry: PlayerRpeEntry | null;
}

const buttonClass =
  "px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-widest transition-all border border-border text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed";
const primaryButtonClass =
  "px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-widest transition-all bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed";

export function PlayerRpeControl({ eventId, userId, name, checkedIn, started, entry }: PlayerRpeControlProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [rpe, setRpe] = useState<number | null>(null);
  const [duration, setDuration] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!started) return null;
  if (!entry && !checkedIn) return null;

  const url = `/api/events/${eventId}/rpe/${userId}`;
  const minutes = Number(duration);
  const valid = rpe !== null && Number.isInteger(minutes) && minutes >= 1 && minutes <= 300;

  const startEditing = () => {
    setError(null);
    setRpe(entry?.rpe ?? null);
    setDuration(entry ? String(entry.duration) : "");
    setEditing(true);
  };

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rpe, duration: minutes }),
      });
      if (!res.ok) {
        setError(
          res.status === 409
            ? "El jugador no está marcado como presente"
            : res.status === 400
              ? "El evento aún no ha comenzado"
              : "No se pudo guardar el RPE"
        );
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("No se pudo guardar el RPE");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`¿Borrar el RPE de ${name}?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) {
        setError("No se pudo borrar el RPE");
        return;
      }
      router.refresh();
    } catch {
      setError("No se pudo borrar el RPE");
    } finally {
      setBusy(false);
    }
  };

  const author = !entry
    ? null
    : entry.recordedById === null
      ? "autor desconocido"
      : entry.recordedById === userId
        ? "anotado por el jugador"
        : "anotado por el coach";

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3 w-full">
      {error && (
        <div className="border border-destructive bg-destructive/10 p-2 text-xs font-mono font-bold text-destructive">
          <Warning size={16} weight="regular" className="inline mr-2" /> {error}
        </div>
      )}

      {editing ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
              <button
                key={num}
                type="button"
                aria-pressed={rpe === num}
                onClick={() => setRpe(num)}
                className={`rounded-none border py-2 text-center transition-all duration-200 ease-out ${getRpeColorClasses(rpe === num)}`}
              >
                {num}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={1}
              max={300}
              aria-label="Duración en minutos"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-28 rounded-none border border-input bg-background p-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring transition-colors font-mono"
            />
            <button type="button" onClick={save} disabled={!valid || busy} className={primaryButtonClass}>
              Guardar
            </button>
            <button type="button" onClick={() => setEditing(false)} disabled={busy} className={buttonClass}>
              Cancelar
            </button>
          </div>
        </div>
      ) : entry ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-foreground">
              RPE {entry.rpe} · {entry.duration} min · carga {entry.workload}
            </span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{author}</span>
          </div>
          <div className="flex gap-2">
            {checkedIn && (
              <button type="button" onClick={startEditing} disabled={busy} className={buttonClass}>
                Editar
              </button>
            )}
            <button type="button" onClick={remove} disabled={busy} className={buttonClass}>
              Borrar
            </button>
          </div>
        </div>
      ) : (
        <div>
          <button type="button" onClick={startEditing} className={buttonClass}>
            Anotar RPE
          </button>
        </div>
      )}
    </div>
  );
}
