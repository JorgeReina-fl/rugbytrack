/**
 * @jest-environment node
 */

import { renderToStaticMarkup } from "react-dom/server";
import { getActiveMembership, getActiveTeamsForUser, requireActiveMembership } from "@/lib/membership";
import { POST as leaveRoute } from "@/app/api/teams/[id]/leave/route";
import { DELETE as expelRoute } from "@/app/api/teams/[id]/members/[userId]/route";
import { GET as attendanceGet } from "@/app/api/events/[id]/attendance/route";
import RsvpPage from "@/app/rsvp/[token]/page";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { verifyRsvpToken } from "@/lib/tokens";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: jest.fn(),
}));
jest.mock("@/lib/tokens", () => ({ verifyRsvpToken: jest.fn() }));
jest.mock("@/app/rsvp/[token]/rsvp-action", () => ({ RsvpAction: () => null }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    teamMember: { findFirst: jest.fn(), count: jest.fn(), update: jest.fn() },
    team: { findMany: jest.fn() },
    event: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    attendance: { findMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

const db = prisma as any;
const USER = "user-1";
const TEAM = "team-1";

beforeEach(() => {
  jest.clearAllMocks();
  (auth as jest.Mock).mockResolvedValue({ user: { id: USER } });
});

// Simula la BD: solo devuelve la fila si la consulta exige leftAt nulo (o no mira leftAt) según el estado
const memberRow = (state: "activo" | "ex" | "no-miembro", extra: object = {}) =>
  db.teamMember.findFirst.mockImplementation(({ where }: any) => {
    if (state === "no-miembro") return Promise.resolve(null);
    if (state === "ex" && where.leftAt === null) return Promise.resolve(null);
    return Promise.resolve({ id: "m1", isCoach: false, team: { id: TEAM }, ...extra });
  });

describe("helpers de membresía activa", () => {
  test("miembro activo → devuelve la membresía; la consulta exige leftAt nulo", async () => {
    memberRow("activo");
    expect(await getActiveMembership(TEAM, USER)).toBeTruthy();
    expect(db.teamMember.findFirst.mock.calls[0][0].where).toEqual({ teamId: TEAM, userId: USER, leftAt: null });
  });

  test("ex-miembro → null / notFound", async () => {
    memberRow("ex");
    expect(await getActiveMembership(TEAM, USER)).toBeNull();
    await expect(requireActiveMembership(TEAM, USER)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  test("no miembro → null / notFound (mismo resultado que un ex-miembro)", async () => {
    memberRow("no-miembro");
    expect(await getActiveMembership(TEAM, USER)).toBeNull();
    await expect(requireActiveMembership(TEAM, USER)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  test("requireActiveMembership con miembro activo devuelve la membresía con su equipo", async () => {
    memberRow("activo");
    const m = await requireActiveMembership(TEAM, USER);
    expect(m.team.id).toBe(TEAM);
  });

  test("getActiveTeamsForUser filtra equipo y rol por leftAt nulo", async () => {
    db.team.findMany.mockResolvedValue([]);
    await getActiveTeamsForUser(USER);
    const arg = db.team.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ members: { some: { userId: USER, leftAt: null } } });
    expect(arg.select.members.where).toEqual({ userId: USER, leftAt: null });
  });
});

describe("al salir o ser expulsado, isCoach pasa a false", () => {
  test("abandonar (coach con otros coaches) → leftAt e isCoach=false", async () => {
    db.teamMember.findFirst.mockResolvedValue({ id: "m1", isCoach: true });
    db.teamMember.count.mockResolvedValue(2);
    db.teamMember.update.mockResolvedValue({});
    const res = await leaveRoute(new Request("http://localhost/x", { method: "POST" }), { params: Promise.resolve({ id: TEAM }) });
    expect(res.status).toBe(200);
    const data = db.teamMember.update.mock.calls[0][0].data;
    expect(data.isCoach).toBe(false);
    expect(data.leftAt).toBeInstanceOf(Date);
  });

  test("abandonar con traspaso → el que sale queda con isCoach=false y el nuevo con true", async () => {
    db.teamMember.findFirst
      .mockResolvedValueOnce({ id: "m1", isCoach: true })
      .mockResolvedValueOnce({ id: "m2", isCoach: false });
    db.teamMember.count.mockResolvedValue(1);
    db.teamMember.update.mockImplementation((a: unknown) => a);
    db.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops));
    const res = await leaveRoute(
      new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ newCoachUserId: "other" }) }),
      { params: Promise.resolve({ id: TEAM }) }
    );
    expect(res.status).toBe(200);
    const calls = db.teamMember.update.mock.calls.map((c: any) => c[0]);
    expect(calls.find((c: any) => c.where.id === "m2").data).toEqual({ isCoach: true });
    expect(calls.find((c: any) => c.where.id === "m1").data).toMatchObject({ isCoach: false });
  });

  test("expulsar a un coach → leftAt e isCoach=false", async () => {
    db.teamMember.findFirst
      .mockResolvedValueOnce({ id: "caller", isCoach: true })
      .mockResolvedValueOnce({ id: "m9", isCoach: true });
    db.teamMember.count.mockResolvedValue(2);
    db.teamMember.update.mockResolvedValue({});
    const res = await expelRoute(new Request("http://localhost/x", { method: "DELETE" }), {
      params: Promise.resolve({ id: TEAM, userId: "target" }),
    });
    expect(res.status).toBe(200);
    expect(db.teamMember.update.mock.calls[0][0].data).toMatchObject({ isCoach: false });
  });
});

describe("GET /api/events/[id]/attendance", () => {
  const call = () => attendanceGet(new Request("http://localhost/x"), { params: Promise.resolve({ id: "ev1" }) });

  test("un ex-coach (isCoach true pero leftAt puesto) → 403", async () => {
    db.event.findUnique.mockResolvedValue({ id: "ev1", teamId: TEAM });
    db.teamMember.findFirst.mockImplementation(({ where }: any) => Promise.resolve(where.leftAt === null ? null : { isCoach: true }));
    const res = await call();
    expect(res.status).toBe(403);
    expect(db.attendance.findMany).not.toHaveBeenCalled();
  });

  test("coach activo → solo asistencias de miembros activos", async () => {
    db.event.findUnique.mockResolvedValue({ id: "ev1", teamId: TEAM });
    db.teamMember.findFirst.mockResolvedValue({ isCoach: true });
    db.attendance.findMany.mockResolvedValue([]);
    const res = await call();
    expect(res.status).toBe(200);
    expect(db.attendance.findMany.mock.calls[0][0].where.user.memberships.some).toEqual({ teamId: TEAM, leftAt: null });
  });
});

describe("rsvp/[token]", () => {
  const render = async () =>
    renderToStaticMarkup(await RsvpPage({ params: Promise.resolve({ token: "tok" }) }));

  beforeEach(() => {
    (verifyRsvpToken as jest.Mock).mockReturnValue({ userId: USER, eventId: "ev1" });
    db.user.findUnique.mockResolvedValue({ name: "Marta" });
    db.event.findUnique.mockResolvedValue({
      id: "ev1",
      teamId: TEAM,
      title: "Entreno secreto",
      startDate: new Date("2026-11-01T18:00:00Z"),
      location: "Campo Norte",
      team: { timezone: "Europe/Madrid" },
    });
  });

  test("miembro activo → ve el evento", async () => {
    db.teamMember.findFirst.mockResolvedValue({ isCoach: false });
    const html = await render();
    expect(html).toContain("Entreno secreto");
    expect(html).toContain("Marta");
  });

  test("ex-miembro → lo mismo que un token inválido, sin datos del evento", async () => {
    db.teamMember.findFirst.mockResolvedValue(null);
    const html = await render();
    expect(html).toContain("Link Inválido");
    for (const secret of ["Entreno secreto", "Campo Norte", "Marta"]) expect(html).not.toContain(secret);

    (verifyRsvpToken as jest.Mock).mockReturnValue(null);
    expect(await render()).toBe(html);
  });
});
