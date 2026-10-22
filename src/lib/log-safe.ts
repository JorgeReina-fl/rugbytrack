/**
 * Resumen de un error apto para logs: nombre, código y primer frame de la pila.
 * Nunca el mensaje ni el objeto: los de Prisma, Resend o Mongo pueden incluir destinatarios,
 * valores de columnas o URLs con credenciales.
 */
export function errInfo(err: unknown): { name: string; code?: string | number; at?: string } {
  if (err === null || typeof err !== "object") return { name: typeof err };
  const e = err as { name?: unknown; code?: unknown; statusCode?: unknown; stack?: unknown };
  const code = typeof e.code === "string" || typeof e.code === "number" ? e.code : typeof e.statusCode === "number" ? e.statusCode : undefined;
  const at = typeof e.stack === "string" ? e.stack.split("\n").find((l) => /^\s+at /.test(l))?.trim() : undefined;
  return { name: typeof e.name === "string" ? e.name : "Error", ...(code !== undefined && { code }), ...(at && { at }) };
}
