"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  teamId: string;
  rpeLinksAuto: boolean;
}

/** Ajustes del equipo (solo coach activo; la página ya lo comprueba). Guardado inmediato por PATCH /api/teams/[id]. */
export function TeamSettingsCard({ teamId, rpeLinksAuto }: Props) {
  const router = useRouter();
  const [checked, setChecked] = useState(rpeLinksAuto);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setChecked(rpeLinksAuto), [rpeLinksAuto]);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const onChange = async (next: boolean) => {
    const previous = checked;
    setChecked(next);
    setSaving(true);
    setMessage(null);
    if (timer.current) clearTimeout(timer.current);
    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rpeLinksAuto: next }),
      });
      if (!res.ok) throw new Error("save failed");
      setMessage({ text: "Guardado", error: false });
      timer.current = setTimeout(() => setMessage(null), 3000);
      router.refresh();
    } catch {
      setChecked(previous);
      setMessage({ text: "No se pudo guardar. Inténtalo de nuevo.", error: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-8 border border-border bg-card p-5">
      <h2 className="mb-3 text-xs font-mono font-bold uppercase tracking-widest text-primary">Ajustes</h2>
      <label htmlFor="rpe-links-auto" className="flex items-start gap-3 text-sm font-sans text-foreground">
        <input
          id="rpe-links-auto"
          type="checkbox"
          checked={checked}
          disabled={saving}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 h-4 w-4"
        />
        <span>Enviar el enlace de RPE automáticamente al terminar cada evento</span>
      </label>
      <p className="mt-2 text-xs font-mono text-muted-foreground">
        Se envía por email a los jugadores marcados como presentes que aún no han registrado su RPE. Siempre puedes
        enviarlo a mano desde el Panel de Asistencia.
      </p>
      {message && (
        <p role="status" className={`mt-2 text-xs font-mono font-bold ${message.error ? "text-destructive" : "text-primary"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
