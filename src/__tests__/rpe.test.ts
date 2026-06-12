/**
 * @jest-environment node
 */

import { POST as createRpeRoute } from "@/app/api/rpe/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

// Mocks
jest.mock("@/auth", () => ({
  auth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    event: {
      findUnique: jest.fn(),
    },
    teamMember: {
      findUnique: jest.fn(),
    },
    rpeEntry: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(prisma)),
  },
}));

describe("RugbyTrack — Fase 3 RPE API Tests", () => {
  const mockAuth = auth as jest.Mock;
  const mockPrisma = prisma as any;
  const validEventId = "cl00000000000000000000000";

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.rpeEntry.findUnique.mockResolvedValue(null);
  });

  test("POST /api/rpe — Debe retornar 403 si un COACH intenta registrar RPE", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "coach-123", role: "COACH", name: "Pep Guardiola" },
    });

    const body = {
      eventId: validEventId,
      rpe: 8,
      duration: 80,
    };

    const request = new NextRequest("http://localhost:3000/api/rpe", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await createRpeRoute(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe("Solo los jugadores pueden registrar su esfuerzo");
  });

  test("POST /api/rpe — Debe retornar 422 si los datos de entrada son inválidos", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "player-123", role: "PLAYER", name: "Juan Jugador" },
    });

    // RPE fuera de rango (11)
    const body = {
      eventId: validEventId,
      rpe: 11,
      duration: 80,
    };

    const request = new NextRequest("http://localhost:3000/api/rpe", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await createRpeRoute(request);
    const json = await response.json();

    expect(response.status).toBe(422);
    expect(json.error).toBe("Datos inválidos");
  });

  test("POST /api/rpe — Debe retornar 404 si el evento no existe", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "player-123", role: "PLAYER", name: "Juan Jugador" },
    });

    mockPrisma.event.findUnique.mockResolvedValue(null);

    const body = {
      eventId: validEventId,
      rpe: 7,
      duration: 90,
    };

    const request = new NextRequest("http://localhost:3000/api/rpe", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await createRpeRoute(request);
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Evento no encontrado");
  });

  test("POST /api/rpe — Debe retornar 403 si el jugador no pertenece al equipo del evento", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "player-123", role: "PLAYER", name: "Juan Jugador" },
    });

    mockPrisma.event.findUnique.mockResolvedValue({
      id: validEventId,
      teamId: "team-123",
      startDate: new Date("2026-06-09T20:00:00Z"),
      team: { members: [] },
      attendances: []
    });

    const body = {
      eventId: validEventId,
      rpe: 7,
      duration: 90,
    };

    const request = new NextRequest("http://localhost:3000/api/rpe", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await createRpeRoute(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe("No perteneces al equipo asociado a este evento");
  });

  test("POST /api/rpe — Debe retornar 201 y guardar RpeEntry con workload correcto", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "player-123", role: "PLAYER", name: "Juan Jugador" },
    });

    mockPrisma.event.findUnique.mockResolvedValue({
      id: validEventId,
      teamId: "team-123",
      startDate: new Date("2026-06-09T20:00:00Z"),
      team: { members: [{ userId: "player-123" }] },
      attendances: [{ userId: "player-123", status: "CONFIRMED", checkedIn: false }]
    });
    mockPrisma.rpeEntry.create.mockImplementation(({ data }: any) => Promise.resolve({ id: "rpe-123", ...data }));

    const body = {
      eventId: validEventId,
      rpe: 7,
      duration: 90,
      notes: "Entrenamiento intenso",
    };

    const request = new NextRequest("http://localhost:3000/api/rpe", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await createRpeRoute(request);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.workload).toBe(630); // 7 * 90
    expect(json.eventId).toBe(validEventId);
    expect(json.userId).toBe("player-123");
  });

  test("POST /api/rpe — Debe retornar 409 si el RPE ya fue registrado (P2002)", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "player-123", role: "PLAYER", name: "Juan Jugador" },
    });

    mockPrisma.event.findUnique.mockResolvedValue({
      id: validEventId,
      teamId: "team-123",
      startDate: new Date("2026-06-09T20:00:00Z"),
      team: { members: [{ userId: "player-123" }] },
      attendances: [{ userId: "player-123", status: "CONFIRMED", checkedIn: false }]
    });

    // Provocar error P2002 de Prisma
    mockPrisma.rpeEntry.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Duplicate entry", {
        code: "P2002",
        clientVersion: "5.22.0",
      })
    );

    const body = {
      eventId: validEventId,
      rpe: 7,
      duration: 90,
    };

    const request = new NextRequest("http://localhost:3000/api/rpe", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await createRpeRoute(request);
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.error).toBe("Ya has registrado tu RPE para esta sesión");
  });
});
