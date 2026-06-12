import { z } from "zod";

export const rpeEntrySchema = z.object({
  rpe: z.number().int().min(1).max(10, "El RPE debe estar entre 1 y 10"),
  duration: z.number().int().min(1, "La duración debe ser mayor a 0").max(300, "La duración no puede superar los 300 minutos"),
  notes: z.string().max(500, "Las notas no pueden superar los 500 caracteres").optional(),
});

export type RpeEntryInput = z.infer<typeof rpeEntrySchema>;
