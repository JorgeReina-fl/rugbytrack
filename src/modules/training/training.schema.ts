import { z } from "zod";

export const createTrainingBlockSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(100),
  duration: z.number().int().positive("La duración debe ser positiva"),
  description: z.string().max(500).optional(),
  order: z.number().int().nonnegative(),
});

export const rpeEntrySchema = z.object({
  eventId: z.string().cuid("ID de evento inválido"),
  rpe: z.number().int().min(1).max(10, "El RPE debe estar entre 1 y 10"),
  duration: z.number().int().positive("La duración efectiva debe ser mayor a 0"),
  notes: z.string().max(500).optional(),
});

export type CreateTrainingBlockInput = z.infer<typeof createTrainingBlockSchema>;
export type RpeEntryInput = z.infer<typeof rpeEntrySchema>;
