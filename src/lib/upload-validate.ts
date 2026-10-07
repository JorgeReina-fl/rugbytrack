// Validación de subidas por los BYTES reales del fichero. Nunca por file.type ni por file.name (los controla el cliente).
// Funciones puras: sin dependencias de Node ni de Next (solo zod para el esquema de URLs).

import { z } from "zod";

export type ImageType = "jpeg" | "png" | "webp";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

/** Por debajo de 12 bytes no cabe ni la cabecera más larga (WEBP: RIFF + tamaño + WEBP). */
const MIN_IMAGE_BYTES = 12;

const EXTENSION: Record<ImageType, string> = { jpeg: "jpg", png: "png", webp: "webp" };

export function extensionFor(type: ImageType): string {
  return EXTENSION[type];
}

/**
 * Única forma aceptada de URL de imagen subida: la ruta que devuelve POST /api/upload
 * (`/uploads/<uuid>.jpg|png|webp`). Sin esquema, sin host, sin query, sin `..`.
 */
export const UPLOAD_URL_RE = /^\/uploads\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

/** Esquema zod para campos que guardan una imagen subida (compónlo con .optional()/.nullable() según el campo). */
export const uploadUrl = z.string().regex(UPLOAD_URL_RE, "URL de imagen no válida");

const startsWith = (buf: Uint8Array, sig: number[], at = 0): boolean =>
  sig.every((b, i) => buf[at + i] === b);

/**
 * Detecta JPEG, PNG o WEBP por magic numbers. Cualquier otra cosa → null
 * (AVIF/HEIF `ftyp`, SVG, GIF, texto, vacío…).
 */
export function detectImageType(buf: Uint8Array): ImageType | null {
  if (buf.length < MIN_IMAGE_BYTES) return null;
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  // "RIFF" en 0..3 y "WEBP" en 8..11
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)) return "webp";
  return null;
}
