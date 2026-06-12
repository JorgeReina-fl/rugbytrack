/**
 * @jest-environment node
 */

import { POST as createEventRoute } from "@/app/api/events/route";
import { POST as rsvpRoute } from "@/app/api/events/[id]/rsvp/route";
import { PATCH as editEventRoute } from "@/app/api/events/[id]/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { AttendanceStatus } from "@prisma/client";

// Mocks
jest.mock("@/auth", () => ({
  auth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    teamMember: {
      findFirst: jest.fn(),
    },
    event: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    attendance: {
      upsert: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(prisma)),
    user: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock("@/lib/resend", () => ({
  sendCallupNotification: jest.fn().mockResolvedValue({ id: "mock-email-id" }),
  sendReminderNotification: jest.fn().mockResolvedValue({ id: "mock-email-id" }),
}));

jest.mock("ioredis", () => {
  return jest.fn().mockImplementation(() => {
    return {
      publish: jest.fn().mockResolvedValue(1),
      quit: jest.fn().mockResolvedValue("OK"),
    };
  });
});

describe("RugbyTrack — Fase 2 Event API Tests", () => {
  const mockAuth = auth as jest.Mock;
  const mockPrisma = prisma as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 1. POST /api/events - Valida que PLAYER no puede crear evento
  test("POST /api/events — Debe retornar 403 si un PLAYER intenta crear un evento", async () => {
    // Simulamos sesión de jugador
    mockAuth.mockResolvedValue({
      user: { id: "player-123", role: "PLAYER", name: "Juan Jugador" },
    });

    // Simulamos que el jugador NO es entrenador en ese equipo
    mockPrisma.teamMember.findFirst.mockResolvedValue(null);

    const body = {
      teamId: "cl00000000000000000000000",
      title: "Entrenamiento de Scrum",
      type: "TRAINING",
      startDate: new Date().toISOString(),
    };

    const request = new NextRequest("http://localhost:3000/api/events", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await createEventRoute(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe("No tienes permisos para realizar esta acción");
  });

  // 2. POST /api/events/[id]/rsvp - Toggle correcto de AttendanceStatus
  test("POST /api/events/[id]/rsvp — Debe actualizar correctamente el RSVP del jugador", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "player-123", role: "PLAYER", name: "Juan Jugador" },
    });

    // Mock de evento existente y membresía de jugador
    mockPrisma.event.findUnique.mockResolvedValue({
      id: "event-123",
      teamId: "team-123",
      rsvpDeadline: null,
    });
    mockPrisma.teamMember.findFirst.mockResolvedValue({
      userId: "player-123",
      teamId: "team-123",
      isCoach: false,
    });
    mockPrisma.attendance.upsert.mockResolvedValue({
      eventId: "event-123",
      userId: "player-123",
      status: AttendanceStatus.CONFIRMED,
    });

    const body = { status: "CONFIRMED" };
    const request = new NextRequest("http://localhost:3000/api/events/event-123/rsvp", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const params = Promise.resolve({ id: "event-123" });
    const response = await rsvpRoute(request, { params });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.attendance.upsert).toHaveBeenCalledWith({
      where: {
        eventId_userId: {
          eventId: "event-123",
          userId: "player-123",
        },
      },
      update: {
        status: "CONFIRMED",
      },
      create: {
        eventId: "event-123",
        userId: "player-123",
        status: "CONFIRMED",
        checkedIn: false,
      },
    });
    expect(json.data.status).toBe("CONFIRMED");
  });

  // 3. PATCH /api/events/[id] - Lógica de ownership check
  test("PATCH /api/events/[id] — Debe retornar 403 si un entrenador intenta editar un evento que no creó", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "coach-diferente", role: "COACH", name: "Otro Entrenador" },
    });

    // Evento creado por "coach-creador"
    mockPrisma.event.findUnique.mockResolvedValue({
      id: "event-123",
      teamId: "team-123",
      createdById: "coach-creador",
    });

    // El usuario es coach en el equipo, pero no es el creador del evento
    mockPrisma.teamMember.findFirst.mockResolvedValue({
      userId: "coach-diferente",
      teamId: "team-123",
      isCoach: true,
    });

    const body = { title: "Nuevo Título" };
    const request = new NextRequest("http://localhost:3000/api/events/event-123", {
      method: "PATCH",
      body: JSON.stringify(body),
    });

    const params = Promise.resolve({ id: "event-123" });
    const response = await editEventRoute(request, { params });
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe("No tienes permisos para realizar esta acción");
  });
});
