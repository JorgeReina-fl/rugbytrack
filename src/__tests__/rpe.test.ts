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
      findFirst: jest.fn(),
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
    mockPrisma.teamMember.findFirst.mockResolvedValue({ isCoach: false });
  });

  const eventFixture = {
    id: validEventId,
    teamId: "team-123",
    startDate: new Date(Date.now() - 2 * 60 * 60 * 1000), // dentro del plazo de 48 h
    attendances: [{ userId: "player-123", status: "CONFIRMED", checkedIn: false }],
    _count: { attendances: 0 },
  };
  const rpeRequest = () =>
    new NextRequest("http://localhost:3000/api/rpe", {
      method: "POST",
      body: JSON.stringify({ eventId: validEventId, rpe: 8, duration: 80 }),
    });

  test("POST /api/rpe — User.role COACH sin isCoach en el equipo puede registrar RPE", async () => {
    mockAuth.mockResolvedValue({ user: { id: "player-123", role: "COACH", name: "Juan Jugador" } });
    mockPrisma.event.findUnique.mockResolvedValue(eventFixture);
    mockPrisma.teamMember.findFirst.mockResolvedValue({ isCoach: false });
    mockPrisma.rpeEntry.create.mockImplementation(({ data }: any) => Promise.resolve({ id: "rpe-125", ...data }));

    const response = await createRpeRoute(rpeRequest());
    expect(response.status).toBe(201);
    expect(mockPrisma.teamMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { teamId: "team-123", userId: "player-123", leftAt: null } })
    );
  });

  test("POST /api/rpe — Debe retornar 403 si es coach del equipo (isCoach), aunque User.role sea PLAYER", async () => {
    mockAuth.mockResolvedValue({ user: { id: "coach-123", role: "PLAYER", name: "Pep Guardiola" } });
    mockPrisma.event.findUnique.mockResolvedValue(eventFixture);
    mockPrisma.teamMember.findFirst.mockResolvedValue({ isCoach: true });

    const response = await createRpeRoute(rpeRequest());
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe("Solo los jugadores pueden registrar su esfuerzo");
    expect(mockPrisma.rpeEntry.create).not.toHaveBeenCalled();
  });

  test("POST /api/rpe — Debe retornar 403 si la membresía no está activa (leftAt no nulo)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "player-123", role: "PLAYER", name: "Juan Jugador" } });
    mockPrisma.event.findUnique.mockResolvedValue(eventFixture);
    // getActiveMembership filtra leftAt: null, así que un ex-miembro no devuelve fila
    mockPrisma.teamMember.findFirst.mockResolvedValue(null);

    const response = await createRpeRoute(rpeRequest());
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe("No perteneces al equipo asociado a este evento");
    expect(mockPrisma.rpeEntry.create).not.toHaveBeenCalled();
  });

  test("POST /api/rpe — JSON no parseable devuelve 422", async () => {
    mockAuth.mockResolvedValue({ user: { id: "player-123", role: "PLAYER", name: "Juan Jugador" } });
    const response = await createRpeRoute(
      new NextRequest("http://localhost:3000/api/rpe", { method: "POST", body: "{no es json" })
    );
    const json = await response.json();
    expect(response.status).toBe(422);
    expect(json.error).toBe("Datos inválidos");
    expect(mockPrisma.event.findUnique).not.toHaveBeenCalled();
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
      startDate: new Date(Date.now() - 2 * 60 * 60 * 1000), // dentro del plazo de 48 h
      attendances: [],
      _count: { attendances: 0 },
    });
    mockPrisma.teamMember.findFirst.mockResolvedValue(null);

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
      startDate: new Date(Date.now() - 2 * 60 * 60 * 1000), // dentro del plazo de 48 h
      attendances: [{ userId: "player-123", status: "CONFIRMED", checkedIn: false }],
      _count: { attendances: 0 },
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
    expect(json.recordedById).toBe("player-123");
  });

  test("POST /api/rpe — El jugador no puede sobrescribir un RPE existente (409)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "player-123", role: "PLAYER", name: "Juan Jugador" } });
    mockPrisma.event.findUnique.mockResolvedValue({
      id: validEventId,
      teamId: "team-123",
      startDate: new Date(Date.now() - 2 * 60 * 60 * 1000), // dentro del plazo de 48 h
      attendances: [{ userId: "player-123", status: "CONFIRMED", checkedIn: false }],
      _count: { attendances: 0 },
    });
    mockPrisma.rpeEntry.findUnique.mockResolvedValue({ id: "rpe-1", recordedById: "coach-1" });

    const response = await createRpeRoute(
      new NextRequest("http://localhost:3000/api/rpe", {
        method: "POST",
        body: JSON.stringify({ eventId: validEventId, rpe: 7, duration: 90 }),
      })
    );
    expect(response.status).toBe(409);
    expect(mockPrisma.rpeEntry.create).not.toHaveBeenCalled();
  });

  test("POST /api/rpe — Debe retornar 409 si el RPE ya fue registrado (P2002)", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "player-123", role: "PLAYER", name: "Juan Jugador" },
    });

    mockPrisma.event.findUnique.mockResolvedValue({
      id: validEventId,
      teamId: "team-123",
      startDate: new Date(Date.now() - 2 * 60 * 60 * 1000), // dentro del plazo de 48 h
      attendances: [{ userId: "player-123", status: "CONFIRMED", checkedIn: false }],
      _count: { attendances: 0 },
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

  test("POST /api/rpe — Con lista tomada, un CONFIRMED sin check-in recibe 403 (R2)", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "player-123", role: "PLAYER", name: "Juan Jugador" },
    });
    mockPrisma.event.findUnique.mockResolvedValue({
      id: validEventId,
      teamId: "team-123",
      startDate: new Date(Date.now() - 2 * 60 * 60 * 1000), // dentro del plazo de 48 h
      attendances: [{ userId: "player-123", status: "CONFIRMED", checkedIn: false }],
      _count: { attendances: 12 },
    });

    const request = new NextRequest("http://localhost:3000/api/rpe", {
      method: "POST",
      body: JSON.stringify({ eventId: validEventId, rpe: 8, duration: 80 }),
    });
    const response = await createRpeRoute(request);
    expect(response.status).toBe(403);
  });

  test("POST /api/rpe — Con lista tomada, un DECLINED con check-in puede registrar RPE", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "player-123", role: "PLAYER", name: "Juan Jugador" },
    });
    mockPrisma.event.findUnique.mockResolvedValue({
      id: validEventId,
      teamId: "team-123",
      startDate: new Date(Date.now() - 2 * 60 * 60 * 1000), // dentro del plazo de 48 h
      attendances: [{ userId: "player-123", status: "DECLINED", checkedIn: true }],
      _count: { attendances: 12 },
    });
    mockPrisma.rpeEntry.create.mockImplementation(({ data }: any) => Promise.resolve({ id: "rpe-124", ...data }));

    const request = new NextRequest("http://localhost:3000/api/rpe", {
      method: "POST",
      body: JSON.stringify({ eventId: validEventId, rpe: 8, duration: 80 }),
    });
    const response = await createRpeRoute(request);
    expect(response.status).toBe(201);
  });
});
