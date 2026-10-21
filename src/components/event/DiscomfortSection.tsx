"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BodyArea } from "@prisma/client";
import { BODY_AREAS, BODY_AREA_LABELS } from "@/lib/body-area";
import { HEALTH_CONSENT_CHECKBOX, HEALTH_CONSENT_TEXT } from "@/lib/health-consent-text";
import { getRpeColorClasses } from "@/components/training/rpe-styles";

export interface DiscomfortItem {
  id: string;
  bodyArea: BodyArea;
  intensity: number;
  note: string | null;
}

interface DiscomfortSectionProps {
  eventId: string;
  hasConsent: boolean;
  /** Antes del fin del evento: se puede reportar. Después, solo se listan y se borran. */
  open: boolean;
  items: DiscomfortItem[];
}

const inputClass =
  "w-full rounded-none border border-input bg-background p-3 text-sm text-foreground placeholder-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring transition-colors";
const primaryButton =
  "flex items-center justify-center rounded-none bg-primary px-4 py-3 text-xs font-mono uppercase tracking-widest font-bold text-primary-foreground hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md";

export function DiscomfortSection({ eventId, hasConsent, open, items }: DiscomfortSectionProps) {
  const router = useRouter();
  const [consent, setConsent] = useState(hasConsent);
  const [showConsent, setShowConsent] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [bodyArea, setBodyArea] = useState<BodyArea>("KNEE");
  const [intensity, setIntensity] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function acceptConsent() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/me/health-consent", { method: "POST" });
      if (!res.ok) throw new Error();
      setConsent(true);
      setShowConsent(false);
      setAccepted(false);
      router.refresh();
    } catch {
      setError("No se pudo guardar el consentimiento");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (intensity === null) {
      setError("Revisa los datos");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/discomforts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodyArea, intensity, note }),
      });
      if (res.ok) {
        setIntensity(null);
        setNote("");
        router.refresh();
        return;
      }
      const json = await res.json().catch(() => ({}));
      if (res.status === 403 && json.code === "CONSENT_REQUIRED") {
        setConsent(false);
        setShowConsent(true);
        router.refresh();
      } else if (res.status === 409) setError("El evento ya ha terminado");
      else if (res.status === 429) setError("Demasiados intentos. Espera unos minutos");
      else if (res.status === 422) setError("Revisa los datos");
      else setError("No se pudo guardar la molestia");
    } catch {
      setError("No se pudo guardar la molestia");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("¿Borrar esta molestia?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/discomforts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setError("No se pudo borrar la molestia");
    }
  }

  return (
    <div className="border border-border bg-card p-6 shadow-sm space-y-4">
      <h3 className="text-xl font-heading font-extrabold tracking-tighter uppercase">Molestias</h3>
      {open && (
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
          Solo lo verán los entrenadores de tu equipo.
        </p>
      )}

      {error && (
        <div role="alert" className="rounded-none border border-destructive bg-destructive/10 p-3 text-sm font-semibold text-destructive">
          {error}
        </div>
      )}

      {open && !consent && !showConsent && (
        <button type="button" onClick={() => setShowConsent(true)} className={`w-full ${primaryButton}`}>
          Reportar molestia
        </button>
      )}

      {open && !consent && showConsent && (
        <div className="space-y-4 border border-border p-4">
          <p className="text-sm text-foreground leading-relaxed">{HEALTH_CONSENT_TEXT}</p>
          <Link href="/privacidad" className="block text-xs font-mono font-bold uppercase tracking-widest text-primary hover:underline">
            Política de privacidad
          </Link>
          <label className="flex items-start gap-3 text-sm text-foreground cursor-pointer">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1" />
            <span>{HEALTH_CONSENT_CHECKBOX}</span>
          </label>
          <button type="button" disabled={!accepted || busy} onClick={acceptConsent} className={`w-full ${primaryButton}`}>
            Aceptar y continuar
          </button>
        </div>
      )}

      {open && consent && (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="discomfort-area" className="block text-sm font-heading uppercase tracking-tight font-bold text-foreground">
              Zona
            </label>
            <select id="discomfort-area" value={bodyArea} onChange={(e) => setBodyArea(e.target.value as BodyArea)} className={inputClass}>
              {BODY_AREAS.map((a) => (
                <option key={a} value={a}>
                  {BODY_AREA_LABELS[a]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <span className="block text-sm font-heading uppercase tracking-tight font-bold text-foreground">Intensidad (0–10)</span>
            <div className="grid grid-cols-6 gap-2">
              {Array.from({ length: 11 }, (_, n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={intensity === n}
                  onClick={() => setIntensity(n)}
                  className={`rounded-none border py-3 text-center transition-all duration-200 ease-out ${getRpeColorClasses(intensity === n)}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <label htmlFor="discomfort-note" className="block text-sm font-heading uppercase tracking-tight font-bold text-foreground">
                Nota (opcional)
              </label>
              <span className="text-xs text-muted-foreground font-mono">{note.length}/280</span>
            </div>
            <textarea
              id="discomfort-note"
              maxLength={280}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={`${inputClass} min-h-[80px] resize-none font-sans`}
            />
          </div>

          <button type="submit" disabled={busy} className={`w-full ${primaryButton}`}>
            Enviar
          </button>
        </form>
      )}

      {items.length > 0 && (
        <ul className="space-y-2 border-t border-border pt-4">
          {items.map((d) => (
            <li key={d.id} className="flex items-start justify-between gap-3 border border-border p-3">
              <div className="min-w-0">
                <p className="text-sm font-mono font-semibold text-foreground">
                  {BODY_AREA_LABELS[d.bodyArea]} · intensidad {d.intensity}/10
                </p>
                {d.note && <p className="mt-1 text-sm text-muted-foreground whitespace-pre-line break-words">{d.note}</p>}
              </div>
              <button
                type="button"
                onClick={() => remove(d.id)}
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
