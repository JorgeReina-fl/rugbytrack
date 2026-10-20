/**
 * @jest-environment node
 */

import { POST as embedRoute } from "@/app/api/players/embed/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateEmbedding } from "@/lib/gemini-embeddings";
import { NextRequest } from "next/server";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/rate-limit", () => ({ checkRateLimit: jest.fn().mockResolvedValue({ allowed: true, resetInSeconds: 0 }) }));
jest.mock("@/lib/attendance-taken", () => ({ takenEventIds: jest.fn().mockResolvedValue(new Set()) }));
jest.mock("@/lib/gemini-embeddings", () => ({
  generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2]),
  buildPlayerStatsText: jest.fn().mockReturnValue("stats"),
}));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    teamMember: { findFirst: jest.fn(), findMany: jest.fn() },
    event: { findMany: jest.fn() },
    $executeRaw: jest.fn(),
  },
}));

describe("POST /api/players/embed — permisos por equipo", () => {
  const mockAuth = auth as jest.Mock;
  const mockPrisma = prisma as any;
  const gemini = generateEmbedding as jest.Mock;
  const teamId = "cl00000000000000000000001";
  const userId = "cl00000000000000000000002";
  const req = (body: object) =>
    new NextRequest("http://localhost/api/players/embed", { method: "POST", body: JSON.stringify(body) });
  const member = { position: null, user: { id: userId, name: "J", rpeEntries: [], attendances: [] } };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.event.findMany.mockResolvedValue([]);
    mockPrisma.teamMember.findMany.mockResolvedValue([member]);
    mockPrisma.$executeRaw.mockResolvedValue(1);
  });

  test("coach activo del equipo (User.role PLAYER) → 200", async () => {
    mockAuth.mockResolvedValue({ user: { id: "coach1", role: "PLAYER" } });
    mockPrisma.teamMember.findFirst.mockResolvedValue({ isCoach: true });
    const res = await embedRoute(req({ teamId, userId }));
    expect(res.status).toBe(200);
    expect(gemini).toHaveBeenCalledTimes(1);
    expect(mockPrisma.teamMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "coach1", teamId, isCoach: true, leftAt: null } })
    );
  });

  test("User.role COACH pero no coach del equipo → 403 sin llamar a Gemini", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u2", role: "COACH" } });
    mockPrisma.teamMember.findFirst.mockResolvedValue(null);
    const res = await embedRoute(req({ teamId }));
    expect(res.status).toBe(403);
    expect(gemini).not.toHaveBeenCalled();
  });

  test("ex-coach (leftAt no nulo → sin fila activa) → 403", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u3", role: "COACH" } });
    mockPrisma.teamMember.findFirst.mockResolvedValue(null);
    expect((await embedRoute(req({ teamId, userId }))).status).toBe(403);
    expect(gemini).not.toHaveBeenCalled();
  });

  test("userId de otro equipo (no miembro activo) → 403 sin llamar a Gemini", async () => {
    mockAuth.mockResolvedValue({ user: { id: "coach1", role: "COACH" } });
    mockPrisma.teamMember.findFirst.mockResolvedValue({ isCoach: true });
    mockPrisma.teamMember.findMany.mockResolvedValue([]);
    const res = await embedRoute(req({ teamId, userId }));
    expect(res.status).toBe(403);
    expect(gemini).not.toHaveBeenCalled();
    expect(mockPrisma.teamMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { teamId, userId, leftAt: null } })
    );
  });

  test("sin sesión → 401", async () => {
    mockAuth.mockResolvedValue(null);
    expect((await embedRoute(req({ teamId }))).status).toBe(401);
  });
});
