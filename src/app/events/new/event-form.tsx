"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { RugbyPosition, EventType } from "@prisma/client";
import { Warning } from "@phosphor-icons/react/dist/ssr";

interface MemberWithUser {
  id: string;
  userId: string;
  position: RugbyPosition | null;
  jerseyNumber: number | null;
  isCoach: boolean;
  user: {
    id: string;
    name: string;
    image: string | null;
  };
}

interface EventFormProps {
  teamId: string;
  members: MemberWithUser[];
}

const positionLabels: Record<RugbyPosition, string> = {
  PROP_LOOSEHEAD: "Pilar Izquierdo (1)",
  HOOKER: "Talonador (2)",
  PROP_TIGHTHEAD: "Pilar Derecho (3)",
  LOCK: "Segunda Línea (4/5)",
  FLANKER_BLINDSIDE: "Flanker Ciego (6)",
  FLANKER_OPENSIDE: "Flanker Abierto (7)",
  NUMBER_EIGHT: "Número 8 (8)",
  SCRUM_HALF: "Medio Melé (9)",
  FLY_HALF: "Apertura (10)",
  CENTER_INSIDE: "Primer Centro (12)",
  CENTER_OUTSIDE: "Segundo Centro (13)",
  WING_LEFT: "Ala Izquierdo (11)",
  WING_RIGHT: "Ala Derecho (14)",
  FULLBACK: "Zaguero (15)",
  REPLACEMENT: "Suplente",
};

/* ── Autocomplete component ─────────────────────────────────────────── */

interface AutocompleteInputProps {
  id: string;
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  onSaveSuggestion: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

function AutocompleteInput({
  id,
  value,
  onChange,
  suggestions,
  onSaveSuggestion,
  placeholder,
  required,
  className,
}: AutocompleteInputProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = suggestions.filter(
    (s) => s.toLowerCase().includes(value.toLowerCase()) && s !== value
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <input
        id={id}
        type="text"
        required={required}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        className={className}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => onSaveSuggestion(value)}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 top-full mt-1 border border-border bg-card shadow-md max-h-48 overflow-y-auto divide-y divide-border">
          {filtered.map((s) => (
            <li
              key={s}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(s);
                setOpen(false);
              }}
              className="px-4 py-2.5 text-sm font-mono text-foreground cursor-pointer hover:bg-secondary hover:text-primary transition-colors"
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── Helpers for localStorage ───────────────────────────────────────── */

function loadSuggestions(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveSuggestion(key: string, value: string, current: string[]): string[] {
  if (!value.trim()) return current;
  const next = [value.trim(), ...current.filter((v) => v !== value.trim())].slice(0, 15);
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {}
  return next;
}

/* ── Main form ──────────────────────────────────────────────────────── */

export function EventForm({ teamId, members }: EventFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const titleKey = `rt_evt_titles_${teamId}`;
  const locationKey = `rt_evt_locations_${teamId}`;

  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);

  useEffect(() => {
    setTitleSuggestions(loadSuggestions(titleKey));
    setLocationSuggestions(loadSuggestions(locationKey));
  }, [titleKey, locationKey]);

  // Form Fields
  const [title, setTitle] = useState("");
  const [type, setType] = useState<EventType>("TRAINING");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rsvpDeadline, setRsvpDeadline] = useState("");

  // Callups state: mapping userId -> callup info
  const [callups, setCallups] = useState<
    Record<
      string,
      {
        selected: boolean;
        isStarter: boolean;
        position: RugbyPosition | "";
      }
    >
  >(
    Object.fromEntries(
      members.map((m) => [
        m.userId,
        {
          selected: false,
          isStarter: false,
          position: m.position ?? "",
        },
      ])
    )
  );

  const playerIds = members.filter((m) => !m.isCoach).map((m) => m.userId);

  const selectAll = () => {
    setCallups((prev) => {
      const next = { ...prev };
      playerIds.forEach((id) => {
        next[id] = { ...next[id]!, selected: true };
      });
      return next;
    });
  };

  const deselectAll = () => {
    setCallups((prev) => {
      const next = { ...prev };
      playerIds.forEach((id) => {
        next[id] = { ...next[id]!, selected: false };
      });
      return next;
    });
  };

  const toggleMemberCallup = (userId: string) => {
    setCallups((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId]!,
        selected: !prev[userId]!.selected,
      },
    }));
  };

  const handleStarterChange = (userId: string, isStarter: boolean) => {
    setCallups((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId]!,
        isStarter,
        position: isStarter ? prev[userId]!.position || "PROP_LOOSEHEAD" : "REPLACEMENT",
      },
    }));
  };

  const handlePositionChange = (userId: string, position: RugbyPosition) => {
    setCallups((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId]!,
        position,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formattedCallups = Object.entries(callups)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .filter(([_userId, info]) => info.selected)
      .map(([userId, info]) => ({
        userId,
        isStarter: info.isStarter,
        position: info.position ? info.position : null,
      }));

    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          title,
          type,
          description: description || null,
          location: location || null,
          startDate: startDate ? new Date(startDate).toISOString() : "",
          endDate: endDate ? new Date(endDate).toISOString() : null,
          rsvpDeadline: rsvpDeadline ? new Date(rsvpDeadline).toISOString() : null,
          callups: formattedCallups,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al crear el evento");
      }

      // Persist title and location for future autocomplete
      setTitleSuggestions((prev) => saveSuggestion(titleKey, title, prev));
      setLocationSuggestions((prev) => saveSuggestion(locationKey, location, prev));

      router.push(`/events?teamId=${teamId}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Ocurrió un error inesperado");
    } finally {
      setLoading(false);
    }
  };

  /* ─── Clases reutilizables ───────────────────────────────────────── */
  const inputCls =
    "w-full border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all";
  const labelCls =
    "block text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground mb-2";

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="border border-destructive bg-destructive/10 p-4 text-xs font-mono font-bold uppercase tracking-widest text-destructive">
          <Warning size={24} weight="regular" className="inline mr-2" /> {error}
        </div>
      )}

      {/* ── Sección 1: Datos del evento ───────────────────────────── */}
      <div className="border border-border bg-card p-8 shadow-sm space-y-6">
        <h2 className="text-2xl font-heading font-extrabold tracking-tighter uppercase text-foreground border-b border-border pb-4">
          Detalles del Evento
        </h2>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label htmlFor="event-title" className={labelCls}>Título del Evento *</label>
            <AutocompleteInput
              id="event-title"
              value={title}
              onChange={setTitle}
              suggestions={titleSuggestions}
              onSaveSuggestion={(v) =>
                setTitleSuggestions((prev) => saveSuggestion(titleKey, v, prev))
              }
              placeholder="Ej. Entrenamiento Táctico / vs Club Liceo"
              required
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Tipo de Evento *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as EventType)}
              className={inputCls}
            >
              <option value="TRAINING">Entrenamiento</option>
              <option value="MATCH">Partido</option>
              <option value="TOURNAMENT">Torneo</option>
              <option value="TRIP">Viaje</option>
              <option value="OTHER">Otro</option>
            </select>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <label className={labelCls}>Fecha de Inicio *</label>
            <input
              type="datetime-local"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Fecha de Fin</label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Límite de Confirmación (RSVP)</label>
            <input
              type="datetime-local"
              value={rsvpDeadline}
              onChange={(e) => setRsvpDeadline(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label htmlFor="event-location" className={labelCls}>Ubicación</label>
          <AutocompleteInput
            id="event-location"
            value={location}
            onChange={setLocation}
            suggestions={locationSuggestions}
            onSaveSuggestion={(v) =>
              setLocationSuggestions((prev) => saveSuggestion(locationKey, v, prev))
            }
            placeholder="Ej. Campo de Rugby de la Universidad / Club Municipal"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Descripción</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Indicaciones para los jugadores (llevar protector bucal, ropa térmica...)"
            rows={3}
            className={`${inputCls} resize-none`}
          />
        </div>
      </div>

      {/* ── Sección 2: Convocatoria ───────────────────────────────── */}
      <div className="border border-border bg-card p-8 shadow-sm space-y-6">
        <div>
          <h2 className="text-2xl font-heading font-extrabold tracking-tighter uppercase text-foreground border-b border-border pb-4">
            Convocatoria
          </h2>
          <p className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground mt-3">
            Selecciona los jugadores convocados y asígnales su rol en el equipo.
          </p>
        </div>

        {/* Seleccionar / Deseleccionar todos */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={selectAll}
            className="px-4 py-2 text-xs font-mono font-bold uppercase tracking-widest border border-border bg-background text-foreground hover:border-primary hover:text-primary transition-all"
          >
            Seleccionar todos
          </button>
          <button
            type="button"
            onClick={deselectAll}
            className="px-4 py-2 text-xs font-mono font-bold uppercase tracking-widest border border-border bg-background text-muted-foreground hover:border-destructive hover:text-destructive transition-all"
          >
            Deseleccionar todos
          </button>
        </div>

        <div className="border border-border overflow-hidden divide-y divide-border bg-background">
          {members
            .filter((m) => !m.isCoach)
            .map((member) => {
              const callupInfo = callups[member.userId]!;

              return (
                <div
                  key={member.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 transition-all ${
                    callupInfo.selected
                      ? "bg-primary/5 border-l-2 border-l-primary"
                      : "bg-background"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id={`convocar-${member.userId}`}
                      checked={callupInfo.selected}
                      onChange={() => toggleMemberCallup(member.userId)}
                      className="h-5 w-5 border-border bg-background text-primary focus:ring-primary focus:ring-offset-background"
                    />
                    <label
                      htmlFor={`convocar-${member.userId}`}
                      className="cursor-pointer font-bold text-sm text-foreground uppercase tracking-wide"
                    >
                      {member.user.name}
                    </label>
                  </div>

                  {callupInfo.selected && (
                    <div className="flex flex-wrap items-center gap-4 pl-8 sm:pl-0">
                      {/* Titular / Suplente toggle */}
                      <div className="flex border border-border bg-background p-0.5">
                        <button
                          type="button"
                          onClick={() => handleStarterChange(member.userId, true)}
                          className={`px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-widest transition-all ${
                            callupInfo.isStarter
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                          }`}
                        >
                          Titular
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStarterChange(member.userId, false)}
                          className={`px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-widest transition-all ${
                            !callupInfo.isStarter
                              ? "bg-secondary text-foreground"
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                          }`}
                        >
                          Suplente
                        </button>
                      </div>

                      {/* Posición (solo titulares) */}
                      {callupInfo.isStarter && (
                        <select
                          value={callupInfo.position}
                          onChange={(e) =>
                            handlePositionChange(member.userId, e.target.value as RugbyPosition)
                          }
                          className="border border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                        >
                          {Object.entries(positionLabels).map(([pos, label]) => (
                            <option key={pos} value={pos}>
                              {label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="bg-primary px-8 py-3 text-xs font-mono uppercase tracking-widest font-bold text-primary-foreground hover:opacity-90 transition-all shadow-md disabled:opacity-50"
        >
          {loading ? "Creando..." : "Crear Evento y Notificar"}
        </button>
      </div>
    </form>
  );
}
