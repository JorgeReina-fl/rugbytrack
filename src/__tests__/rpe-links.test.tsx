/**
 * @jest-environment node
 */

import { renderToStaticMarkup } from "react-dom/server";
import { sendRpeLinks, RPE_LINKS_MIN_INTERVAL_MS } from "@/lib/rpe-links";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/resend";
import { trackEmailBudget } from "@/lib/email-budget";
import { logger } from "@/lib/logger";
import { verifyRpeToken } from "@/lib/tokens";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findUnique: jest.fn(), updateMany: jest.fn() },
    attendance: { findMany: jest.fn() },
  },
}));
jest.mock("@/lib/resend", () => ({ sendEmail: jest.fn() }));
jest.mock("@/lib/email-budget", () => ({ trackEmailBudget: jest.fn() }));
jest.mock("@/lib/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const db = prisma as any;
const send = sendEmail as jest.Mock;
const budget = trackEmailBudget as jest.Mock;

const H = 60 * 60 * 1000;
const SECRET = "test-secret-test-secret-test-secret-123";
const NOW = new Date("2026-10-27T12:00:00Z");
// Entreno que empezó hace 5 h y acabó hace 2 h (sin endDate: +3 h) → cierra en 46 h
const START = new Date(NOW.getTime() - 5 * H);
const CLOSES_AT = new Date(START.getTime() + 3 * H + 48 * H);

const event = (over: Record<string, unknown> = {}) => ({
  id: "e1",
  teamId: "t1",
  title: "Entreno de martes",
  type: "TRAINING",
  startDate: START,
  endDate: null,
  rpeLinksSentAt: null,
  team: { timezone: "America/Argentina/Buenos_Aires", rpeLinksAuto: true },
  ...over,
});
const player = (n: number) => ({ user: { id: `user-${n}`, email: `p${n}@example.test`, name: `Jugador ${n}` } });

describe("sendRpeLinks", () => {
  const originalSecret = process.env.NEXTAUTH_SECRET;
  const originalUrl = process.env.NEXT_PUBLIC_APP_URL;
  beforeAll(() => {
    process.env.NEXTAUTH_SECRET = SECRET;
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.test";
  });
  afterAll(() => {
    process.env.NEXTAUTH_SECRET = originalSecret;
    process.env.NEXT_PUBLIC_APP_URL = originalUrl;
  });
  beforeEach(() => {
    jest.clearAllMocks();
    db.event.findUnique.mockResolvedValue(event());
    db.event.updateMany.mockResolvedValue({ count: 1 });
    db.attendance.findMany.mockResolvedValue([player(1), player(2)]);
    budget.mockResolvedValue(true);
    send.mockResolvedValue({ data: { id: "m" } });
  });

  const manual = () => sendRpeLinks("e1", { trigger: "manual", now: NOW });
  const auto = () => sendRpeLinks("e1", { trigger: "auto", now: NOW });

  test("a) destinatarios: consulta solo activos no coach con check-in y sin RPE", async () => {
    const res = await manual();
    expect(res).toEqual({ code: "OK", sent: 2, failed: 0, skipped: 0 });
    expect(db.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          eventId: "e1",
          checkedIn: true,
          user: {
            memberships: { some: { teamId: "t1", leftAt: null, isCoach: false } },
            rpeEntries: { none: { eventId: "e1" } },
          },
        },
      })
    );
    expect(send.mock.calls.map((c) => c[0].to)).toEqual(["p1@example.test", "p2@example.test"]);
  });

  test("b) NOT_ENDED y WINDOW_CLOSED no marcan ni envían", async () => {
    db.event.findUnique.mockResolvedValue(event({ startDate: new Date(NOW.getTime() - 1 * H) }));
    expect(await manual()).toEqual({ code: "NOT_ENDED" });
    db.event.findUnique.mockResolvedValue(event({ startDate: new Date(NOW.getTime() - 60 * H) }));
    expect(await manual()).toEqual({ code: "WINDOW_CLOSED" });
    expect(db.event.updateMany).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  test("b) TOO_SOON con retryAt = último envío + 30 min", async () => {
    const last = new Date(NOW.getTime() - 10 * 60 * 1000);
    db.event.findUnique.mockResolvedValue(event({ rpeLinksSentAt: last }));
    db.event.updateMany.mockResolvedValue({ count: 0 });
    const res = await manual();
    expect(res).toEqual({ code: "TOO_SOON", retryAt: new Date(last.getTime() + RPE_LINKS_MIN_INTERVAL_MS) });
    expect(send).not.toHaveBeenCalled();
    // el filtro atómico: nulo o anterior a now − 30 min
    expect(db.event.updateMany.mock.calls[0][0]).toEqual({
      where: {
        id: "e1",
        OR: [{ rpeLinksSentAt: null }, { rpeLinksSentAt: { lt: new Date(NOW.getTime() - RPE_LINKS_MIN_INTERVAL_MS) } }],
      },
      data: { rpeLinksSentAt: NOW },
    });
  });

  test("b) dos llamadas casi simultáneas: solo una envía", async () => {
    db.event.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const [r1, r2] = await Promise.all([manual(), manual()]);
    expect([r1.code, r2.code].sort()).toEqual(["OK", "TOO_SOON"]);
    expect(send).toHaveBeenCalledTimes(2); // los 2 jugadores, una sola vez
  });

  test("c) auto: SKIPPED si rpeLinksAuto=false o ya enviado; envía si null y auto", async () => {
    db.event.findUnique.mockResolvedValue(event({ team: { timezone: "Europe/Madrid", rpeLinksAuto: false } }));
    expect(await auto()).toEqual({ code: "SKIPPED" });
    db.event.findUnique.mockResolvedValue(event({ rpeLinksSentAt: new Date(NOW.getTime() - 5 * H) }));
    expect(await auto()).toEqual({ code: "SKIPPED" });
    expect(db.event.updateMany).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();

    db.event.findUnique.mockResolvedValue(event());
    expect(await auto()).toMatchObject({ code: "OK", sent: 2 });
    expect(db.event.updateMany.mock.calls[0][0].where).toEqual({ id: "e1", rpeLinksSentAt: null });
  });

  test("c) auto que pierde la carrera (count 0) → SKIPPED", async () => {
    db.event.updateMany.mockResolvedValue({ count: 0 });
    expect(await auto()).toEqual({ code: "SKIPPED" });
    expect(send).not.toHaveBeenCalled();
  });

  test("d) sent=0 y failed>0 → rpeLinksSentAt restaurado a su valor anterior", async () => {
    const previous = new Date(NOW.getTime() - 2 * 24 * H);
    db.event.findUnique.mockResolvedValue(event({ rpeLinksSentAt: previous }));
    send.mockResolvedValue(null);
    const res = await manual();
    expect(res).toEqual({ code: "OK", sent: 0, failed: 2, skipped: 0 });
    expect(db.event.updateMany).toHaveBeenLastCalledWith({
      where: { id: "e1", rpeLinksSentAt: NOW },
      data: { rpeLinksSentAt: previous },
    });
  });

  test("d) restaura a null si antes era null, y no restaura si algo salió", async () => {
    send.mockResolvedValue(null);
    await manual();
    expect(db.event.updateMany).toHaveBeenLastCalledWith({
      where: { id: "e1", rpeLinksSentAt: NOW },
      data: { rpeLinksSentAt: null },
    });

    jest.clearAllMocks();
    db.event.updateMany.mockResolvedValue({ count: 1 });
    budget.mockResolvedValue(true);
    send.mockResolvedValueOnce({ data: { id: "m" } }).mockResolvedValueOnce(null);
    expect(await manual()).toMatchObject({ sent: 1, failed: 1 });
    expect(db.event.updateMany).toHaveBeenCalledTimes(1); // solo el marcado
  });

  test("e) cupo agotado → skipped, sin llamadas a sendEmail, y se libera el marcado", async () => {
    budget.mockResolvedValue(false);
    const res = await manual();
    expect(res).toEqual({ code: "OK", sent: 0, failed: 0, skipped: 2 });
    expect(send).not.toHaveBeenCalled();
    expect(budget).toHaveBeenCalledWith(1, "LOW", "rpe-links");
    expect(db.event.updateMany).toHaveBeenLastCalledWith({
      where: { id: "e1", rpeLinksSentAt: NOW },
      data: { rpeLinksSentAt: null },
    });
  });

  test("e) jugador sin email → skipped", async () => {
    db.attendance.findMany.mockResolvedValue([player(1), { user: { id: "user-9", email: "", name: "X" } }]);
    expect(await manual()).toEqual({ code: "OK", sent: 1, failed: 0, skipped: 1 });
  });

  test("f) asunto, cuerpo y enlace: título, fecha en la zona del equipo, /rpe/<token> válido y fecha límite", async () => {
    db.attendance.findMany.mockResolvedValue([player(1), player(2)]);
    await manual();
    const first = send.mock.calls[0][0];
    expect(first.subject).toBe("Registra tu RPE: Entreno de martes");

    // @react-email/render usa import() dinámico, que Jest no soporta: basta el HTML estático del árbol
    const html = renderToStaticMarkup(first.react);
    expect(html).toContain("Entreno de martes");
    expect(html).toContain("Entrenamiento");
    expect(html).toContain("Registrar mi RPE");
    // Inicio 07:00 UTC = 04:00 en Buenos Aires (UTC−3); cierre = fin + 48 h = 29 oct 10:00 UTC = 07:00 allí
    expect(html).toContain("27 de octubre de 2026");
    expect(html).toContain("04:00");
    expect(html).toContain("Disponible hasta el");
    expect(html).toContain("29 de octubre a las 07:00 hs");

    const link = (html.match(/https:\/\/app\.example\.test\/rpe\/([A-Za-z0-9_-]+)/) ?? [])[1]!;
    expect(link).toBeTruthy();
    expect(verifyRpeToken(link)).toEqual({
      userId: "user-1",
      eventId: "e1",
      exp: CLOSES_AT.getTime(),
      p: "rpe",
    });

    // Sin otros jugadores ni opción de baja
    expect(html).not.toContain("Jugador 2");
    expect(html).not.toContain("p2@example.test");
    expect(html.toLowerCase()).not.toMatch(/baja|unsubscribe|darte de baja/);
  });

  test("h) logs: solo eventId, trigger, code y recuentos; nunca email, nombre, userId, token ni URL", async () => {
    send.mockResolvedValueOnce({ data: { id: "m" } }).mockResolvedValueOnce(null);
    await manual();
    db.event.findUnique.mockResolvedValue(event({ rpeLinksSentAt: new Date(NOW.getTime() - 60_000) }));
    db.event.updateMany.mockResolvedValue({ count: 0 });
    await manual();
    await auto();

    const lines = JSON.stringify(
      [logger.info, logger.warn, logger.error].flatMap((fn) => (fn as jest.Mock).mock.calls)
    );
    expect(lines).toContain("e1");
    for (const secret of ["example.test", "Jugador", "user-1", "user-2", "/rpe/", "http", "eyJ"]) {
      expect(lines).not.toContain(secret);
    }
  });
});
