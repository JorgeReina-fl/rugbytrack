/**
 * @jest-environment node
 */

import { POST as notifyRoute } from "@/app/api/events/[id]/notify/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendRsvpNotifications } from "@/lib/rsvp-notify";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/rsvp-notify", () => ({ sendRsvpNotifications: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findUnique: jest.fn() },
    teamMember: { findFirst: jest.fn() },
    attendance: { count: jest.fn() },
  },
}));

describe("POST /api/events/[id]/notify — permisos por equipo", () => {
  const mockAuth = auth as jest.Mock;
  const mockPrisma = prisma as any;
  const send = sendRsvpNotifications as jest.Mock;
  const call = () => notifyRoute(new Request("http://localhost/api/events/ev1/notify", { method: "POST" }), {
    params: Promise.resolve({ id: "ev1" }),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.event.findUnique.mockResolvedValue({ id: "ev1", teamId: "team-1" });
    mockPrisma.attendance.count.mockResolvedValue(3);
  });

  test("coach activo del equipo → 200 y envío (mockeado)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "PLAYER" } });
    mockPrisma.teamMember.findFirst.mockResolvedValue({ isCoach: true });
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 3 });
    expect(send).toHaveBeenCalledWith("ev1");
    expect(mockPrisma.teamMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { teamId: "team-1", userId: "u1", leftAt: null } })
    );
  });

  test("User.role COACH pero jugador en el equipo → 403 sin envío", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u2", role: "COACH" } });
    mockPrisma.teamMember.findFirst.mockResolvedValue({ isCoach: false });
    const res = await call();
    expect(res.status).toBe(403);
    expect(send).not.toHaveBeenCalled();
  });

  test("ex-miembro (sin membresía activa) → 403 sin envío", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u3", role: "COACH" } });
    mockPrisma.teamMember.findFirst.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(403);
    expect(send).not.toHaveBeenCalled();
  });

  test("sin sesión → 401", async () => {
    mockAuth.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });
});
