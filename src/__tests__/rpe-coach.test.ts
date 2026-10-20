/**
 * @jest-environment node
 */

import { PUT as coachRpeRoute, DELETE as coachRpeDelete } from "@/app/api/events/[id]/rpe/[userId]/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findUnique: jest.fn() },
    teamMember: { findFirst: jest.fn() },
    attendance: { findFirst: jest.fn() },
    rpeEntry: { findUnique: jest.fn(), upsert: jest.fn(), delete: jest.fn() },
  },
}));

describe("PUT /api/events/[id]/rpe/[userId] — el coach anota RPE", () => {
  const mockAuth = auth as jest.Mock;
  const mockPrisma = prisma as any;
  const info = logger.info as jest.Mock;
  const COACH = "coach-1";
  const PLAYER = "player-1";

  const call = (body: unknown = { rpe: 8, duration: 70 }, userId = PLAYER) =>
    coachRpeRoute(
      new Request("http://localhost/api/events/ev1/rpe/" + userId, { method: "PUT", body: JSON.stringify(body) }),
      { params: Promise.resolve({ id: "ev1", userId }) }
    );

  // getActiveMembership(teamId, userId) → findFirst({ where: { teamId, userId, leftAt: null } })
  const members = (map: Record<string, { isCoach: boolean } | null>) =>
    mockPrisma.teamMember.findFirst.mockImplementation(({ where }: any) => Promise.resolve(map[where.userId] ?? null));

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: COACH, role: "PLAYER" } });
    mockPrisma.event.findUnique.mockResolvedValue({ id: "ev1", teamId: "team-1", startDate: new Date("2026-06-09T20:00:00Z") });
    members({ [COACH]: { isCoach: true }, [PLAYER]: { isCoach: false } });
    mockPrisma.attendance.findFirst.mockResolvedValue({ checkedIn: true });
    mockPrisma.rpeEntry.findUnique.mockResolvedValue(null);
    mockPrisma.rpeEntry.upsert.mockImplementation(({ create }: any) =>
      Promise.resolve({ rpe: create.rpe, duration: create.duration, workload: create.workload, recordedById: create.recordedById, updatedAt: new Date() })
    );
  });

  test("crea el RPE de un jugador presente → 200, workload calculado, recordedById = coach", async () => {
    const res = await call();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ rpe: 8, duration: 70, workload: 560, recordedById: COACH });
    expect(json.updatedAt).toBeDefined();
    const arg = mockPrisma.rpeEntry.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ eventId_userId: { eventId: "ev1", userId: PLAYER } });
    expect(arg.create).toMatchObject({ eventId: "ev1", userId: PLAYER, recordedById: COACH });
    expect(arg.create).not.toHaveProperty("notes");
    expect(arg.update).not.toHaveProperty("notes");
    expect(info).toHaveBeenCalledWith(expect.objectContaining({ recordedById: COACH }), "RPE created by coach");
  });

  test("corrige un RPE del jugador → recordedById pasa a coach y se registra el cambio", async () => {
    mockPrisma.rpeEntry.findUnique.mockResolvedValue({ rpe: 5, duration: 60, recordedById: PLAYER });
    mockPrisma.rpeEntry.upsert.mockImplementation(({ update }: any) =>
      Promise.resolve({ ...update, updatedAt: new Date() })
    );
    const res = await call({ rpe: 9, duration: 80 });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ rpe: 9, duration: 80, workload: 720, recordedById: COACH });
    expect(mockPrisma.rpeEntry.upsert.mock.calls[0][0].update).toEqual({ rpe: 9, duration: 80, workload: 720, recordedById: COACH });
    expect(info).toHaveBeenCalledWith(
      {
        eventId: "ev1",
        userId: PLAYER,
        rpe: { from: 5, to: 9 },
        duration: { from: 60, to: 80 },
        recordedById: { from: PLAYER, to: COACH },
      },
      "RPE corrected by coach"
    );
  });

  test("las notas del body se ignoran", async () => {
    await call({ rpe: 8, duration: 70, notes: "x" });
    const arg = mockPrisma.rpeEntry.upsert.mock.calls[0][0];
    expect(arg.create).not.toHaveProperty("notes");
    expect(arg.update).not.toHaveProperty("notes");
  });

  test("sin sesión → 401", async () => {
    mockAuth.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
  });

  test("evento inexistente → 404", async () => {
    mockPrisma.event.findUnique.mockResolvedValue(null);
    expect((await call()).status).toBe(404);
  });

  test("quien llama no es coach del equipo (User.role COACH) → 403", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u9", role: "COACH" } });
    members({ u9: { isCoach: false }, [PLAYER]: { isCoach: false } });
    const res = await call();
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Se requiere rol de entrenador");
    expect(mockPrisma.rpeEntry.upsert).not.toHaveBeenCalled();
  });

  test("ex-coach (sin membresía activa) → 403", async () => {
    members({ [PLAYER]: { isCoach: false } });
    expect((await call()).status).toBe(403);
    expect(mockPrisma.rpeEntry.upsert).not.toHaveBeenCalled();
  });

  test("objetivo de otro equipo / ex-miembro → 403", async () => {
    members({ [COACH]: { isCoach: true } });
    expect((await call()).status).toBe(403);
    expect(mockPrisma.rpeEntry.upsert).not.toHaveBeenCalled();
  });

  test("objetivo que es coach del equipo → 403", async () => {
    members({ [COACH]: { isCoach: true }, [PLAYER]: { isCoach: true } });
    expect((await call()).status).toBe(403);
    expect(mockPrisma.rpeEntry.upsert).not.toHaveBeenCalled();
  });

  test("objetivo sin check-in → 409", async () => {
    mockPrisma.attendance.findFirst.mockResolvedValue({ checkedIn: false });
    const res = await call();
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("El jugador no está marcado como presente");
  });

  test("objetivo sin fila de asistencia → 409", async () => {
    mockPrisma.attendance.findFirst.mockResolvedValue(null);
    expect((await call()).status).toBe(409);
  });

  test("evento futuro → 400", async () => {
    mockPrisma.event.findUnique.mockResolvedValue({ id: "ev1", teamId: "team-1", startDate: new Date(Date.now() + 3600_000) });
    const res = await call();
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("El evento aún no ha comenzado");
    expect(mockPrisma.rpeEntry.upsert).not.toHaveBeenCalled();
  });

  test("body inválido → 422", async () => {
    expect((await call({ rpe: 11, duration: 70 })).status).toBe(422);
    expect((await call({ rpe: 5, duration: 0 })).status).toBe(422);
    expect((await call({})).status).toBe(422);
    expect(mockPrisma.rpeEntry.upsert).not.toHaveBeenCalled();
  });

  describe("DELETE", () => {
    const del = (userId = PLAYER) =>
      coachRpeDelete(new Request("http://localhost/api/events/ev1/rpe/" + userId, { method: "DELETE" }), {
        params: Promise.resolve({ id: "ev1", userId }),
      });

    test("borra el RPE → 200 { deleted: true } y lo registra", async () => {
      mockPrisma.rpeEntry.findUnique.mockResolvedValue({ rpe: 6, duration: 50, recordedById: PLAYER });
      mockPrisma.rpeEntry.delete.mockResolvedValue({});
      const res = await del();
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ deleted: true });
      expect(mockPrisma.rpeEntry.delete).toHaveBeenCalledWith({ where: { eventId_userId: { eventId: "ev1", userId: PLAYER } } });
      expect(info).toHaveBeenCalledWith(
        { eventId: "ev1", userId: PLAYER, rpe: 6, duration: 50, recordedById: PLAYER },
        "RPE deleted by coach"
      );
    });

    test("no exige check-in ni evento empezado", async () => {
      mockPrisma.attendance.findFirst.mockResolvedValue({ checkedIn: false });
      mockPrisma.event.findUnique.mockResolvedValue({ id: "ev1", teamId: "team-1", startDate: new Date(Date.now() + 3600_000) });
      mockPrisma.rpeEntry.findUnique.mockResolvedValue({ rpe: 6, duration: 50, recordedById: null });
      expect((await del()).status).toBe(200);
    });

    test("sin entrada → 404", async () => {
      expect((await del()).status).toBe(404);
      expect(mockPrisma.rpeEntry.delete).not.toHaveBeenCalled();
    });

    test("no coach del equipo → 403", async () => {
      members({ [COACH]: { isCoach: false }, [PLAYER]: { isCoach: false } });
      expect((await del()).status).toBe(403);
      expect(mockPrisma.rpeEntry.delete).not.toHaveBeenCalled();
    });

    test("objetivo de otro equipo → 403", async () => {
      members({ [COACH]: { isCoach: true } });
      expect((await del()).status).toBe(403);
      expect(mockPrisma.rpeEntry.delete).not.toHaveBeenCalled();
    });

    test("sin sesión → 401", async () => {
      mockAuth.mockResolvedValue(null);
      expect((await del()).status).toBe(401);
    });
  });
});
