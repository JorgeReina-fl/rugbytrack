import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { logger } from "@/lib/logger";

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function apiError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function apiUnauthorized() {
  return apiError("No autenticado", 401);
}

export function apiForbidden() {
  return apiError("No tienes permisos para realizar esta acción", 403);
}

export function apiNotFound(resource = "Recurso") {
  return apiError(`${resource} no encontrado`, 404);
}

export function handleZodError(err: ZodError) {
  const issues = err.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
  return NextResponse.json({ error: "Datos inválidos", issues }, { status: 422 });
}

export function handleUnknownError(err: unknown, context: string) {
  logger.error({ err, context }, "Unhandled API error");
  return apiError("Error interno del servidor", 500);
}
