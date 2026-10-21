/**
 * @jest-environment node
 */

import { renderToStaticMarkup } from "react-dom/server";
import { POST as consentPost, DELETE as consentDelete } from "@/app/api/me/health-consent/route";
import { POST as createRoute, GET as listRoute } from "@/app/api/events/[id]/discomforts/route";
import { POST as seenRoute } from "@/app/api/events/[id]/discomforts/seen/route";
import { DELETE as deleteRoute } from "@/app/api/discomforts/[id]/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/resend";
import { checkRateLimit } from "@/lib/rate-limit";
import { trackEmailBudget } from "@/lib/email-budget";
import { logger } from "@/lib/logger";
import { HEALTH_CONSENT_VERSION } from "@/lib/health-consent";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock("@/lib/resend", () => ({ sendEmail: jest.fn().mockResolvedValue({ id: "mock" }) }));
jest.mock("@/lib/rate-limit", () => ({ checkRateLimit: jest.fn() }));
jest.mock("@/lib/email-budget", () => ({ trackEmailBudget: jest.fn() }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findUnique: jest.fn() },
    teamMember: { findFirst: jest.fn(), findMany: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn() },
    discomfort: {
      count: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

const mockAuth = auth as jest.Mock;
const db = prisma as any;
const email = sendEmail as jest.Mock;

const PLAYER = "player-1";
const COACH1 = "coach-1";
const COACH2 = "coach-2";
const OTHER = "player-2";
const PARAMS = { params: Promise.resolve({ id: "ev1" }) };
const NOTE = "me duele mucho al correr";

const consentOk = { healthConsentAt: new Date(), healthConsentVersion: HEALTH_CONSENT_VERSION };
const future = () => new Date(Date.now() + 60 * 60 * 1000);
const post = (body: unknown) =>
  createRoute(new Request("http://localhost/api/events/ev1/discomforts", { method: "POST", body: JSON.stringify(body) }), PARAMS);
const valid = { bodyArea: "KNEE", intensity: 7, note: NOTE };

// getActiveMembership(teamId, userId) → teamMember.findFirst({ where: { teamId, userId, leftAt: null } })
const members = (map: Record<string, { isCoach: boolean } | null>) =>
  db.teamMember.findFirst.mockImplementation(({ where }: any) => Promise.resolve(map[where.userId] ?? null));

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: PLAYER } });
  db.event.findUnique.mockResolvedValue({
    id: "ev1",
    teamId: "team-1",
    title: "Entreno martes",
    startDate: new Date(Date.now() - 60 * 60 * 1000),
    endDate: future(),
  });
  members({ [PLAYER]: { isCoach: false }, [COACH1]: { isCoach: true }, [COACH2]: { isCoach: true } });
  db.user.findUnique.mockResolvedValue(consentOk);
  (checkRateLimit as jest.Mock).mockResolvedValue({ allowed: true, remaining: 9, resetInSeconds: 3600 });
  (trackEmailBudget as jest.Mock).mockResolvedValue(true);
  db.discomfort.count.mockResolvedValue(0);
  db.discomfort.create.mockImplementation(({ data }: any) =>
    Promise.resolve({ id: "d1", ...data, seenByCoachAt: null, createdAt: new Date() })
  );
  db.teamMember.findMany.mockResolvedValue([{ user: { email: "c1@x.test" } }, { user: { email: "c2@x.test" } }]);
  db.$transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
});

describe("consentimiento de datos de salud", () => {
  test("dar consentimiento guarda fecha y versión vigente", async () => {
    db.user.update.mockResolvedValue({});
    const res = await consentPost();
    expect(res.status).toBe(200);
    const arg = db.user.update.mock.calls[0][0];
    expect(arg.where).toEqual({ id: PLAYER });
    expect(arg.data.healthConsentAt).toBeInstanceOf(Date);
    expect(arg.data.healthConsentVersion).toBe(HEALTH_CONSENT_VERSION);
  });

  test("retirar borra todas sus molestias, limpia los campos y devuelve la cuenta", async () => {
    db.discomfort.deleteMany.mockResolvedValue({ count: 3 });
    db.user.update.mockResolvedValue({});
    const res = await consentDelete();
    expect(await res.json()).toEqual({ deleted: 3 });
    expect(db.discomfort.deleteMany).toHaveBeenCalledWith({ where: { userId: PLAYER } });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: PLAYER },
      data: { healthConsentAt: null, healthConsentVersion: null },
    });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  test("sin sesión → 401", async () => {
    mockAuth.mockResolvedValue(null);
    expect((await consentPost()).status).toBe(401);
    expect((await consentDelete()).status).toBe(401);
  });
});

describe("POST /api/events/[id]/discomforts", () => {
  test("sin consentimiento → 403 CONSENT_REQUIRED", async () => {
    db.user.findUnique.mockResolvedValue({ healthConsentAt: null, healthConsentVersion: null });
    const res = await post(valid);
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("CONSENT_REQUIRED");
    expect(db.discomfort.create).not.toHaveBeenCalled();
  });

  test("consentimiento de una versión antigua → 403 CONSENT_REQUIRED", async () => {
    db.user.findUnique.mockResolvedValue({ healthConsentAt: new Date(), healthConsentVersion: "2020-01-01" });
    const res = await post(valid);
    expect((await res.json()).code).toBe("CONSENT_REQUIRED");
  });

  test("un coach no puede crear → 403", async () => {
    mockAuth.mockResolvedValue({ user: { id: COACH1 } });
    expect((await post(valid)).status).toBe(403);
    expect(db.discomfort.create).not.toHaveBeenCalled();
  });

  test("ex-miembro o ajeno al equipo → 403", async () => {
    mockAuth.mockResolvedValue({ user: { id: OTHER } });
    expect((await post(valid)).status).toBe(403);
  });

  test("evento terminado → 409", async () => {
    db.event.findUnique.mockResolvedValue({
      id: "ev1",
      teamId: "team-1",
      title: "Entreno martes",
      startDate: new Date(Date.now() - 5 * 60 * 60 * 1000),
      endDate: new Date(Date.now() - 60 * 60 * 1000),
    });
    const res = await post(valid);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("El evento ya ha terminado");
  });

  test.each([
    ["intensity 11", { ...valid, intensity: 11 }],
    ["intensity -1", { ...valid, intensity: -1 }],
    ["intensity decimal", { ...valid, intensity: 3.5 }],
    ["nota de 281", { ...valid, note: "a".repeat(281) }],
    ["zona inválida", { ...valid, bodyArea: "ZZTOP" }],
  ])("validación: %s → 422 sin eco de los valores", async (_n, body) => {
    const res = await post(body);
    expect(res.status).toBe(422);
    expect(JSON.stringify(await res.json())).not.toContain("ZZTOP");
    expect(db.discomfort.create).not.toHaveBeenCalled();
  });

  test("nota vacía o en blanco → null; la nota se recorta", async () => {
    await post({ ...valid, note: "   " });
    expect(db.discomfort.create.mock.calls[0][0].data.note).toBeNull();
    await post({ ...valid, note: "  hola  " });
    expect(db.discomfort.create.mock.calls[1][0].data.note).toBe("hola");
  });

  test("rate limit: 10/h con clave por userId → 429", async () => {
    (checkRateLimit as jest.Mock).mockResolvedValue({ allowed: false, remaining: 0, resetInSeconds: 100 });
    const res = await post(valid);
    expect(res.status).toBe(429);
    expect(checkRateLimit).toHaveBeenCalledWith(`rate_limit:discomfort:${PLAYER}`, 10, 3600);
    expect(db.discomfort.create).not.toHaveBeenCalled();
  });

  test("crea → 201 y los logs solo llevan ids", async () => {
    const res = await post(valid);
    expect(res.status).toBe(201);
    expect(db.discomfort.create.mock.calls[0][0].data).toMatchObject({ eventId: "ev1", userId: PLAYER, bodyArea: "KNEE", intensity: 7 });
    const logged = JSON.stringify([(logger.info as jest.Mock).mock.calls, (logger.error as jest.Mock).mock.calls, (logger.warn as jest.Mock).mock.calls]);
    expect(logged).not.toContain("KNEE");
    expect(logged).not.toContain(NOTE);
  });

  test("primera molestia sin ver: 1 email por coach activo SIN zona, intensidad, nota ni jugador", async () => {
    const res = await post(valid);
    expect(res.status).toBe(201);
    expect(email).toHaveBeenCalledTimes(2);
    expect(email.mock.calls.map((c) => c[0].to).sort()).toEqual(["c1@x.test", "c2@x.test"]);

    for (const [arg] of email.mock.calls) {
      const html = renderToStaticMarkup(arg.react);
      const everything = JSON.stringify(arg) + html;
      expect(html).toContain("Un jugador ha reportado una molestia para");
      expect(html).toContain("Entreno martes");
      expect(html).toContain("/events/ev1");
      for (const secret of ["KNEE", "rodilla", NOTE, PLAYER]) expect(everything).not.toContain(secret);
      expect(html).not.toMatch(/intensidad|7\/10/i);
    }
  });

  test("segunda molestia mientras hay una sin ver → no envía", async () => {
    db.discomfort.count.mockResolvedValue(1);
    expect((await post(valid)).status).toBe(201);
    expect(email).not.toHaveBeenCalled();
  });

  test("si el envío falla, la molestia se guarda igual y el fallo se registra sin detalles", async () => {
    email.mockRejectedValue(new Error("boom"));
    const res = await post(valid);
    expect(res.status).toBe(201);
    expect(db.discomfort.create).toHaveBeenCalled();
    const errLog = JSON.stringify((logger.error as jest.Mock).mock.calls);
    expect(errLog).not.toContain("KNEE");
    expect(errLog).not.toContain(NOTE);
    email.mockResolvedValue({ id: "mock" });
  });

  test("presupuesto de email agotado → no envía pero guarda", async () => {
    (trackEmailBudget as jest.Mock).mockResolvedValue(false);
    expect((await post(valid)).status).toBe(201);
    expect(email).not.toHaveBeenCalled();
  });
});

describe("GET /api/events/[id]/discomforts", () => {
  const get = () => listRoute(new Request("http://localhost/api/events/ev1/discomforts"), PARAMS);

  test("el jugador solo ve las suyas", async () => {
    db.discomfort.findMany.mockResolvedValue([]);
    expect((await get()).status).toBe(200);
    expect(db.discomfort.findMany.mock.calls[0][0].where).toEqual({ eventId: "ev1", userId: PLAYER });
  });

  test("el coach ve todas, con el nombre del jugador", async () => {
    mockAuth.mockResolvedValue({ user: { id: COACH1 } });
    db.discomfort.findMany.mockResolvedValue([]);
    expect((await get()).status).toBe(200);
    const arg = db.discomfort.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ eventId: "ev1" });
    expect(arg.select.user).toEqual({ select: { name: true } });
  });

  test("jugador de otro equipo → 403", async () => {
    mockAuth.mockResolvedValue({ user: { id: OTHER } });
    expect((await get()).status).toBe(403);
    expect(db.discomfort.findMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/events/[id]/discomforts/seen", () => {
  const seen = () => seenRoute(new Request("http://localhost/x", { method: "POST" }), PARAMS);

  test("el coach marca las no vistas → { marked }", async () => {
    mockAuth.mockResolvedValue({ user: { id: COACH1 } });
    db.discomfort.updateMany.mockResolvedValue({ count: 2 });
    const res = await seen();
    expect(await res.json()).toEqual({ marked: 2 });
    const arg = db.discomfort.updateMany.mock.calls[0][0];
    expect(arg.where).toEqual({ eventId: "ev1", seenByCoachAt: null });
    expect(arg.data.seenByCoachAt).toBeInstanceOf(Date);
  });

  test("un jugador → 403", async () => {
    expect((await seen()).status).toBe(403);
    expect(db.discomfort.updateMany).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/discomforts/[id]", () => {
  const del = () => deleteRoute(new Request("http://localhost/x", { method: "DELETE" }), { params: Promise.resolve({ id: "d1" }) });
  const row = { id: "d1", userId: PLAYER, eventId: "ev1", event: { teamId: "team-1" } };

  beforeEach(() => {
    db.discomfort.findUnique.mockResolvedValue(row);
    db.discomfort.delete.mockResolvedValue({});
  });

  test("el autor borra", async () => {
    expect((await del()).status).toBe(200);
    expect(db.discomfort.delete).toHaveBeenCalledWith({ where: { id: "d1" } });
  });

  test("un coach activo del equipo borra", async () => {
    mockAuth.mockResolvedValue({ user: { id: COACH1 } });
    expect((await del()).status).toBe(200);
  });

  test("un ajeno (otro jugador, otro equipo o ex-coach) → 404 y no borra", async () => {
    mockAuth.mockResolvedValue({ user: { id: OTHER } });
    expect((await del()).status).toBe(404);
    expect(db.discomfort.delete).not.toHaveBeenCalled();
  });

  test("otro jugador del mismo equipo → 404", async () => {
    mockAuth.mockResolvedValue({ user: { id: "player-3" } });
    members({ "player-3": { isCoach: false } });
    expect((await del()).status).toBe(404);
  });

  test("no existe → 404", async () => {
    db.discomfort.findUnique.mockResolvedValue(null);
    expect((await del()).status).toBe(404);
  });
});
