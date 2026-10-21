"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BodyArea } from "@prisma/client";
import { BODY_AREA_LABELS } from "@/lib/body-area";
import { getRpeColorClasses } from "@/components/training/rpe-styles";

export interface CoachDiscomfortItem {
  id: string;
  playerName: string;
  bodyArea: BodyArea;
  intensity: number;
  note: string | null;
  createdLabel: string;
  isNew: boolean;
}

/**
 * Molestias del evento para el coach activo. Si hay alguna sin ver, las marca como vistas una
 * sola vez al montar; las «Nueva» siguen visibles en esa carga y desaparecen en la siguiente.
 */
export function CoachDiscomfortList({ eventId, items }: { eventId: string; items: CoachDiscomfortItem[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const markedRef = useRef(false);
  const hasUnseen = items.some((i) => i.isNew);

  useEffect(() => {
    if (!hasUnseen || markedRef.current) return;
    markedRef.current = true;
    fetch(`/api/events/${eventId}/discomforts/seen`, { method: "POST" }).catch(() => {
      // Sin aviso al usuario: seguirán apareciendo como nuevas hasta la próxima visita
    });
  }, [eventId, hasUnseen]);

  async function remove(item: CoachDiscomfortItem) {
    if (!confirm(`¿Borrar la molestia de ${item.playerName}?`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/discomforts/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setError("No se pudo borrar la molestia");
    }
  }

  return (
    <div id="molestias" className="border border-border bg-card p-8 shadow-sm space-y-4 scroll-mt-24">
      <h2 className="text-2xl font-heading font-extrabold tracking-tighter uppercase">
        Molestias reportadas ({items.length})
      </h2>

      {error && (
        <div role="alert" className="rounded-none border border-destructive bg-destructive/10 p-3 text-sm font-semibold text-destructive">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic font-mono">Ningún jugador ha reportado molestias para este evento.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((d) => (
            <li key={d.id} className="flex items-start justify-between gap-3 border border-border p-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-sm text-foreground">{d.playerName}</span>
                  {d.isNew && (
                    <span className="bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider">
                      Nueva
                    </span>
                  )}
                </div>
                <p className="flex flex-wrap items-center gap-2 text-sm font-mono text-foreground">
                  <span>{BODY_AREA_LABELS[d.bodyArea]} ·</span>
                  <span className={`border px-2 py-0.5 ${getRpeColorClasses(d.intensity >= 7)}`}>
                    intensidad {d.intensity}/10
                  </span>
                </p>
                {d.note && <p className="text-sm text-muted-foreground whitespace-pre-line break-words">{d.note}</p>}
                <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">{d.createdLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => remove(d)}
                className="shrink-0 text-xs font-mono font-bold uppercase tracking-widest text-destructive hover:underline"
              >
                Borrar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
