"use client";

import { useState } from "react";
import type { MatchFormat } from "@prisma/client";
import { labelFor, validateLineup } from "@/lib/lineup-core";
import {
  assign,
  changeFormat,
  counts,
  fromValue,
  slotOf,
  starterNumbers,
  substituteNumbers,
  toggleUnnumbered,
  toValue,
  type LineupState,
  type LineupValue,
} from "./lineup-state";

export interface LineupMember {
  userId: string;
  name: string;
}

interface LineupEditorProps {
  members: LineupMember[];
  initialFormat: MatchFormat;
  initialPlayers?: LineupValue["players"];
  onChange: (value: LineupValue) => void;
}

const selectCls =
  "w-full border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all";
const headingCls =
  "text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-2 mb-3";

export function LineupEditor({ members, initialFormat, initialPlayers = [], onChange }: LineupEditorProps) {
  const [state, setState] = useState<LineupState>(() => fromValue({ format: initialFormat, players: initialPlayers }));
  const [notice, setNotice] = useState<string | null>(null);

  const nameOf = (userId: string) => members.find((m) => m.userId === userId)?.name ?? "Jugador";

  const update = (next: LineupState) => {
    setState(next);
    onChange(toValue(next));
  };

  const onFormat = (format: MatchFormat) => {
    const { state: next, demoted } = changeFormat(state, format);
    setNotice(
      demoted.length > 0
        ? `En ${format === "SEVENS" ? "7s" : "15s"} no existen todos los dorsales: ${demoted.map(nameOf).join(", ")} pasa${demoted.length > 1 ? "n" : ""} a «sin dorsal».`
        : null
    );
    update(next);
  };

  const renderRows = (numbers: number[]) =>
    numbers.map((n) => (
      <div key={n} className="flex items-center gap-3">
        <span className="w-48 shrink-0 text-xs font-mono font-bold uppercase tracking-widest text-foreground">
          {n} · {labelFor(state.format, n)}
        </span>
        <select
          aria-label={`Dorsal ${n}`}
          value={state.slots[n] ?? ""}
          onChange={(e) => update(assign(state, n, e.target.value || null))}
          className={selectCls}
        >
          <option value="">— Sin asignar —</option>
          {members.map((m) => {
            const takenElsewhere = slotOf(state, m.userId) !== null && slotOf(state, m.userId) !== n;
            return (
              <option key={m.userId} value={m.userId} disabled={takenElsewhere}>
                {m.name}
              </option>
            );
          })}
        </select>
      </div>
    ));

  const c = counts(state);
  const errors = validateLineup(state.format, toValue(state).players);
  const free = members.filter((m) => slotOf(state, m.userId) === null);

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="lineup-format" className="block text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground mb-2">
          Formato
        </label>
        <select
          id="lineup-format"
          value={state.format}
          onChange={(e) => onFormat(e.target.value as MatchFormat)}
          className={selectCls}
        >
          <option value="SEVENS">7s</option>
          <option value="FIFTEENS">15s</option>
        </select>
        {notice && <p className="mt-2 text-xs font-mono text-muted-foreground">{notice}</p>}
      </div>

      <p className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">
        {c.starters} titulares · {c.substitutes} suplentes · {c.unnumbered} sin dorsal
      </p>

      {errors.length > 0 && (
        <ul role="alert" className="border border-destructive bg-destructive/10 p-3 text-xs font-mono font-bold text-destructive space-y-1">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div>
        <h3 className={headingCls}>Titulares</h3>
        <div className="space-y-2">{renderRows(starterNumbers(state.format))}</div>
      </div>

      <div>
        <h3 className={headingCls}>Suplentes</h3>
        <div className="space-y-2">{renderRows(substituteNumbers(state.format))}</div>
      </div>

      <div>
        <h3 className={headingCls}>Convocados sin dorsal</h3>
        {free.length === 0 ? (
          <p className="text-sm text-muted-foreground italic font-mono">Todos los jugadores tienen dorsal</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {free.map((m) => (
              <label key={m.userId} className="flex cursor-pointer items-center gap-3 border border-border bg-background p-3 text-sm font-bold uppercase tracking-wide text-foreground">
                <input
                  type="checkbox"
                  checked={state.unnumbered.includes(m.userId)}
                  onChange={() => update(toggleUnnumbered(state, m.userId))}
                  className="h-5 w-5 border-border bg-background text-primary focus:ring-primary focus:ring-offset-background"
                />
                {m.name}
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
