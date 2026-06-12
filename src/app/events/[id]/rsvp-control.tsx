"use client";

import React, { useState } from "react";
import { AttendanceStatus } from "@prisma/client";

interface RsvpControlProps {
  eventId: string;
  initialStatus: AttendanceStatus;
}

export function RsvpControl({ eventId, initialStatus }: RsvpControlProps) {
  const [status, setStatus] = useState<AttendanceStatus>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRsvp = async (newStatus: AttendanceStatus) => {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`/api/events/${eventId}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al actualizar tu RSVP");
      }

      setStatus(newStatus);
    } catch (err: any) {
      setError(err.message || "No se pudo actualizar la asistencia");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="border border-destructive bg-destructive/10 p-3 text-xs font-mono font-bold text-destructive">
          ⚠️ {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => handleRsvp("CONFIRMED")}
          disabled={loading}
          className={`flex-1 py-3 text-xs font-mono font-bold uppercase tracking-widest transition-all border ${
            status === "CONFIRMED"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card border-border text-muted-foreground hover:border-foreground hover:text-foreground"
          }`}
        >
          {loading && status === "CONFIRMED" ? "Procesando..." : "Asistiré"}
        </button>

        <button
          onClick={() => handleRsvp("DECLINED")}
          disabled={loading}
          className={`flex-1 py-3 text-xs font-mono font-bold uppercase tracking-widest transition-all border ${
            status === "DECLINED"
              ? "bg-destructive text-white border-destructive"
              : "bg-card border-border text-muted-foreground hover:border-foreground hover:text-foreground"
          }`}
        >
          {loading && status === "DECLINED" ? "Procesando..." : "No asistiré"}
        </button>
      </div>

      <div className="text-center">
        <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
          Estado actual:{" "}
          <strong
            className={
              status === "CONFIRMED"
                ? "text-primary"
                : status === "DECLINED"
                ? "text-destructive"
                : "text-foreground"
            }
          >
            {status === "CONFIRMED"
              ? "Confirmado"
              : status === "DECLINED"
              ? "Rechazado"
              : "Pendiente"}
          </strong>
        </span>
      </div>
    </div>
  );
}
