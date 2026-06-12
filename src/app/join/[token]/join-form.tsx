"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import type { RugbyPosition } from "@prisma/client";

const POSITIONS: { value: RugbyPosition; label: string }[] = [
  { value: "PROP_LOOSEHEAD", label: "1 - Pilar Zurdo" },
  { value: "HOOKER", label: "2 - Talonador" },
  { value: "PROP_TIGHTHEAD", label: "3 - Pilar Derecho" },
  { value: "LOCK", label: "4/5 - Segundo línea" },
  { value: "FLANKER_BLINDSIDE", label: "6 - Ala Ciega" },
  { value: "FLANKER_OPENSIDE", label: "7 - Ala Abierta" },
  { value: "NUMBER_EIGHT", label: "8 - Octavo" },
  { value: "SCRUM_HALF", label: "9 - Medio Mêlée" },
  { value: "FLY_HALF", label: "10 - Apertura" },
  { value: "CENTER_INSIDE", label: "12 - Centro Interior" },
  { value: "CENTER_OUTSIDE", label: "13 - Centro Exterior" },
  { value: "WING_LEFT", label: "11 - Ala Izquierda" },
  { value: "WING_RIGHT", label: "14 - Ala Derecha" },
  { value: "FULLBACK", label: "15 - Zaguero" },
  { value: "REPLACEMENT", label: "Reserva" },
];

interface Props {
  token: string;
  teamId: string;
}

export default function JoinTeamForm({ token, teamId }: Props) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!session?.user) {
      router.push(`/login?callbackUrl=/join/${token}`);
      return;
    }

    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const position = form.get("position") as RugbyPosition | null;
    const jerseyRaw = form.get("jerseyNumber") as string;
    const jerseyNumber = jerseyRaw ? parseInt(jerseyRaw, 10) : undefined;

    try {
      const res = await fetch("/api/teams/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          position: position || undefined,
          jerseyNumber,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Error al unirse al equipo");
        setLoading(false);
        return;
      }

      router.push(`/teams/${teamId}`);
      router.refresh();
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
      setLoading(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="flex justify-center py-8">
        <div className="h-6 w-6 animate-spin border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <form id="join-team-form" onSubmit={handleJoin} className="space-y-6">
      {error && (
        <div
          role="alert"
          className="border border-destructive bg-destructive/10 px-4 py-3 text-xs font-mono font-bold uppercase tracking-widest text-destructive"
        >
          {error}
        </div>
      )}

      {!session?.user && (
        <div className="border border-primary/30 bg-primary/5 px-4 py-3 text-xs font-mono font-bold uppercase tracking-widest text-primary">
          Necesitas iniciar sesión para unirte al equipo
        </div>
      )}

      <div>
        <label
          htmlFor="position-select"
          className="mb-2 block text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground"
        >
          Posición <span className="text-muted-foreground/60">(opcional)</span>
        </label>
        <select
          id="position-select"
          name="position"
          className="w-full border border-border bg-card px-4 py-3 text-sm font-mono text-foreground outline-none ring-primary transition-all focus:border-primary focus:ring-1"
        >
          <option value="">Sin asignar</option>
          {POSITIONS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="jersey-number"
          className="mb-2 block text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground"
        >
          Número de camiseta <span className="text-muted-foreground/60">(opcional)</span>
        </label>
        <input
          id="jersey-number"
          name="jerseyNumber"
          type="number"
          min={1}
          max={99}
          className="w-full border border-border bg-card px-4 py-3 text-sm font-mono text-foreground placeholder:text-muted-foreground outline-none ring-primary transition-all focus:border-primary focus:ring-1"
          placeholder="15"
        />
      </div>

      {!session?.user ? (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push(`/login?callbackUrl=/join/${token}`)}
            className="w-full flex-1 bg-primary px-4 py-3 text-center text-xs font-mono uppercase tracking-widest font-bold text-primary-foreground hover:opacity-90 transition-all"
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            onClick={() => router.push(`/register?callbackUrl=/join/${token}`)}
            className="w-full flex-1 border border-primary px-4 py-3 text-center text-xs font-mono uppercase tracking-widest font-bold text-primary hover:bg-primary/5 transition-all"
          >
            Registrarse
          </button>
        </div>
      ) : (
        <button
          id="join-team-submit"
          type="submit"
          disabled={loading}
          className="w-full bg-primary px-4 py-3 text-xs font-mono uppercase tracking-widest font-bold text-primary-foreground hover:opacity-90 transition-all disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Uniéndose..." : "Unirse al equipo"}
        </button>
      )}
    </form>
  );
}
