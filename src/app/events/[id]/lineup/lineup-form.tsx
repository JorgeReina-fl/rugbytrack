"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MatchFormat } from "@prisma/client";
import { LineupEditor, type LineupMember } from "@/components/event/LineupEditor";
import type { LineupValue } from "@/components/event/lineup-state";

interface LineupFormProps {
  eventId: string;
  members: LineupMember[];
  initialFormat: MatchFormat;
  initialPlayers: LineupValue["players"];
}

export function LineupForm({ eventId, members, initialFormat, initialPlayers }: LineupFormProps) {
  const router = useRouter();
  const [value, setValue] = useState<LineupValue>({ format: initialFormat, players: initialPlayers });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/events/${eventId}/lineup`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
        return;
      }
      if (res.status === 409) {
        setError("El partido ya ha empezado");
      } else if (res.status === 422) {
        const body = await res.json().catch(() => null);
        setError(body?.error || "No se pudo guardar la alineación");
      } else {
        setError("No se pudo guardar la alineación");
      }
    } catch {
      setError("No se pudo guardar la alineación");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border border-border bg-card p-8 shadow-sm">
        <LineupEditor
          members={members}
          initialFormat={initialFormat}
          initialPlayers={initialPlayers}
          onChange={(v) => {
            setValue(v);
            setSaved(false);
          }}
        />
      </div>

      <div className="flex flex-col items-end gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="bg-primary px-8 py-3 text-xs font-mono uppercase tracking-widest font-bold text-primary-foreground hover:opacity-90 transition-all shadow-md disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar alineación"}
        </button>
        {error && (
          <p role="alert" className="text-xs font-mono font-bold uppercase tracking-widest text-destructive">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="text-xs font-mono font-bold uppercase tracking-widest text-primary">
            Alineación guardada. Se ha avisado a los jugadores afectados.
          </p>
        )}
      </div>
    </div>
  );
}
