import { z } from "zod";
import { BodyArea } from "@prisma/client";

export const discomfortSchema = z.object({
  bodyArea: z.nativeEnum(BodyArea),
  intensity: z.number().int().min(0).max(10),
  note: z
    .string()
    .trim()
    .max(280, "La nota no puede superar los 280 caracteres")
    .optional()
    .transform((v) => (v ? v : null)),
});

export type DiscomfortInput = z.infer<typeof discomfortSchema>;
