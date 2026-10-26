/**
 * @jest-environment node
 */

import { markConfirmedPresent } from "@/lib/attendance-write";
import { POST } from "@/app/api/events/[id]/attendance/confirmed-present/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findUnique: jest.fn() },
    teamMember: { findFirst: jest.fn() },
    attendance: { findMany: jest.fn(), updateMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

const db = prisma as any;
const TEAM = "team1";

type Row = { userId: string; status: string; checkedIn: boolean; checkedInAt: Date | null };
type Member = { userId: string; leftAt: Date | null; isCoach: boolean };

/** BD en memoria que interpreta solo los filtros que usa markConfirmedPresent. */
function fakeDb(rows: Row[], members: Member[]) {
  const matches = (r: Row, where: any) => {
    if (where.status && r.status !== where.status) return false;
    if (where.checkedIn !== undefined && r.checkedIn !== where.checkedIn) return false;
    if (where.userId?.in && !where.userId.in.includes(r.userId)) return false;
    const some = where.user?.memberships?.some;
    if (some && !members.some((m) => m.userId === r.userId && m.leftAt === some.leftAt && m.isCoach === some.isCoach)) return false;
    return true;
  };
  db.event.findUnique.mockResolvedValue({ teamId: TEAM });
  db.attendance.findMany.mockImplementation(async ({ where }: any) => rows.filter((r) => matches(r, where)).map((r) => ({ ...r })));
  db.attendance.updateMany.mockImplementation(async ({ where, data }: any) => {
    const hit = rows.filter((r) => matches(r, where));
    hit.forEach((r) => Object.assign(r, data));
    return { count: hit.length };
  });
  db.$transaction.mockImplementation((cb: (tx: unknown) => unknown) => cb(prisma));
}

const row = (userId: string, status: string, checkedIn = false): Row => ({
  userId,
  status,
  checkedIn,
  checkedInAt: checkedIn ? new Date("2026-01-01T10:00:00Z") : null,
});

beforeEach(() => jest.clearAllMocks());

describe("markConfirmedPresent", () => {
  const members: Member[] = [
    { userId: "c1", leftAt: null, isCoach: false },
    { userId: "c2", leftAt: null, isCoach: false },
    { userId: "d1", leftAt: null, isCoach: false },
    { userId: "p1", leftAt: null, isCoach: false },
    { userId: "ya", leftAt: null, isCoach: false },
    { userId: "ex", leftAt: new Date(), isCoach: false },
    { userId: "co", leftAt: null, isCoach: true },
  ];
  const mk = () => [
    row("c1", "CONFIRMED"), row("c2", "CONFIRMED"), row("d1", "DECLINED"), row("p1", "PENDING"),
    row("ya", "CONFIRMED", true), row("ex", "CONFIRMED"), row("co", "CONFIRMED"),
  ];

  test("marca solo CONFIRMED sin check-in, activos y no coaches; no cambia status; fija checkedInAt", async () => {
    const rows = mk();
    fakeDb(rows, members);
    const before = Date.now();
    const res = await markConfirmedPresent("e1");
    expect(res.marked).toBe(2);
    expect(res.attendances.map((a: Row) => a.userId).sort()).toEqual(["c1", "c2"]);
    const by = Object.fromEntries(rows.map((r) => [r.userId, r])) as Record<string, Row>;
    for (const id of ["c1", "c2"]) {
      expect(by[id]!.checkedIn).toBe(true);
      expect(by[id]!.status).toBe("CONFIRMED");
      expect(by[id]!.checkedInAt!.getTime()).toBeGreaterThanOrEqual(before);
    }
    // Intactos: DECLINED, PENDING, ya presente (conserva su hora), ex-miembro y coach
    expect(by.d1).toMatchObject({ status: "DECLINED", checkedIn: false });
    expect(by.p1).toMatchObject({ status: "PENDING", checkedIn: false });
    expect(by.ya!.checkedInAt).toEqual(new Date("2026-01-01T10:00:00Z"));
    expect(by.ex!.checkedIn).toBe(false);
    expect(by.co!.checkedIn).toBe(false);
  });

  test("el update solo escribe checkedIn/checkedInAt y va dentro de una transacción", async () => {
    fakeDb(mk(), members);
    await markConfirmedPresent("e1");
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(Object.keys(db.attendance.updateMany.mock.calls[0][0].data).sort()).toEqual(["checkedIn", "checkedInAt"]);
  });

  test("idempotente: la segunda llamada marca 0 y no escribe", async () => {
    fakeDb(mk(), members);
    await markConfirmedPresent("e1");
    db.attendance.updateMany.mockClear();
    const second = await markConfirmedPresent("e1");
    expect(second).toEqual({ marked: 0, attendances: [] });
    expect(db.attendance.updateMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/events/[id]/attendance/confirmed-present", () => {
  const call = () => POST(new Request("http://localhost/x", { method: "POST" }), { params: Promise.resolve({ id: "e1" }) });

  beforeEach(() => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: "coach" } });
    db.event.findUnique.mockResolvedValue({ teamId: TEAM });
    db.teamMember.findFirst.mockResolvedValue({ isCoach: true });
    db.$transaction.mockImplementation((cb: (tx: unknown) => unknown) => cb(prisma));
    db.attendance.findMany.mockResolvedValue([]);
  });

  test("sin sesión → 401 (el 307 al login lo da el middleware antes de llegar a la ruta)", async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    expect((await call()).status).toBe(401);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  test("evento inexistente, no miembro y ex-miembro → mismo 404, sin escribir", async () => {
    db.event.findUnique.mockResolvedValueOnce(null);
    const missing = await call();
    db.teamMember.findFirst.mockResolvedValue(null); // getActiveMembership filtra leftAt: null
    const outsider = await call();
    expect(missing.status).toBe(404);
    expect(outsider.status).toBe(404);
    expect(await outsider.json()).toEqual({ error: "Evento no encontrado" });
    expect(db.teamMember.findFirst.mock.calls[0][0].where).toMatchObject({ userId: "coach", teamId: TEAM, leftAt: null });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  test("jugador no coach → 403 (misma convención que la marca individual)", async () => {
    db.teamMember.findFirst.mockResolvedValue({ isCoach: false });
    expect((await call()).status).toBe(403);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  test("coach → 200 con {marked, attendances}; sin ventana temporal (evento ya terminado también)", async () => {
    // Evento terminado: la ruta no consulta fechas, igual que PATCH /attendance/[userId]
    db.event.findUnique.mockResolvedValue({ teamId: TEAM, startDate: new Date(0), endDate: new Date(1) });
    const at = new Date("2026-10-22T16:00:00Z");
    db.attendance.findMany
      .mockResolvedValueOnce([{ userId: "u1" }, { userId: "u2" }])
      .mockResolvedValueOnce([
        { userId: "u1", status: "CONFIRMED", checkedIn: true, checkedInAt: at },
        { userId: "u2", status: "CONFIRMED", checkedIn: true, checkedInAt: at },
      ]);
    db.attendance.updateMany.mockResolvedValue({ count: 2 });
    const res = await call();
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({
      marked: 2,
      attendances: [
        { userId: "u1", status: "CONFIRMED", checkedIn: true, checkedInAt: at.toISOString() },
        { userId: "u2", status: "CONFIRMED", checkedIn: true, checkedInAt: at.toISOString() },
      ],
    });
  });

  test("sin confirmados pendientes → 200 {marked: 0}", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ marked: 0, attendances: [] });
  });

  test("error inesperado → 500 JSON", async () => {
    db.$transaction.mockRejectedValue(new Error("boom"));
    const res = await call();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Error interno del servidor" });
  });
});
