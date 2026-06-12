"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface PlayerStats {
  name: string;
  position: string | null;
  avgRpe: number;
  attendanceRate: number;
  totalEvents: number;
  avgWorkload: number;
}

interface SimilarPlayer {
  userId: string;
  name: string;
  image: string | null;
  position: string | null;
  jerseyNumber: number | null;
  similarity: number;
  stats: PlayerStats;
}

interface TeamMember {
  userId: string;
  name: string;
  position: string | null;
  jerseyNumber: number | null;
  hasEmbedding: boolean;
}

const POSITION_LABELS: Record<string, string> = {
  PROP_LOOSEHEAD: "1 - Pilar Zurdo",
  HOOKER: "2 - Talonador",
  PROP_TIGHTHEAD: "3 - Pilar Derecho",
  LOCK: "4/5 - Segundo Línea",
  FLANKER_BLINDSIDE: "6 - Ala Ciega",
  FLANKER_OPENSIDE: "7 - Ala Abierta",
  NUMBER_EIGHT: "8 - Octavo",
  SCRUM_HALF: "9 - Medio Mêlée",
  FLY_HALF: "10 - Apertura",
  CENTER_INSIDE: "12 - Centro Interior",
  CENTER_OUTSIDE: "13 - Centro Exterior",
  WING_LEFT: "11 - Ala Izquierda",
  WING_RIGHT: "14 - Ala Derecha",
  FULLBACK: "15 - Zaguero",
  REPLACEMENT: "Reserva",
};

export default function SimilarPlayersClient({
  teamId,
  teamName,
  players,
  isCoach,
}: {
  teamId: string;
  teamName: string;
  players: TeamMember[];
  isCoach: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [results, setResults] = useState<SimilarPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [embedding, setEmbedding] = useState(false);
  const [embedMsg, setEmbedMsg] = useState("");
  const [error, setError] = useState("");
  const [limit, setLimit] = useState(5);

  const fetchSimilar = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    setError("");
    setResults([]);
    try {
      const res = await fetch(
        `/api/players/similar?id=${encodeURIComponent(selectedId)}&limit=${limit}`
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Error al buscar jugadores similares");
      } else {
        setResults(json.data?.players ?? []);
      }
    } catch {
      setError("Error de red");
    } finally {
      setLoading(false);
    }
  }, [selectedId, limit]);

  useEffect(() => {
    if (selectedId) fetchSimilar();
  }, [selectedId, fetchSimilar]);

  const handleGenerateEmbeddings = async () => {
    setEmbedding(true);
    setEmbedMsg("");
    try {
      const res = await fetch("/api/players/embed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setEmbedMsg(`Error: ${json.error ?? "desconocido"}`);
      } else {
        setEmbedMsg(
          `✅ ${json.data?.embedded ?? 0} embeddings generados. Selecciona un jugador para buscar similares.`
        );
        if (selectedId) fetchSimilar();
      }
    } catch {
      setEmbedMsg("Error de red al generar embeddings");
    } finally {
      setEmbedding(false);
    }
  };

  const selectedPlayer = players.find((p) => p.userId === selectedId);

  return (
    <div className="space-y-8">
      {/* Embedding generation panel (coach only) */}
      {isCoach && (
        <div className="border border-primary/30 bg-primary/5 p-5">
          <p className="text-xs font-mono font-bold uppercase tracking-widest text-primary mb-3">
            🧠 Motor de búsqueda semántica
          </p>
          <p className="text-sm font-mono text-muted-foreground mb-4">
            Genera embeddings vectoriales de los perfiles de jugadores para
            activar la búsqueda por similitud. Usa el modelo{" "}
            <code className="bg-secondary px-1 text-xs">
              text-embedding-004
            </code>{" "}
            de Google Gemini.
          </p>
          <button
            id="btn-generate-embeddings"
            onClick={handleGenerateEmbeddings}
            disabled={embedding}
            className="bg-primary text-primary-foreground px-5 py-2.5 text-xs font-mono font-bold uppercase tracking-widest hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {embedding ? "Generando..." : "Generar / Actualizar embeddings"}
          </button>
          {embedMsg && (
            <p className="mt-3 text-xs font-mono text-foreground">{embedMsg}</p>
          )}
        </div>
      )}

      {/* Player selector */}
      <div className="border border-border bg-card p-6 shadow-sm">
        <h2 className="font-mono font-bold text-sm uppercase tracking-widest text-foreground mb-4">
          Seleccionar jugador de referencia
        </h2>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <select
              id="select-player"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full border border-border bg-background px-3 py-2.5 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">— Elige un jugador —</option>
              {players.map((p) => (
                <option key={p.userId} value={p.userId}>
                  {p.jerseyNumber != null ? `#${p.jerseyNumber} ` : ""}
                  {p.name}
                  {p.position ? ` · ${POSITION_LABELS[p.position] ?? p.position}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground whitespace-nowrap">
              Top
            </label>
            <select
              id="select-limit"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="border border-border bg-background px-3 py-2.5 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {[3, 5, 10].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      {selectedId && (
        <div className="border border-border bg-card shadow-sm overflow-hidden">
          <div className="border-b border-border bg-secondary px-6 py-4 flex items-center justify-between">
            <h2 className="font-mono font-bold text-sm uppercase tracking-widest text-foreground">
              Jugadores similares a{" "}
              <span className="text-primary">{selectedPlayer?.name ?? "..."}</span>
            </h2>
            {!loading && results.length > 0 && (
              <span className="text-xs font-mono text-muted-foreground">
                {results.length} resultado{results.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {loading && (
            <div className="p-8 text-center">
              <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent animate-spin mb-3" />
              <p className="text-xs font-mono text-muted-foreground">
                Calculando similitudes...
              </p>
            </div>
          )}

          {error && (
            <div className="p-6 border-l-2 border-primary bg-primary/5">
              <p className="text-sm font-mono text-foreground">{error}</p>
              {error.includes("Embedding") && isCoach && (
                <p className="text-xs font-mono text-muted-foreground mt-2">
                  Genera los embeddings primero usando el panel de arriba.
                </p>
              )}
            </div>
          )}

          {!loading && !error && results.length === 0 && selectedId && (
            <div className="p-8 text-center">
              <p className="text-xs font-mono text-muted-foreground">
                No se encontraron jugadores similares. Asegúrate de haber generado
                los embeddings del equipo.
              </p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="divide-y divide-border">
              {results.map((player, idx) => {
                const pct = Math.round(player.similarity * 100);
                const stats = player.stats;
                return (
                  <div
                    key={player.userId}
                    className="flex items-start gap-5 px-6 py-5 hover:bg-secondary/40 transition-all group"
                  >
                    {/* Rank */}
                    <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center border border-border bg-secondary font-heading font-black text-sm text-primary">
                      #{idx + 1}
                    </div>

                    {/* Jersey */}
                    {player.jerseyNumber != null && (
                      <div className="flex-shrink-0 w-8 h-10 flex items-center justify-center font-mono font-bold text-xs text-muted-foreground">
                        {player.jerseyNumber}
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-foreground">
                          {player.name}
                        </p>
                        {player.position && (
                          <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                            {POSITION_LABELS[player.position] ?? player.position}
                          </span>
                        )}
                      </div>

                      {/* Stats snapshot */}
                      {stats && (
                        <div className="mt-2 flex flex-wrap gap-3">
                          <StatPill
                            label="RPE prom."
                            value={`${stats.avgRpe.toFixed(1)}/10`}
                          />
                          <StatPill
                            label="Carga"
                            value={`${stats.avgWorkload.toFixed(0)} UA`}
                          />
                          <StatPill
                            label="Asistencia"
                            value={`${(stats.attendanceRate * 100).toFixed(0)}%`}
                          />
                          <StatPill
                            label="Eventos"
                            value={`${stats.totalEvents}`}
                          />
                        </div>
                      )}
                    </div>

                    {/* Similarity score */}
                    <div className="flex-shrink-0 text-right">
                      <div className="text-2xl font-heading font-black text-primary">
                        {pct}%
                      </div>
                      <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                        similitud
                      </div>
                      {/* Visual bar */}
                      <div className="mt-1.5 w-16 h-1 bg-border overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 bg-secondary border border-border px-2 py-0.5">
      <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <span className="text-xs font-mono font-bold text-foreground">{value}</span>
    </span>
  );
}
