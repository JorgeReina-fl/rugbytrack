import { z } from "zod";
import { RugbyPosition } from "@prisma/client";

export const createTeamSchema = z.object({
  name: z
    .string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(80, "El nombre no puede superar 80 caracteres")
    .trim(),
  description: z.string().max(500).trim().optional(),
  logoUrl: z.string().url("URL de logo no válida").optional(),
});

export const updateTeamSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(80)
    .trim()
    .optional(),
  description: z.string().max(500).trim().optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
});

export const joinTeamSchema = z.object({
  token: z
    .string()
    .length(12, "El token debe tener 12 caracteres")
    .regex(/^[a-zA-Z0-9]+$/, "Token inválido"),
  position: z.nativeEnum(RugbyPosition).optional(),
  jerseyNumber: z.number().int().min(1).max(99).optional(),
});

export const updateMemberSchema = z.object({
  position: z.nativeEnum(RugbyPosition).optional(),
  jerseyNumber: z.number().int().min(1).max(99).optional().nullable(),
  isCoach: z.boolean().optional(),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type JoinTeamInput = z.infer<typeof joinTeamSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
