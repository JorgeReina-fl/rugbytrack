/**
 * @jest-environment node
 */

import { createHash } from "crypto";
import { POST, GET, PUT, DELETE } from "@/app/api/rpe/link/route";
import { POST as appPost } from "@/app/api/rpe/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { generateRpeToken, generateRsvpToken } from "@/lib/tokens";
import { NextRequest } from "next/server";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock("@/lib/rate-limit", () => ({ checkRateLimit: jest.fn() }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findUnique: jest.fn() },
    teamMember: { findFirst: jest.fn() },
    rpeEntry: { create: jest.fn(), findUnique: jest.fn() },
  },
}));

const SECRET = "test-secret-test-secret-test-secret-123";
const H = 60 * 60 * 1000;
const USER = "user-secret-id-777";
const EVENT = "cl00000000000000000000000";
const db = prisma as any;
const rate = checkRateLimit as jest.Mock;

// Empezó hace 2 h, sin endDate → cierra a +51 h desde el inicio
const event = (over: Record<string, unknown> = {}) => ({
  id: EVENT,
  teamId: "team-1",
  startDate: new Date(Date.now() - 2 * H),
  attendances: [{ userId: USER, status: "CONFIRMED", checkedIn: true }],
  _count: { attendances: 1 },
  ...over,
});
const goodToken = () => generateRpeToken(USER, EVENT, new Date(Date.now() + 40 * H));

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request("http://localhost/api/rpe/link", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
const input = { rpe: 8, duration: 80 };

describe("POST /api/rpe/link", () => {
  const original = process.env.NEXTAUTH_SECRET;
  beforeAll(() => {
    process.env.NEXTAUTH_SECRET = SECRET;
  });
  afterAll(() => {
    process.env.NEXTAUTH_SECRET = original;
  });
  beforeEach(() => {
    jest.clearAllMocks();
    rate.mockResolvedValue({ allowed: true, remaining: 1, resetInSeconds: 60 });
    db.event.findUnique.mockResolvedValue(event());
    db.teamMember.findFirst.mockResolvedValue({ isCoach: false });
    db.rpeEntry.findUnique.mockResolvedValue(null);
    db.rpeEntry.create.mockImplementation(({ data }: any) => Promise.resolve({ id: "rpe-1", ...data }));
  });

  const expectCode = async (res: Response, status: number, error: string) => {
    expect(res.status).toBe(status);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ error });
  };

  test("ok → 201 y no-store", async () => {
    const res = await post({ token: goodToken(), ...input });
    expect(res.status).toBe(201);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(db.rpeEntry.create).toHaveBeenCalledTimes(1);
  });

  test("token inválido / basura / caducado → 400 INVALID_LINK", async () => {
    await expectCode(await post({ token: "basura", ...input }), 400, "INVALID_LINK");
    const expired = (() => {
      jest.useFakeTimers().setSystemTime(Date.now() - 100 * H);
      const t = generateRpeToken(USER, EVENT, new Date(Date.now() + H));
      jest.useRealTimers();
      return t;
    })();
    await expectCode(await post({ token: expired, ...input }), 400, "INVALID_LINK");
    expect(db.rpeEntry.create).not.toHaveBeenCalled();
  });

  test("token rsvp válido → INVALID_LINK", async () => {
    await expectCode(await post({ token: generateRsvpToken(USER, EVENT), ...input }), 400, "INVALID_LINK");
  });

  test("evento inexistente → INVALID_LINK", async () => {
    db.event.findUnique.mockResolvedValue(null);
    await expectCode(await post({ token: goodToken(), ...input }), 400, "INVALID_LINK");
  });

  test("ex-miembro o de otro equipo → INVALID_LINK", async () => {
    db.teamMember.findFirst.mockResolvedValue(null);
    await expectCode(await post({ token: goodToken(), ...input }), 400, "INVALID_LINK");
  });

  test("coach → INVALID_LINK", async () => {
    db.teamMember.findFirst.mockResolvedValue({ isCoach: true });
    await expectCode(await post({ token: goodToken(), ...input }), 400, "INVALID_LINK");
  });

  test("confirmado sin check-in → 403 NOT_CHECKED_IN", async () => {
    db.event.findUnique.mockResolvedValue(
      event({ attendances: [{ userId: USER, status: "CONFIRMED", checkedIn: false }], _count: { attendances: 0 } })
    );
    await expectCode(await post({ token: goodToken(), ...input }), 403, "NOT_CHECKED_IN");
    expect(db.rpeEntry.create).not.toHaveBeenCalled();
  });

  test("plazo cerrado → 403 RPE_WINDOW_CLOSED", async () => {
    db.event.findUnique.mockResolvedValue(event({ startDate: new Date(Date.now() - 60 * H) }));
    await expectCode(await post({ token: goodToken(), ...input }), 403, "RPE_WINDOW_CLOSED");
  });

  test("ya existe → 409 ALREADY_RECORDED (también fuera de plazo)", async () => {
    db.rpeEntry.findUnique.mockResolvedValue({ id: "x" });
    await expectCode(await post({ token: goodToken(), ...input }), 409, "ALREADY_RECORDED");
    db.event.findUnique.mockResolvedValue(event({ startDate: new Date(Date.now() - 60 * H) }));
    await expectCode(await post({ token: goodToken(), ...input }), 409, "ALREADY_RECORDED");
  });

  test("carrera en BD (P2002) → 409 ALREADY_RECORDED", async () => {
    db.rpeEntry.create.mockRejectedValue({ code: "P2002" });
    await expectCode(await post({ token: goodToken(), ...input }), 409, "ALREADY_RECORDED");
  });

  test("input inválido → 400 Datos inválidos", async () => {
    await expectCode(await post({ token: goodToken(), rpe: 11, duration: 80 }), 400, "Datos inválidos");
    await expectCode(await post({ token: goodToken(), rpe: 5 }), 400, "Datos inválidos");
    expect(db.rpeEntry.create).not.toHaveBeenCalled();
  });

  test("body no JSON o sin token → 400 JSON", async () => {
    await expectCode(await post("no-json"), 400, "INVALID_REQUEST");
    await expectCode(await post({ ...input }), 400, "INVALID_REQUEST");
  });

  test("429 por IP", async () => {
    rate.mockResolvedValueOnce({ allowed: false, remaining: 0, resetInSeconds: 60 });
    await expectCode(await post({ token: goodToken(), ...input }, { "x-real-ip": "1.2.3.4" }), 429, "TOO_MANY_REQUESTS");
    expect(rate.mock.calls[0][0]).toBe("rpe-link:ip:1.2.3.4");
    expect(rate.mock.calls[0].slice(1)).toEqual([20, 600]);
  });

  test("429 por token, con clave sha256 y sin el token en claro", async () => {
    const token = goodToken();
    rate.mockResolvedValueOnce({ allowed: true, remaining: 1, resetInSeconds: 60 });
    rate.mockResolvedValueOnce({ allowed: false, remaining: 0, resetInSeconds: 60 });
    await expectCode(await post({ token, ...input }), 429, "TOO_MANY_REQUESTS");
    const key = rate.mock.calls[1][0] as string;
    expect(key).toBe(`rpe-link:token:${createHash("sha256").update(token).digest("hex")}`);
    expect(key).not.toContain(token);
    expect(rate.mock.calls[1].slice(1)).toEqual([10, 600]);
    expect(db.rpeEntry.create).not.toHaveBeenCalled();
  });

  test("GET / PUT / DELETE → 405 JSON", async () => {
    for (const h of [GET, PUT, DELETE]) {
      const res = await h();
      await expectCode(res, 405, "METHOD_NOT_ALLOWED");
      expect(res.headers.get("allow")).toBe("POST");
    }
  });

  test("excepción interna → 500 JSON INTERNAL", async () => {
    db.event.findUnique.mockRejectedValue(new Error("boom con datos sensibles"));
    const res = await post({ token: goodToken(), ...input });
    await expectCode(res, 500, "INTERNAL");
  });

  test("c) el RpeEntry del enlace lleva recordedById = userId y el mismo workload que por la app", async () => {
    await post({ token: goodToken(), rpe: 8, duration: 80, notes: "ok" });
    const linkData = db.rpeEntry.create.mock.calls[0][0].data;
    expect(linkData).toMatchObject({ userId: USER, recordedById: USER, workload: 640, eventId: EVENT });

    jest.clearAllMocks();
    db.event.findUnique.mockResolvedValue(event());
    db.teamMember.findFirst.mockResolvedValue({ isCoach: false });
    db.rpeEntry.findUnique.mockResolvedValue(null);
    db.rpeEntry.create.mockImplementation(({ data }: any) => Promise.resolve({ id: "rpe-2", ...data }));
    (auth as jest.Mock).mockResolvedValue({ user: { id: USER, role: "PLAYER" } });
    await appPost(
      new NextRequest("http://localhost/api/rpe", {
        method: "POST",
        body: JSON.stringify({ eventId: EVENT, rpe: 8, duration: 80, notes: "ok" }),
      })
    );
    const appData = db.rpeEntry.create.mock.calls[0][0].data;
    expect(appData).toEqual(linkData);
  });

  test("f) los logs nunca contienen el token ni el userId", async () => {
    const token = goodToken();
    const scenarios = [
      () => post({ token, ...input }),
      () => post({ token, rpe: 99, duration: 1 }),
      () => {
        db.teamMember.findFirst.mockResolvedValueOnce(null);
        return post({ token, ...input });
      },
      () => {
        db.rpeEntry.findUnique.mockResolvedValueOnce({ id: "x" });
        return post({ token, ...input });
      },
      () => {
        db.event.findUnique.mockRejectedValueOnce(Object.assign(new Error(`fallo ${USER} ${token}`), { code: "X" }));
        return post({ token, ...input });
      },
    ];
    for (const run of scenarios) await run();

    const lines = JSON.stringify(
      [logger.info, logger.warn, logger.error].flatMap((fn) => (fn as jest.Mock).mock.calls)
    );
    expect(lines.length).toBeGreaterThan(10);
    expect(lines).not.toContain(token);
    expect(lines).not.toContain(token.slice(0, 20));
    expect(lines).not.toContain(USER);
    expect(lines).not.toContain("fallo");
  });
});
