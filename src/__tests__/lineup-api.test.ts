/**
 * @jest-environment node
 */

import { POST as createEvent } from "@/app/api/events/route";
import { PUT as putLineup } from "@/app/api/events/[id]/lineup/route";
import { notifyLineupChanges } from "@/lib/lineup-notify";
import { sendRsvpNotifications } from "@/lib/rsvp-notify";
import { sendEmail } from "@/lib/resend";
import { trackEmailBudget } from "@/lib/email-budget";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock("@/lib/rsvp-notify", () => ({ sendRsvpNotifications: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/resend", () => ({ sendEmail: jest.fn().mockResolvedValue({ id: "m" }) }));
jest.mock("@/lib/email-budget", () => ({ trackEmailBudget: jest.fn().mockResolvedValue(true) }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    event: { create: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    teamMember: { findFirst: jest.fn(), findMany: jest.fn() },
    callup: { createMany: jest.fn(), findMany: jest.fn(), deleteMany: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
    attendance: { createMany: jest.fn(), deleteMany: jest.fn() },
    user: { findMany: jest.fn() },
    $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
  },
}));
// El PUT dispara el aviso sin esperarlo: en los tests de la ruta se sustituye por un espía
jest.mock("@/lib/lineup-notify", () => {
  const actual = jest.requireActual("@/lib/lineup-notify");
  return { ...actual, notifyLineupChanges: jest.fn().mockResolvedValue(undefined) };
});

const db = prisma as any;
const COACH = "clcoach00000000000000000";
const TEAM = "clteam0000000000000000000";
const U = (n: number) => `clplayer${n}`.padEnd(25, "0");
const FUTURE = new Date(Date.now() + 86_400_000);
const PAST = new Date(Date.now() - 86_400_000);

beforeEach(() => {
  jest.clearAllMocks();
  (auth as jest.Mock).mockResolvedValue({ user: { id: COACH } });
  db.teamMember.findFirst.mockResolvedValue({ isCoach: true });
  db.event.findFirst.mockResolvedValue(null);
  db.event.create.mockResolvedValue({ id: "ev1" });
});

// ---------------------------------------------------------------------------
describe("POST /api/events — dorsales", () => {
  const post = (extra: Record<string, unknown>) =>
    createEvent(
      new Request("http://localhost/api/events", {
        method: "POST",
        body: JSON.stringify({ teamId: TEAM, title: "Partido", type: "MATCH", startDate: FUTURE.toISOString(), ...extra }),
      }) as any
    );

  test("con dorsales: guarda format, shirtNumber y deriva isStarter/position (ignora los del body)", async () => {
    db.teamMember.findMany.mockResolvedValue([{ userId: U(1) }, { userId: U(2) }, { userId: U(3) }]);
    const res = await post({
      format: "SEVENS",
      callups: [
        { userId: U(1), shirtNumber: 5, isStarter: false, position: "FULLBACK" },
        { userId: U(2), shirtNumber: 9 },
        { userId: U(3), shirtNumber: null },
      ],
    });
    expect(res.status).toBe(201);
    expect(db.event.create.mock.calls[0][0].data.format).toBe("SEVENS");
    expect(db.callup.createMany.mock.calls[0][0].data).toEqual([
      { eventId: "ev1", userId: U(1), shirtNumber: 5, isStarter: true, position: "FLY_HALF" },
      { eventId: "ev1", userId: U(2), shirtNumber: 9, isStarter: false, position: "REPLACEMENT" },
      { eventId: "ev1", userId: U(3), shirtNumber: null, isStarter: false, position: null },
    ]);
    expect(sendRsvpNotifications).toHaveBeenCalledWith("ev1");
  });

  test("sin format: usa el del equipo (defaultFormatForTeam)", async () => {
    db.event.findFirst.mockResolvedValue({ format: "FIFTEENS" });
    db.teamMember.findMany.mockResolvedValue([{ userId: U(1) }]);
    const res = await post({ callups: [{ userId: U(1), shirtNumber: 15 }] });
    expect(res.status).toBe(201);
    expect(db.event.create.mock.calls[0][0].data.format).toBe("FIFTEENS");
    expect(db.callup.createMany.mock.calls[0][0].data[0]).toMatchObject({ shirtNumber: 15, position: "FULLBACK", isStarter: true });
  });

  test("sin format y equipo sin historial → SEVENS", async () => {
    const res = await post({});
    expect(res.status).toBe(201);
    expect(db.event.create.mock.calls[0][0].data.format).toBe("SEVENS");
  });

  test("formato antiguo (isStarter/position sin dorsal) → comportamiento de hoy, sin dorsal", async () => {
    db.teamMember.findMany.mockResolvedValue([{ userId: U(1) }]);
    const res = await post({ callups: [{ userId: U(1), isStarter: true, position: "HOOKER" }] });
    expect(res.status).toBe(201);
    expect(db.callup.createMany.mock.calls[0][0].data[0]).toEqual({
      eventId: "ev1", userId: U(1), shirtNumber: null, isStarter: true, position: "HOOKER",
    });
  });

  test("dorsal fuera de rango para el formato → 422 sin crear nada", async () => {
    db.teamMember.findMany.mockResolvedValue([{ userId: U(1) }]);
    const res = await post({ format: "SEVENS", callups: [{ userId: U(1), shirtNumber: 13 }] });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("Dorsal 13 fuera de rango (1-12)");
    expect(db.event.create).not.toHaveBeenCalled();
  });

  test("dorsal repetido → 422", async () => {
    db.teamMember.findMany.mockResolvedValue([{ userId: U(1) }, { userId: U(2) }]);
    const res = await post({ format: "FIFTEENS", callups: [{ userId: U(1), shirtNumber: 4 }, { userId: U(2), shirtNumber: 4 }] });
    expect(res.status).toBe(422);
    expect(db.event.create).not.toHaveBeenCalled();
  });

  test("un entreno no guarda formato aunque se envíe y no consulta el del equipo", async () => {
    db.teamMember.findMany.mockResolvedValue([]);
    const res = await post({ type: "TRAINING", format: "FIFTEENS" });
    expect(res.status).toBe(201);
    expect(db.event.create.mock.calls[0][0].data.format).toBeNull();
    expect(db.event.findFirst).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
describe("PUT /api/events/[id]/lineup", () => {
  const put = (body: unknown) =>
    putLineup(new Request("http://localhost/api/events/ev1/lineup", { method: "PUT", body: JSON.stringify(body) }) as any, {
      params: Promise.resolve({ id: "ev1" }),
    });
  const event = (over: Record<string, unknown> = {}) => ({
    id: "ev1", teamId: TEAM, title: "Partido", type: "MATCH", startDate: FUTURE, ...over,
  });
  const cur = (userId: string, shirtNumber: number | null, isStarter: boolean, position: string | null) => ({
    userId, shirtNumber, isStarter, position,
  });

  beforeEach(() => {
    db.event.findUnique.mockResolvedValue(event());
    db.callup.findMany.mockResolvedValue([]);
    db.teamMember.findMany.mockImplementation(({ where }: any) => Promise.resolve(where.userId.in.map((userId: string) => ({ userId }))));
  });

  test("sin sesión → 401", async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    expect((await put({ format: "SEVENS", players: [] })).status).toBe(401);
  });

  test("no coach → 403 y no toca nada", async () => {
    db.teamMember.findFirst.mockResolvedValue({ isCoach: false });
    expect((await put({ format: "SEVENS", players: [] })).status).toBe(403);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  test("ex-coach (membresía con leftAt) → 403: la consulta exige leftAt nulo", async () => {
    db.teamMember.findFirst.mockResolvedValue(null);
    expect((await put({ format: "SEVENS", players: [] })).status).toBe(403);
    expect(db.teamMember.findFirst.mock.calls[0][0].where).toMatchObject({ teamId: TEAM, userId: COACH, leftAt: null });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  test("partido empezado → 409 «El partido ya ha empezado»", async () => {
    db.event.findUnique.mockResolvedValue(event({ startDate: PAST }));
    const res = await put({ format: "SEVENS", players: [] });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("El partido ya ha empezado");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  test("entrenamiento → 422", async () => {
    db.event.findUnique.mockResolvedValue(event({ type: "TRAINING" }));
    expect((await put({ format: "SEVENS", players: [] })).status).toBe(422);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  test("evento inexistente → 404", async () => {
    db.event.findUnique.mockResolvedValue(null);
    expect((await put({ format: "SEVENS", players: [] })).status).toBe(404);
  });

  test("miembro no activo → 422 sin transacción", async () => {
    db.teamMember.findMany.mockResolvedValue([{ userId: U(1) }]); // U(2) no es miembro activo
    const res = await put({ format: "SEVENS", players: [{ userId: U(1), shirtNumber: 1 }, { userId: U(2), shirtNumber: 2 }] });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("Algún jugador convocado no pertenece al equipo");
    expect(db.teamMember.findMany.mock.calls[0][0].where).toMatchObject({ teamId: TEAM, leftAt: null });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  test.each([
    [[{ userId: U(1), shirtNumber: 13 }], "Dorsal 13 fuera de rango (1-12)"],
    [[{ userId: U(1), shirtNumber: 2 }, { userId: U(2), shirtNumber: 2 }], "Dorsal 2 repetido"],
    [[{ userId: U(1), shirtNumber: 1 }, { userId: U(1), shirtNumber: 2 }], "Jugador repetido en la alineación"],
  ])("alineación inválida → 422 con el primer error en español (%#)", async (players, msg) => {
    const res = await put({ format: "SEVENS", players });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe(msg);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  test("diff: entra, sale, cambia y sigue igual", async () => {
    const [STAY, CHANGE, OUT, IN] = [U(1), U(2), U(3), U(4)];
    db.callup.findMany.mockResolvedValue([
      cur(STAY, 1, true, "PROP_LOOSEHEAD"),
      cur(CHANGE, 5, true, "FLY_HALF"),
      cur(OUT, 9, false, "REPLACEMENT"),
    ]);
    const res = await put({
      format: "SEVENS",
      players: [
        { userId: STAY, shirtNumber: 1 },
        { userId: CHANGE, shirtNumber: 9 },
        { userId: IN, shirtNumber: 5 }, // ocupa el dorsal que deja CHANGE
      ],
    });
    expect(res.status).toBe(200);

    expect(db.event.update).toHaveBeenCalledWith({ where: { id: "ev1" }, data: { format: "SEVENS" } });
    // sale: Callup y Attendance (solo checkedIn = false)
    expect(db.callup.deleteMany).toHaveBeenCalledWith({ where: { eventId: "ev1", userId: { in: [OUT] } } });
    expect(db.attendance.deleteMany).toHaveBeenCalledWith({ where: { eventId: "ev1", userId: { in: [OUT] }, checkedIn: false } });
    // cambia: se libera el dorsal y luego se reasigna; el que sigue igual no se toca
    expect(db.callup.updateMany).toHaveBeenCalledWith({ where: { eventId: "ev1", userId: { in: [CHANGE] } }, data: { shirtNumber: null } });
    expect(db.callup.update).toHaveBeenCalledTimes(1);
    expect(db.callup.update).toHaveBeenCalledWith({
      where: { eventId_userId: { eventId: "ev1", userId: CHANGE } },
      data: { shirtNumber: 9, isStarter: false, position: "REPLACEMENT" },
    });
    // entra: Callup + Attendance PENDING
    expect(db.callup.createMany).toHaveBeenCalledWith({
      data: [{ eventId: "ev1", userId: IN, shirtNumber: 5, isStarter: true, position: "FLY_HALF" }],
    });
    expect(db.attendance.createMany).toHaveBeenCalledWith({
      data: [{ eventId: "ev1", userId: IN, status: "PENDING", checkedIn: false }],
      skipDuplicates: true,
    });
    // avisos solo a los afectados
    expect(notifyLineupChanges).toHaveBeenCalledWith(
      { id: "ev1", title: "Partido" },
      { entered: [IN], left: [OUT], changed: [{ userId: CHANGE, description: "Suplente (n.º 9)" }] }
    );
    // respuesta: alineación resultante ordenada con etiquetas
    expect((await res.json()).data.players).toEqual([
      { userId: STAY, shirtNumber: 1, isStarter: true, position: "PROP_LOOSEHEAD", label: "Pilar izquierdo" },
      { userId: IN, shirtNumber: 5, isStarter: true, position: "FLY_HALF", label: "Apertura" },
      { userId: CHANGE, shirtNumber: 9, isStarter: false, position: "REPLACEMENT", label: "Suplente" },
    ]);
  });

  test("la Attendance de quien sale solo se borra si checkedIn es false (filtro en la consulta)", async () => {
    db.callup.findMany.mockResolvedValue([cur(U(1), 1, true, "PROP_LOOSEHEAD")]);
    await put({ format: "SEVENS", players: [] });
    expect(db.attendance.deleteMany.mock.calls[0][0].where.checkedIn).toBe(false);
    // El Callup sí se borra aunque tenga checkedIn: la asistencia marcada se conserva
    expect(db.callup.deleteMany).toHaveBeenCalled();
  });

  test("sin cambios → sin escrituras de Callup/Attendance ni avisos", async () => {
    db.callup.findMany.mockResolvedValue([cur(U(1), 1, true, "PROP_LOOSEHEAD"), cur(U(2), 8, false, "REPLACEMENT")]);
    const res = await put({ format: "SEVENS", players: [{ userId: U(1), shirtNumber: 1 }, { userId: U(2), shirtNumber: 8 }] });
    expect(res.status).toBe(200);
    expect(db.callup.deleteMany).not.toHaveBeenCalled();
    expect(db.attendance.deleteMany).not.toHaveBeenCalled();
    expect(db.callup.updateMany).not.toHaveBeenCalled();
    expect(db.callup.update).not.toHaveBeenCalled();
    expect(db.callup.createMany).not.toHaveBeenCalled();
    expect(db.attendance.createMany).not.toHaveBeenCalled();
    expect(notifyLineupChanges).not.toHaveBeenCalled();
  });

  test("callup antiguo sin dorsal que se queda sin dorsal pero era titular → cambia a «Convocado»", async () => {
    db.callup.findMany.mockResolvedValue([cur(U(1), null, true, "HOOKER")]);
    await put({ format: "SEVENS", players: [{ userId: U(1), shirtNumber: null }] });
    expect((notifyLineupChanges as jest.Mock).mock.calls[0][1].changed).toEqual([{ userId: U(1), description: "Convocado" }]);
  });

  test("cambiar el formato recalcula la posición del que sigue (aviso si cambia)", async () => {
    // 15s dorsal 5 = LOCK; en 7s dorsal 5 = Apertura
    db.callup.findMany.mockResolvedValue([cur(U(1), 5, true, "LOCK")]);
    await put({ format: "SEVENS", players: [{ userId: U(1), shirtNumber: 5 }] });
    expect(db.event.update).toHaveBeenCalledWith({ where: { id: "ev1" }, data: { format: "SEVENS" } });
    expect((notifyLineupChanges as jest.Mock).mock.calls[0][1].changed).toEqual([
      { userId: U(1), description: "Titular · Apertura (n.º 5)" },
    ]);
  });
});

// ---------------------------------------------------------------------------
describe("notifyLineupChanges — emails solo a afectados", () => {
  const { notifyLineupChanges: real } = jest.requireActual("@/lib/lineup-notify");
  const send = sendEmail as jest.Mock;

  beforeEach(() => {
    db.user.findMany.mockImplementation(({ where }: any) =>
      Promise.resolve(where.id.in.map((id: string) => ({ id, email: `${id}@test.local`, name: `N-${id}` })))
    );
  });

  test("entra → solo convocatoria con RSVP a quien entra (nada más)", async () => {
    await real({ id: "ev1", title: "Partido" }, { entered: [U(1)], left: [], changed: [] });
    expect(sendRsvpNotifications).toHaveBeenCalledWith("ev1", [U(1)]);
    expect(send).not.toHaveBeenCalled();
  });

  test("sale → «Ya no estás convocado para <título>»", async () => {
    await real({ id: "ev1", title: "Partido" }, { entered: [], left: [U(2)], changed: [] });
    expect(sendRsvpNotifications).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ to: `${U(2)}@test.local`, subject: "Ya no estás convocado para Partido" });
  });

  test("cambia → «Tu convocatoria para <título> ha cambiado: <descripción>»", async () => {
    await real(
      { id: "ev1", title: "Partido" },
      { entered: [], left: [], changed: [{ userId: U(3), description: "Titular · Apertura (n.º 5)" }, { userId: U(4), description: "Suplente (n.º 9)" }] }
    );
    expect(send.mock.calls.map((c) => [c[0].to, c[0].subject])).toEqual([
      [`${U(3)}@test.local`, "Tu convocatoria para Partido ha cambiado: Titular · Apertura (n.º 5)"],
      [`${U(4)}@test.local`, "Tu convocatoria para Partido ha cambiado: Suplente (n.º 9)"],
    ]);
    expect(trackEmailBudget).toHaveBeenCalledWith(2, "HIGH", "lineup-change");
  });

  test("sin afectados → ningún email ni consulta", async () => {
    await real({ id: "ev1", title: "Partido" }, { entered: [], left: [], changed: [] });
    expect(send).not.toHaveBeenCalled();
    expect(sendRsvpNotifications).not.toHaveBeenCalled();
    expect(db.user.findMany).not.toHaveBeenCalled();
  });

  test("presupuesto agotado → no envía; un fallo no lanza", async () => {
    (trackEmailBudget as jest.Mock).mockResolvedValueOnce(false);
    await real({ id: "ev1", title: "P" }, { entered: [], left: [U(1)], changed: [] });
    expect(send).not.toHaveBeenCalled();
    db.user.findMany.mockRejectedValueOnce(new Error("db"));
    await expect(real({ id: "ev1", title: "P" }, { entered: [], left: [U(1)], changed: [] })).resolves.toBeUndefined();
  });
});
