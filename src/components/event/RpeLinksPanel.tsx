"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { rpeLinksPhase, rpeLinksRetryAt, hourInTz } from "@/lib/rpe-links-ui";

export interface RpeLinksInfo {
  /** Fin del evento (endDate o inicio + 3 h) y cierre del plazo (fin + 48 h), ISO. */
  endsAt: string;
  closesAt: string;
  /** Último envío de enlaces (ISO) o null. */
  sentAt: string | null;
  /** Jugadores activos no coach con check-in y sin RPE. */
  pendingRpe: number;
  /** El equipo envía solos los enlaces al terminar. */
  autoEnabled: boolean;
  timezone: string;
  /** Fechas ya formateadas en la zona del equipo (datetime.ts, en el servidor). */
  closesAtLabel: string;
  sentAtLabel: string | null;
  retryHourLabel: string | null;
}

interface Props {
  eventId: string;
  info: RpeLinksInfo;
  now: Date;
}

const box = "border border-border bg-card p-4 space-y-3";
const btn =
  "px-4 py-2 text-xs font-mono font-bold uppercase tracking-widest border border-primary/30 bg-primary text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50";

export function RpeLinksPanel({ eventId, info, now }: Props) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const phase = rpeLinksPhase(now, new Date(info.endsAt), new Date(info.closesAt));
  if (phase === "not_ended") return null;

  if (phase === "closed") {
    return (
      <div className={box}>
        <p className="text-sm font-mono text-muted-foreground">El plazo de RPE terminó el {info.closesAtLabel}</p>
      </div>
    );
  }

  if (info.pendingRpe === 0) {
    return (
      <div className={box}>
        <p className="text-sm font-mono text-muted-foreground">Todos los presentes tienen su RPE</p>
      </div>
    );
  }

  const n = info.pendingRpe;
  const players = n === 1 ? "jugador" : "jugadores";
  const resend = info.sentAt !== null;
  const retryAt = rpeLinksRetryAt(info.sentAt ? new Date(info.sentAt) : null, now);

  const send = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/events/${eventId}/rpe-links`, { method: "POST" });
      let body: any = null;
      try {
        body = await res.json();
      } catch {
        // respuesta no JSON: se trata como error genérico
      }
      if (res.ok && body?.data) {
        const notSent = body.data.failed + body.data.skipped;
        setMessage(`Enviados: ${body.data.sent}. No enviados: ${notSent}.${notSent > 0 ? " Inténtalo más tarde." : ""}`);
      } else if (res.status === 409) {
        setMessage(body?.error === "NOT_ENDED" ? "El evento aún no ha terminado." : "El plazo de RPE ya terminó.");
      } else if (res.status === 429 && body?.retryAt) {
        setMessage(`Podrás reenviar a partir de las ${hourInTz(body.retryAt, info.timezone)}`);
      } else {
        setMessage("No se pudo enviar. Inténtalo de nuevo.");
      }
    } catch {
      setMessage("No se pudo enviar. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
      setConfirmOpen(false);
      router.refresh();
    }
  };

  return (
    <div className={box}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => setConfirmOpen(true)} disabled={busy || retryAt !== null} className={btn}>
          {resend ? `Reenviar a ${n} ${players} sin RPE` : `Enviar enlace de RPE a ${n} ${players}`}
        </button>
        <p className="text-xs font-mono text-muted-foreground">
          {retryAt
            ? `Podrás reenviar a partir de las ${info.retryHourLabel ?? hourInTz(retryAt.toISOString(), info.timezone)}`
            : resend
              ? `Último envío: ${info.sentAtLabel}`
              : info.autoEnabled
                ? "El envío automático se hace al terminar"
                : null}
        </p>
      </div>
      {retryAt && resend && <p className="text-xs font-mono text-muted-foreground">Último envío: {info.sentAtLabel}</p>}
      {message && (
        <p role="status" className="text-sm font-mono font-bold">
          {message}
        </p>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="rpe-links-title" className="w-full max-w-md border border-border bg-card p-6 shadow-sm space-y-4">
            <h3 id="rpe-links-title" className="font-mono font-bold text-sm uppercase tracking-widest">
              Enviar enlaces de RPE
            </h3>
            <p className="text-sm text-muted-foreground">
              Se enviará un email con el enlace para registrar el RPE a {n} {players}. ¿Continuar?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={busy}
                className="px-4 py-2 text-xs font-mono font-bold uppercase tracking-widest border border-border text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                Cancelar
              </button>
              <button onClick={send} disabled={busy} className={btn}>
                {busy ? "Enviando…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
