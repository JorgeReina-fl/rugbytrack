/**
 * @jest-environment node
 */

import { POST as createEvent } from "@/app/api/events/route";
import { PATCH as setPresenceRoute } from "@/app/api/events/[id]/attendance/[userId]/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendRsvpNotifications } from "@/lib/rsvp-notify";
import { setPresence } from "@/lib/attendance-write";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock("@/lib/rsvp-notify", () => ({ sendRsvpNotifications: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/attendance-write", () => ({ setPresence: jest.fn().mockResolvedValue({ checkedIn: true }) }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    event: { create: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) },
    teamMember: { findFirst: jest.fn(), findMany: jest.fn() },
    callup: { createMany: jest.fn() },
    attendance: { createMany: jest.fn() },
    $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
  },
}));

const db = prisma as any;
const COACH = "clcoach00000000000000000";
const P1 = "clplayer1000000000000000";
const P2 = "clplayer2000000000000000";
const TEAM = "clteam0000000000000000000";

const post = (callups: unknown[]) =>
  createEvent(
    new Request("http://localhost/api/events", {
      method: "POST",
      body: JSON.stringify({ teamId: TEAM, title: "Partido", type: "MATCH", startDate: new Date().toISOString(), callups }),
    }) as any
  );

beforeEach(() => {
  jest.clearAllMocks();
  (auth as jest.Mock).mockResolvedValue({ user: { id: COACH } });
  db.teamMember.findFirst.mockResolvedValue({ isCoach: true });
  db.event.create.mockResolvedValue({ id: "ev1" });
});

describe("POST /api/events — convocados", () => {
  test("un convocado que no es miembro → 422 sin crear nada ni enviar correo", async () => {
    db.teamMember.findMany.mockResolvedValue([{ userId: P1 }]); // P2 no es miembro activo
    const res = await post([{ userId: P1 }, { userId: P2 }]);
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("Algún jugador convocado no pertenece al equipo");
    expect(db.event.create).not.toHaveBeenCalled();
    expect(db.callup.createMany).not.toHaveBeenCalled();
    expect(db.attendance.createMany).not.toHaveBeenCalled();
    expect(sendRsvpNotifications).not.toHaveBeenCalled();
  });

  test("la consulta de membresía exige leftAt nulo (un ex-miembro no cuenta) → 422", async () => {
    db.teamMember.findMany.mockResolvedValue([]); // el ex-miembro queda fuera por leftAt: null
    const res = await post([{ userId: P1 }]);
    expect(res.status).toBe(422);
    expect(db.teamMember.findMany.mock.calls[0][0].where).toMatchObject({ teamId: TEAM, leftAt: null });
    expect(sendRsvpNotifications).not.toHaveBeenCalled();
  });

  test("duplicados → una sola fila por jugador", async () => {
    db.teamMember.findMany.mockResolvedValue([{ userId: P1 }]);
    const res = await post([{ userId: P1, isStarter: true }, { userId: P1 }]);
    expect(res.status).toBe(201);
    expect(db.teamMember.findMany.mock.calls[0][0].where.userId.in).toEqual([P1]);
    expect(db.callup.createMany.mock.calls[0][0].data).toHaveLength(1);
    expect(db.attendance.createMany.mock.calls[0][0].data).toHaveLength(1);
  });

  test("todos válidos → crea y envía", async () => {
    db.teamMember.findMany.mockResolvedValue([{ userId: P1 }, { userId: P2 }]);
    const res = await post([{ userId: P1 }, { userId: P2 }]);
    expect(res.status).toBe(201);
    expect(db.callup.createMany.mock.calls[0][0].data).toHaveLength(2);
    expect(sendRsvpNotifications).toHaveBeenCalledWith("ev1");
  });

  test("sin convocados no consulta miembros", async () => {
    const res = await post([]);
    expect(res.status).toBe(201);
    expect(db.teamMember.findMany).not.toHaveBeenCalled();
    expect(sendRsvpNotifications).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/events/[id]/attendance/[userId] — pase de lista", () => {
  const patch = () =>
    setPresenceRoute(new Request("http://localhost/x", { method: "PATCH", body: JSON.stringify({ checkedIn: true }) }) as any, {
      params: Promise.resolve({ id: "ev1", userId: P1 }),
    });

  beforeEach(() => db.event.findUnique.mockResolvedValue({ teamId: TEAM }));

  test("jugador no miembro activo → 422 y no crea asistencia", async () => {
    db.teamMember.findFirst.mockImplementation(({ where }: any) => Promise.resolve(where.isCoach ? { isCoach: true } : null));
    const res = await patch();
    expect(res.status).toBe(422);
    expect(setPresence).not.toHaveBeenCalled();
  });

  test("jugador activo → OK", async () => {
    db.teamMember.findFirst.mockResolvedValue({ id: "m1", isCoach: true });
    expect((await patch()).status).toBe(200);
    expect(setPresence).toHaveBeenCalledWith("ev1", P1, true, COACH);
  });
});
