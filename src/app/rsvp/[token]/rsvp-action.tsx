"use client";

import React, { useState } from "react";

type RsvpStatus = "idle" | "loading" | "confirmed" | "declined" | "error";

interface RsvpActionProps {
  token: string;
}

export function RsvpAction({ token }: RsvpActionProps) {
  const [status, setStatus] = useState<RsvpStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleRsvp = async (responseStatus: "CONFIRMED" | "DECLINED") => {
    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/rsvp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, status: responseStatus }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Ocurrió un error inesperado");
      }

      setStatus(responseStatus === "CONFIRMED" ? "confirmed" : "declined");
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message);
      setStatus("error");
    }
  };

  if (status === "confirmed") {
    return (
      <div className="bg-[#808CFD] text-white p-4 font-mono font-bold uppercase tracking-widest text-center shadow-sm">
        ✓ Asistencia confirmada
      </div>
    );
  }

  if (status === "declined") {
    return (
      <div className="bg-secondary text-foreground p-4 font-mono font-bold uppercase tracking-widest text-center border border-border shadow-sm">
        Respuesta registrada
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {status === "error" && (
        <div className="text-destructive text-sm font-mono font-bold uppercase tracking-widest mb-4">
          Error: {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => handleRsvp("CONFIRMED")}
          disabled={status === "loading"}
          className="bg-[#808CFD] text-white hover:bg-[#000000] px-4 py-4 font-mono font-bold uppercase tracking-widest transition-colors disabled:opacity-50"
        >
          {status === "loading" ? "Procesando..." : "Asistiré"}
        </button>

        <button
          onClick={() => handleRsvp("DECLINED")}
          disabled={status === "loading"}
          className="bg-[#E9ECFF] text-foreground hover:bg-[#000000] hover:text-white px-4 py-4 font-mono font-bold uppercase tracking-widest transition-colors disabled:opacity-50"
        >
          No Asistiré
        </button>
      </div>
    </div>
  );
}
