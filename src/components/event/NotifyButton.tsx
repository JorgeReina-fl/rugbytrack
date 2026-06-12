"use client";

import React, { useState } from "react";

interface NotifyButtonProps {
  eventId: string;
}

export function NotifyButton({ eventId }: NotifyButtonProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleNotify = async () => {
    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch(`/api/events/${eventId}/notify`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al notificar");
      }

      setStatus("success");
      setMessage(`Links enviados a ${data.sent} jugadores`);
    } catch (error: any) {
      console.error(error);
      setStatus("error");
      setMessage(error.message);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleNotify}
        disabled={status === "loading" || status === "success"}
        className="w-full bg-primary text-primary-foreground hover:opacity-90 px-4 py-3 font-mono font-bold uppercase tracking-widest transition-all disabled:opacity-50 text-sm"
      >
        {status === "loading" ? "Generando Links..." : "Enviar Magic Links"}
      </button>

      {status === "success" && (
        <p className="text-xs font-mono font-bold uppercase tracking-widest text-primary mt-1">
          ✓ {message}
        </p>
      )}

      {status === "error" && (
        <p className="text-xs font-mono font-bold uppercase tracking-widest text-destructive mt-1">
          ⚠️ {message}
        </p>
      )}
    </div>
  );
}
