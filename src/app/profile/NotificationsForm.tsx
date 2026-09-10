"use client";

import { useState } from "react";

interface NotificationPrefs {
  notifyPolls: boolean;
  notifyProposals: boolean;
  notifyForumThreads: boolean;
  notifyRsvpReminders: boolean;
}

const LABELS: Record<keyof NotificationPrefs, string> = {
  notifyPolls: "Encuestas del equipo",
  notifyProposals: "Nuevas propuestas",
  notifyForumThreads: "Hilos nuevos en el foro",
  notifyRsvpReminders: "Recordatorio de confirmación de asistencia (24h)",
};

export default function NotificationsForm({ initial }: { initial: NotificationPrefs }) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(initial);
  const [saving, setSaving] = useState<keyof NotificationPrefs | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof NotificationPrefs, string>>>({});

  async function toggle(key: keyof NotificationPrefs) {
    const next = !prefs[key];
    setPrefs((p) => ({ ...p, [key]: next }));
    setSaving(key);
    setErrors((e) => ({ ...e, [key]: undefined }));

    try {
      const res = await fetch("/api/profile/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next }),
      });
      if (!res.ok) {
        // Revert on error
        setPrefs((p) => ({ ...p, [key]: !next }));
        const json = await res.json().catch(() => ({}));
        setErrors((e) => ({ ...e, [key]: json.error ?? "Error al guardar" }));
      }
    } catch {
      setPrefs((p) => ({ ...p, [key]: !next }));
      setErrors((e) => ({ ...e, [key]: "Error de conexión" }));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-4">
      {(Object.keys(LABELS) as (keyof NotificationPrefs)[]).map((key) => (
        <div key={key}>
          <label className="flex items-center justify-between gap-4 cursor-pointer group">
            <span className="text-sm font-mono text-foreground group-hover:text-primary transition-colors">
              {LABELS[key]}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={prefs[key]}
              disabled={saving === key}
              onClick={() => toggle(key)}
              className={`relative shrink-0 h-6 w-11 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                prefs[key] ? "bg-primary" : "bg-input"
              }`}
            >
              <span
                className={`block h-4 w-4 bg-white shadow transition-transform absolute top-1 ${
                  prefs[key] ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </label>
          {errors[key] && (
            <p className="mt-1 text-xs font-mono text-destructive">{errors[key]}</p>
          )}
        </div>
      ))}

      <p className="pt-2 text-xs font-mono text-muted-foreground border-t border-border">
        Las notificaciones de <strong className="font-bold text-foreground">RSVP inicial</strong>{" "}
        y <strong className="font-bold text-foreground">recuperación de contraseña</strong> son
        transaccionales y no pueden desactivarse.
      </p>
    </div>
  );
}
