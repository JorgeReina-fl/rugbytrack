/**
 * @jest-environment node
 */

import { POST, GET, PUT, DELETE } from "@/app/api/internal/rpe-links-auto/route";
import { prisma } from "@/lib/prisma";
import { sendRpeLinks } from "@/lib/rpe-links";
import { logger } from "@/lib/logger";
import { signCronToken, generateRpeToken } from "@/lib/tokens";

jest.mock("@/lib/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock("@/lib/prisma", () => ({ prisma: { event: { findMany: jest.fn() } } }));
jest.mock("@/lib/rpe-links", () => ({ sendRpeLinks: jest.fn() }));

const db = prisma as any;
const send = sendRpeLinks as jest.Mock;
const H = 60 * 60 * 1000;
const SECRET = "test-secret-test-secret-test-secret-123";

const call = (authorization?: string) =>
  POST(new Request("http://localhost/api/internal/rpe-links-auto", { method: "POST", headers: authorization ? { authorization } : {} }));
const bearer = () => `Bearer ${signCronToken("rpe-links-auto")}`;

// Evento sin endDate que terminó hace `endedAgo` ms (fin = inicio + 3 h)
const ev = (id: string, endedAgo: number, over: Record<string, unknown> = {}) => ({
  id,
  startDate: new Date(Date.now() - endedAgo - 3 * H),
  endDate: null,
  ...over,
});

describe("POST /api/internal/rpe-links-auto", () => {
  const original = process.env.NEXTAUTH_SECRET;
  beforeAll(() => {
    process.env.NEXTAUTH_SECRET = SECRET;
  });
  afterAll(() => {
    process.env.NEXTAUTH_SECRET = original;
  });
  beforeEach(() => {
    jest.clearAllMocks();
    db.event.findMany.mockResolvedValue([]);
    send.mockResolvedValue({ code: "OK", sent: 2, failed: 1, skipped: 0 });
  });

  test("sin cabecera, Bearer basura, token rpe o cron caducado → 404 JSON sin tocar BD", async () => {
    const rpe = generateRpeToken("cron", "rpe-links-auto", new Date(Date.now() + H));
    jest.useFakeTimers().setSystemTime(Date.now() - H);
    const expired = signCronToken("rpe-links-auto");
    jest.useRealTimers();
    for (const h of [undefined, "Bearer basura", "Basic abc", `Bearer ${rpe}`, `Bearer ${expired}`, `Bearer ${signCronToken("otro")}`]) {
      const res = await call(h);
      expect(res.status).toBe(404);
      expect(res.headers.get("content-type")).toContain("application/json");
      expect(await res.json()).toEqual({ error: "NOT_FOUND" });
    }
    expect(db.event.findMany).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  test("válido → 200 con recuentos y códigos agregados", async () => {
    db.event.findMany.mockResolvedValue([ev("a", 30 * 60 * 1000), ev("b", 60 * 60 * 1000)]);
    send.mockResolvedValueOnce({ code: "OK", sent: 2, failed: 1, skipped: 0 }).mockResolvedValueOnce({ code: "SKIPPED" });
    const res = await call(bearer());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: { events: 2, sent: 2, failed: 1, skipped: 0, codes: { OK: 1, SKIPPED: 1 } },
    });
    expect(send).toHaveBeenCalledWith("a", { trigger: "auto", now: expect.any(Date) });
  });

  test("consulta: sin enviar, equipo con auto, ventana [ahora−2h, ahora] por endDate o inicio+3h, antiguos primero, máx 25", async () => {
    await call(bearer());
    const arg = db.event.findMany.mock.calls[0][0];
    expect(arg.where.rpeLinksSentAt).toBeNull();
    expect(arg.where.team).toEqual({ rpeLinksAuto: true });
    expect(arg.where.OR).toHaveLength(2);
    expect(arg.orderBy).toEqual({ startDate: "asc" });
    expect(arg.take).toBe(25);
  });

  test("selección final con eventEnd: entra el terminado hace 30 min; fuera hace 3 h y el no terminado", async () => {
    db.event.findMany.mockResolvedValue([
      ev("dentro", 30 * 60 * 1000),
      ev("hace3h", 3 * H),
      ev("sinTerminar", -1 * H), // termina dentro de 1 h
      ev("conEndDate", 0, { startDate: new Date(Date.now() - 6 * H), endDate: new Date(Date.now() - 20 * 60 * 1000) }),
    ]);
    const res = await call(bearer());
    expect((await res.json()).data.events).toBe(2);
    expect(send.mock.calls.map((c) => c[0])).toEqual(["dentro", "conEndDate"]);
  });

  test("rpeLinksSentAt y rpeLinksAuto=false se excluyen en BD (el filtro lo lleva el where)", async () => {
    // La BD ya no los devuelve; sendRpeLinks además los devuelve como SKIPPED si llegaran
    db.event.findMany.mockResolvedValue([ev("x", 30 * 60 * 1000)]);
    send.mockResolvedValue({ code: "SKIPPED" });
    const res = await call(bearer());
    expect((await res.json()).data).toMatchObject({ events: 1, sent: 0, codes: { SKIPPED: 1 } });
  });

  test("30 candidatos → procesa 25, en serie", async () => {
    db.event.findMany.mockResolvedValue(Array.from({ length: 30 }, (_, i) => ev(`e${i}`, 30 * 60 * 1000)));
    let running = 0;
    let maxRunning = 0;
    send.mockImplementation(async () => {
      maxRunning = Math.max(maxRunning, ++running);
      await new Promise((r) => setImmediate(r));
      running--;
      return { code: "OK", sent: 1, failed: 0, skipped: 0 };
    });
    const res = await call(bearer());
    expect((await res.json()).data).toMatchObject({ events: 25, sent: 25 });
    expect(send).toHaveBeenCalledTimes(25);
    expect(maxRunning).toBe(1);
  });

  test("un evento que lanza no aborta el resto: code ERROR", async () => {
    db.event.findMany.mockResolvedValue([ev("a", 30 * 60 * 1000), ev("b", 30 * 60 * 1000)]);
    send.mockRejectedValueOnce(new Error("boom jugador@example.test")).mockResolvedValueOnce({ code: "OK", sent: 1, failed: 0, skipped: 0 });
    const res = await call(bearer());
    expect((await res.json()).data).toMatchObject({ events: 2, sent: 1, codes: { ERROR: 1, OK: 1 } });
    expect(JSON.stringify((logger.error as jest.Mock).mock.calls)).not.toContain("jugador@example.test");
  });

  test("error de BD → 500 JSON INTERNAL", async () => {
    db.event.findMany.mockRejectedValue(new Error("db"));
    const res = await call(bearer());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "INTERNAL" });
  });

  test("GET / PUT / DELETE → 405 JSON", async () => {
    for (const h of [GET, PUT, DELETE]) {
      const res = await h();
      expect(res.status).toBe(405);
      expect(res.headers.get("allow")).toBe("POST");
    }
  });

  test("logs sin token", async () => {
    const auth = bearer();
    db.event.findMany.mockResolvedValue([ev("a", 30 * 60 * 1000)]);
    await call(auth);
    await call("Bearer basura");
    const lines = JSON.stringify(
      [logger.info, logger.warn, logger.error].flatMap((fn) => (fn as jest.Mock).mock.calls)
    );
    expect(lines).toContain("rpe-links-auto done");
    expect(lines).not.toContain(auth.slice(7, 27));
    expect(lines).not.toContain("basura");
    expect(lines).not.toContain("Bearer");
  });
});
