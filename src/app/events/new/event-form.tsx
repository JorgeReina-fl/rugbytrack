"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { RugbyPosition, EventType, MatchFormat } from "@prisma/client";
import { isAllTeamEvent } from "@/lib/convocation";
import { Warning } from "@phosphor-icons/react/dist/ssr";
import { localInputToIso } from "@/lib/form-datetime";
import { tzOptionsFor } from "@/lib/timezones";
import { SLOTS, validateLineup } from "@/lib/lineup-core";
import { LineupEditor } from "@/components/event/LineupEditor";
import type { LineupValue } from "@/components/event/lineup-state";

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
  timezone: string;
  members: MemberWithUser[];
  defaultFormat?: MatchFormat;
}

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

export function EventForm({ teamId, timezone, members, defaultFormat = "SEVENS" }: EventFormProps) {
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
  const [selectedTz, setSelectedTz] = useState(timezone);
  const startIso = localInputToIso(startDate, selectedTz);
  const tzOptions = useMemo(
    () => tzOptionsFor(startIso ? new Date(startIso) : new Date(), timezone),
    [startIso, timezone]
  );

  // Alineación por dorsal (solo Partido/Torneo)
  const [lineup, setLineup] = useState<LineupValue>({ format: defaultFormat, players: [] });
  const lineupMembers = useMemo(
    () => members.filter((m) => !m.isCoach).map((m) => ({ userId: m.userId, name: m.user.name })),
    [members]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // En entrenos, otros y viajes se convoca a todo el equipo: no se envían convocados
    const allTeam = isAllTeamEvent(type);
    if (!allTeam) {
      const errors = validateLineup(lineup.format, lineup.players);
      if (errors.length > 0) {
        setError(errors[0]!);
        setLoading(false);
        return;
      }
    }
    const formattedCallups = allTeam
      ? []
      : lineup.players.map((p) => ({
          userId: p.userId,
          isStarter: p.shirtNumber != null && p.shirtNumber <= SLOTS[lineup.format].starters,
          position: null,
          shirtNumber: p.shirtNumber,
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
          startDate: localInputToIso(startDate, selectedTz) ?? "",
          endDate: localInputToIso(endDate, selectedTz),
          rsvpDeadline: localInputToIso(rsvpDeadline, selectedTz),
          ...(allTeam ? {} : { format: lineup.format }),
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
          <label htmlFor="event-timezone" className={labelCls}>Zona horaria</label>
          <select
            id="event-timezone"
            value={selectedTz}
            onChange={(e) => setSelectedTz(e.target.value)}
            className={inputCls}
          >
            {tzOptions.map((o) => (
              <option key={o.tz} value={o.tz}>
                {o.label}
              </option>
            ))}
          </select>
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
      {isAllTeamEvent(type) ? (
        <div className="border border-border bg-card p-8 shadow-sm space-y-6">
          <h2 className="text-2xl font-heading font-extrabold tracking-tighter uppercase text-foreground border-b border-border pb-4">
            Convocatoria
          </h2>
          <p className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">
            Se convocará a todo el equipo
          </p>
        </div>
      ) : (
      <div className="border border-border bg-card p-8 shadow-sm space-y-6">
        <div>
          <h2 className="text-2xl font-heading font-extrabold tracking-tighter uppercase text-foreground border-b border-border pb-4">
            Convocatoria
          </h2>
          <p className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground mt-3">
            Asigna a cada jugador su dorsal o déjalo convocado sin dorsal.
          </p>
        </div>

        <LineupEditor
          members={lineupMembers}
          initialFormat={defaultFormat}
          initialPlayers={lineup.players}
          onChange={setLineup}
        />
      </div>
      )}

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
