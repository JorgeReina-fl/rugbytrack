import { z } from "zod";
import { EventType, RugbyPosition, AttendanceStatus } from "@prisma/client";

// Regex to validate ISO date strings (basic validation, parse will handle actual date conversion)
const dateCoercible = z.string().datetime({ message: "Fecha con formato inválido (debe ser ISO-8601)" }).or(z.date());

export const createEventSchema = z.object({
  teamId: z.string().cuid("ID de equipo inválido"),
  title: z
    .string()
    .min(2, "El título debe tener al menos 2 caracteres")
    .max(100, "El título no puede superar 100 caracteres")
    .trim(),
  type: z.nativeEnum(EventType, { message: "Tipo de evento inválido" }),
  description: z.string().max(1000).trim().optional().nullable(),
  location: z.string().max(200).trim().optional().nullable(),
  startDate: dateCoercible,
  endDate: dateCoercible.optional().nullable(),
  rsvpDeadline: dateCoercible.optional().nullable(),
  callups: z
    .array(
      z.object({
        userId: z.string().cuid("ID de usuario inválido"),
        isStarter: z.boolean().default(false),
        position: z.nativeEnum(RugbyPosition).optional().nullable(),
      })
    )
    .optional(),
});

export const updateEventSchema = z.object({
  title: z
    .string()
    .min(2, "El título debe tener al menos 2 caracteres")
    .max(100, "El título no puede superar 100 caracteres")
    .trim()
    .optional(),
  type: z.nativeEnum(EventType).optional(),
  description: z.string().max(1000).trim().optional().nullable(),
  location: z.string().max(200).trim().optional().nullable(),
  startDate: dateCoercible.optional(),
  endDate: dateCoercible.optional().nullable(),
  rsvpDeadline: dateCoercible.optional().nullable(),
});

export const rsvpSchema = z.object({
  status: z.nativeEnum(AttendanceStatus, { message: "Estado de RSVP inválido" }),
});

export const manualAttendanceSchema = z.object({
  checkedIn: z.boolean(),
  status: z.nativeEnum(AttendanceStatus, { message: "Estado de asistencia inválido" }),
});

export const sessionActionSchema = z.object({
  action: z.enum(["start", "stop"], { message: "Acción de sesión inválida (debe ser start o stop)" }),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type RsvpInput = z.infer<typeof rsvpSchema>;
export type ManualAttendanceInput = z.infer<typeof manualAttendanceSchema>;
export type SessionActionInput = z.infer<typeof sessionActionSchema>;
