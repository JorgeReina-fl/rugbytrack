/**
 * @jest-environment node
 */

import { POST as createEvent } from "@/app/api/events/route";
import { PATCH as editEvent } from "@/app/api/events/[id]/route";
import { POST as joinTeam } from "@/app/api/teams/join/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendRsvpNotifications } from "@/lib/rsvp-notify";
import { isAllTeamEvent, ALL_TEAM_TYPES } from "@/lib/convocation";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock("@/lib/rsvp-notify", () => ({ sendRsvpNotifications: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    event: { create: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn(), update: jest.fn() },
    team: { findUnique: jest.fn() },
    teamMember: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    callup: { createMany: jest.fn(), deleteMany: jest.fn() },
    attendance: { createMany: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
  },
}));

const db = prisma as any;
const COACH = "clcoach00000000000000000";
const TEAM = "clteam0000000000000000000";
const P1 = "clplayer1000000000000000";
const P2 = "clplayer2000000000000000";
const P3 = "clplayer3000000000000000";

beforeEach(() => {
  jest.clearAllMocks();
  (auth as jest.Mock).mockResolvedValue({ user: { id: COACH } });
  db.teamMember.findFirst.mockResolvedValue({ isCoach: true });
  db.event.create.mockResolvedValue({ id: "ev1" });
  db.attendance.findMany.mockResolvedValue([]);
});

const post = (type: string, callups: unknown[] = []) =>
  createEvent(
    new Request("http://localhost/api/events", {
      method: "POST",
      body: JSON.stringify({ teamId: TEAM, title: "Evento", type, startDate: new Date().toISOString(), callups }),
    }) as any
  );

describe("tipos de todo el equipo", () => {
  test("TRAINING, OTHER y TRIP sí; MATCH y TOURNAMENT no", () => {
    expect([...ALL_TEAM_TYPES].sort()).toEqual(["OTHER", "TRAINING", "TRIP"]);
    expect(isAllTeamEvent("TRAINING")).toBe(true);
    expect(isAllTeamEvent("OTHER")).toBe(true);
    expect(isAllTeamEvent("TRIP")).toBe(true);
    expect(isAllTeamEvent("MATCH")).toBe(false);
    expect(isAllTeamEvent("TOURNAMENT")).toBe(false);
  });
});

describe("POST /api/events", () => {
  test.each(["TRAINING", "OTHER", "TRIP"])("%s convoca a todos los activos no coach y envía la convocatoria", async (type) => {
    db.teamMember.findMany.mockResolvedValue([{ userId: P1 }, { userId: P2 }]);
    const res = await post(type);
    expect(res.status).toBe(201);
    // Solo activos y no coach (los ex-miembros y los coaches quedan fuera por la consulta)
    expect(db.teamMember.findMany.mock.calls[0][0].where).toEqual({ teamId: TEAM, leftAt: null, isCoach: false });
    const data = db.attendance.createMany.mock.calls[0][0].data;
    expect(data.map((d: any) => d.userId)).toEqual([P1, P2]);
    expect(data.every((d: any) => d.status === "PENDING" && d.eventId === "ev1" && d.checkedIn === false)).toBe(true);
    expect(db.attendance.createMany.mock.calls[0][0].skipDuplicates).toBe(true);
    expect(db.callup.createMany).not.toHaveBeenCalled();
    expect(sendRsvpNotifications).toHaveBeenCalledWith("ev1");
  });

  test("los callups del body de un entreno se ignoran (sin error) y no se validan", async () => {
    db.teamMember.findMany.mockResolvedValue([{ userId: P1 }]);
    const res = await post("TRAINING", [{ userId: P3, isStarter: true, position: "FLY_HALF" }]);
    expect(res.status).toBe(201);
    expect(db.callup.createMany).not.toHaveBeenCalled();
    expect(db.attendance.createMany.mock.calls[0][0].data.map((d: any) => d.userId)).toEqual([P1]);
  });

  test("equipo sin jugadores activos → se crea el evento, sin asistencias ni correo", async () => {
    db.teamMember.findMany.mockResolvedValue([]);
    const res = await post("TRAINING");
    expect(res.status).toBe(201);
    expect(db.attendance.createMany).not.toHaveBeenCalled();
    expect(sendRsvpNotifications).not.toHaveBeenCalled();
  });

  test("MATCH sin cambios: usa los convocados del body (validados) y crea Callup", async () => {
    db.teamMember.findMany.mockResolvedValue([{ userId: P1 }]);
    const res = await post("MATCH", [{ userId: P1, isStarter: true, position: "FLY_HALF" }]);
    expect(res.status).toBe(201);
    expect(db.callup.createMany.mock.calls[0][0].data).toHaveLength(1);
    expect(db.attendance.createMany.mock.calls[0][0].data).toHaveLength(1);
    expect(sendRsvpNotifications).toHaveBeenCalledWith("ev1");
  });

  test("MATCH sin convocados: no convoca a nadie", async () => {
    const res = await post("MATCH", []);
    expect(res.status).toBe(201);
    expect(db.attendance.createMany).not.toHaveBeenCalled();
    expect(sendRsvpNotifications).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/events/[id] — cambio de tipo", () => {
  const patch = (body: unknown) =>
    editEvent(new Request("http://localhost/x", { method: "PATCH", body: JSON.stringify(body) }) as any, {
      params: Promise.resolve({ id: "ev1" }),
    });
  const event = (type: string) => ({ id: "ev1", teamId: TEAM, type, createdById: COACH });

  beforeEach(() => {
    db.event.update.mockResolvedValue({ id: "ev1" });
    db.teamMember.findMany.mockResolvedValue([{ userId: P1 }, { userId: P2 }]);
  });

  test("MATCH → TRAINING: convoca a todos (sin correo) y borra los Callup", async () => {
    db.event.findUnique.mockResolvedValue(event("MATCH"));
    const res = await patch({ type: "TRAINING" });
    expect(res.status).toBe(200);
    expect(db.attendance.createMany.mock.calls[0][0].data.map((d: any) => d.userId)).toEqual([P1, P2]);
    expect(db.callup.deleteMany).toHaveBeenCalledWith({ where: { eventId: "ev1" } });
    expect(sendRsvpNotifications).not.toHaveBeenCalled();
  });

  test("las asistencias que ya existían no se duplican", async () => {
    db.event.findUnique.mockResolvedValue(event("OTHER"));
    db.attendance.findMany.mockResolvedValue([{ userId: P1 }]);
    await patch({ type: "TRIP" }); // OTHER → TRIP: ambos de todo el equipo, pero el tipo cambia
    expect(db.attendance.createMany.mock.calls[0][0].data.map((d: any) => d.userId)).toEqual([P2]);
  });

  test("TRAINING → MATCH: conserva las asistencias y no crea Callup", async () => {
    db.event.findUnique.mockResolvedValue(event("TRAINING"));
    const res = await patch({ type: "MATCH" });
    expect(res.status).toBe(200);
    expect(db.attendance.createMany).not.toHaveBeenCalled();
    expect(db.callup.createMany).not.toHaveBeenCalled();
    expect(db.callup.deleteMany).not.toHaveBeenCalled();
  });

  test("sin cambio de tipo (o sin tipo) no convoca ni borra nada", async () => {
    db.event.findUnique.mockResolvedValue(event("TRAINING"));
    await patch({ type: "TRAINING", title: "Nuevo título" });
    await patch({ title: "Solo título" });
    expect(db.attendance.createMany).not.toHaveBeenCalled();
    expect(db.callup.deleteMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/teams/join", () => {
  const join = () =>
    joinTeam(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ token: "abcdefghijkl" }) }) as any);

  beforeEach(() => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: P3 } });
    db.team.findUnique.mockResolvedValue({ id: TEAM, name: "Equipo", slug: "eq" });
    db.event.findMany.mockResolvedValue([{ id: "f1" }, { id: "f2" }]);
    db.attendance.createMany.mockResolvedValue({ count: 2 });
  });

  const expectConvocated = () => {
    // Una consulta de eventos: solo futuros y solo de todo el equipo, del equipo al que se une
    expect(db.event.findMany).toHaveBeenCalledTimes(1);
    const where = db.event.findMany.mock.calls[0][0].where;
    expect(where.teamId).toBe(TEAM);
    expect([...where.type.in].sort()).toEqual(["OTHER", "TRAINING", "TRIP"]);
    expect(where.startDate.gt).toBeInstanceOf(Date);
    // Un createMany con los eventos futuros para el nuevo miembro
    expect(db.attendance.createMany).toHaveBeenCalledTimes(1);
    const arg = db.attendance.createMany.mock.calls[0][0];
    expect(arg.data).toEqual([
      { eventId: "f1", userId: P3, status: "PENDING", checkedIn: false },
      { eventId: "f2", userId: P3, status: "PENDING", checkedIn: false },
    ]);
    expect(arg.skipDuplicates).toBe(true);
    expect(sendRsvpNotifications).not.toHaveBeenCalled();
  };

  test("alta nueva → convoca a los entrenos futuros, sin correo", async () => {
    db.teamMember.findFirst.mockResolvedValue(null);
    db.teamMember.create.mockResolvedValue({ id: "m-new" });
    const res = await join();
    expect(res.status).toBe(201);
    expectConvocated();
  });

  test("reingreso → también", async () => {
    db.teamMember.findFirst.mockResolvedValue({ id: "m-old", leftAt: new Date(), position: null, jerseyNumber: null });
    db.teamMember.update.mockResolvedValue({ id: "m-old" });
    const res = await join();
    expect(res.status).toBe(200);
    expectConvocated();
  });

  test("sin eventos futuros de todo el equipo → no crea asistencias", async () => {
    db.teamMember.findFirst.mockResolvedValue(null);
    db.teamMember.create.mockResolvedValue({ id: "m-new" });
    db.event.findMany.mockResolvedValue([]);
    expect((await join()).status).toBe(201);
    expect(db.attendance.createMany).not.toHaveBeenCalled();
  });

  test("ya es miembro activo → 409 y no convoca", async () => {
    db.teamMember.findFirst.mockResolvedValue({ id: "m", leftAt: null });
    expect((await join()).status).toBe(409);
    expect(db.attendance.createMany).not.toHaveBeenCalled();
  });
});
