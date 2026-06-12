import "server-only";
import { logger } from "@/lib/logger";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const EMBED_MODEL = "text-embedding-004";
const EMBED_DIMS = 768;

// TODO(security): In production, store GEMINI_API_KEY in a KMS / secret manager.
if (!GEMINI_API_KEY) {
  logger.warn(
    "GEMINI_API_KEY not set — embeddings will use deterministic fallback vectors. " +
      "Set GEMINI_API_KEY in .env.local to enable real semantic search."
  );
}

/**
 * Generates a 768-dim embedding vector for the given text using Gemini
 * text-embedding-004 REST API. Falls back to a seeded pseudo-random vector
 * when the API key is absent (dev/showcase mode).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!GEMINI_API_KEY) {
    return deterministicFallbackVector(text, EMBED_DIMS);
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: `models/${EMBED_MODEL}`,
      content: { parts: [{ text }] },
      taskType: "SEMANTIC_SIMILARITY",
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    logger.error({ status: res.status, body: errBody }, "Gemini embedding API error");
    throw new Error(`Gemini embedding failed: ${res.status}`);
  }

  const json = await res.json();
  const values: number[] = json?.embedding?.values;

  if (!Array.isArray(values) || values.length !== EMBED_DIMS) {
    throw new Error("Unexpected embedding response shape from Gemini");
  }

  return values;
}

/** Formats a player's stats into a rich text blob for embedding. */
export function buildPlayerStatsText(stats: {
  name: string;
  position: string | null;
  avgRpe: number;
  attendanceRate: number;
  totalEvents: number;
  avgWorkload: number;
}): string {
  return [
    `Jugador: ${stats.name}`,
    `Posición: ${stats.position ?? "no asignada"}`,
    `RPE promedio: ${stats.avgRpe.toFixed(1)} / 10`,
    `Carga promedio: ${stats.avgWorkload.toFixed(0)} UA`,
    `Asistencia: ${(stats.attendanceRate * 100).toFixed(0)}%`,
    `Eventos totales: ${stats.totalEvents}`,
  ].join(". ");
}

/**
 * Deterministic pseudo-random vector seeded from the text's hash.
 * Produces consistent vectors per player without an API key.
 * NOTE: This is NOT semantically meaningful — use only for dev/showcase.
 */
function deterministicFallbackVector(text: string, dims: number): number[] {
  // Simple string hash → seed
  let seed = 0;
  for (let i = 0; i < text.length; i++) {
    seed = (Math.imul(31, seed) + text.charCodeAt(i)) | 0;
  }

  // LCG PRNG
  const vec: number[] = [];
  let s = seed >>> 0;
  let norm = 0;
  for (let i = 0; i < dims; i++) {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    const v = (s / 0xffffffff) * 2 - 1;
    vec.push(v);
    norm += v * v;
  }
  // L2-normalize
  const mag = Math.sqrt(norm);
  return vec.map((v) => v / mag);
}
