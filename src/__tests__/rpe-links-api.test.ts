/**
 * @jest-environment node
 */

import { POST } from "@/app/api/events/[id]/rpe-links/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendRpeLinks } from "@/lib/rpe-links";
import { logger } from "@/lib/logger";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock("@/lib/prisma", () => ({
  prisma: { event: { findUnique: jest.fn() }, teamMember: { findFirst: jest.fn() } },
}));
jest.mock("@/lib/rpe-links", () => ({ sendRpeLinks: jest.fn() }));

const db = prisma as any;
const send = sendRpeLinks as jest.Mock;
const mockAuth = auth as jest.Mock;

const call = () =>
  POST(new Request("http://localhost/api/events/ev1/rpe-links", { method: "POST" }), {
    params: Promise.resolve({ id: "ev1" }),
  });

describe("POST /api/events/[id]/rpe-links", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "coach-1", role: "PLAYER" } });
    db.event.findUnique.mockResolvedValue({ teamId: "t1" });
    db.teamMember.findFirst.mockResolvedValue({ isCoach: true });
    send.mockResolvedValue({ code: "OK", sent: 3, failed: 1, skipped: 2 });
  });

  test("sin sesión → 401 y no envía", async () => {
    mockAuth.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });

  test("evento inexistente → 404", async () => {
    db.event.findUnique.mockResolvedValue(null);
    expect((await call()).status).toBe(404);
  });

  test("no miembro y ex-miembro → 404 (misma respuesta)", async () => {
    db.teamMember.findFirst.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(404);
    expect(db.teamMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { teamId: "t1", userId: "coach-1", leftAt: null } })
    );
    expect(send).not.toHaveBeenCalled();
  });

  test("jugador no coach → 403", async () => {
    db.teamMember.findFirst.mockResolvedValue({ isCoach: false });
    expect((await call()).status).toBe(403);
    expect(send).not.toHaveBeenCalled();
  });

  test("coach → 200 { data: { sent, failed, skipped } } con trigger manual", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { sent: 3, failed: 1, skipped: 2 } });
    expect(send).toHaveBeenCalledWith("ev1", { trigger: "manual", now: expect.any(Date) });
  });

  test.each(["NOT_ENDED", "WINDOW_CLOSED"])("%s → 409", async (code) => {
    send.mockResolvedValue({ code });
    const res = await call();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: code });
  });

  test("TOO_SOON → 429 con retryAt", async () => {
    const retryAt = new Date("2026-10-27T12:30:00Z");
    send.mockResolvedValue({ code: "TOO_SOON", retryAt });
    const res = await call();
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "TOO_SOON", retryAt: retryAt.toISOString() });
  });

  test("excepción → 500 JSON y el log solo lleva errInfo", async () => {
    send.mockRejectedValue(Object.assign(new Error("boom con jugador.secreto@example.test"), { code: "X" }));
    const res = await call();
    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect((await res.json()).error).toBeDefined();
    const logged = JSON.stringify((logger.error as jest.Mock).mock.calls);
    expect(logged).not.toContain("jugador.secreto");
    expect(logged).toContain('"code":"X"');
  });
});
