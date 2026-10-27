/**
 * @jest-environment node
 */

import { PATCH } from "@/app/api/teams/[id]/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock("@/lib/prisma", () => ({
  prisma: { teamMember: { findFirst: jest.fn() }, team: { update: jest.fn() } },
}));

const db = prisma as any;
const patch = (body: unknown) =>
  PATCH(new Request("http://localhost/api/teams/t1", { method: "PATCH", body: JSON.stringify(body) }), {
    params: Promise.resolve({ id: "t1" }),
  });

describe("PATCH /api/teams/[id] — rpeLinksAuto", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue({ user: { id: "coach-1" } });
    // getCoachMembership filtra isCoach y leftAt: solo un coach activo devuelve fila
    db.teamMember.findFirst.mockResolvedValue({ id: "m1", isCoach: true });
    db.team.update.mockImplementation(({ data }: any) => Promise.resolve({ id: "t1", ...data }));
  });

  test.each([true, false])("coach guarda rpeLinksAuto=%s", async (value) => {
    const res = await patch({ rpeLinksAuto: value });
    expect(res.status).toBe(200);
    expect(db.team.update).toHaveBeenCalledWith({ where: { id: "t1" }, data: { rpeLinksAuto: value } });
    expect((await res.json()).data.rpeLinksAuto).toBe(value);
  });

  test("la búsqueda de permisos exige coach activo del equipo", async () => {
    await patch({ rpeLinksAuto: true });
    expect(db.teamMember.findFirst).toHaveBeenCalledWith({
      where: { userId: "coach-1", teamId: "t1", isCoach: true, leftAt: null },
    });
  });

  test("jugador, no miembro y ex-miembro (sin fila de coach activo) → 403 y no escribe", async () => {
    db.teamMember.findFirst.mockResolvedValue(null);
    const res = await patch({ rpeLinksAuto: false });
    expect(res.status).toBe(403);
    expect(db.team.update).not.toHaveBeenCalled();
  });

  test("sin sesión → 401", async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    expect((await patch({ rpeLinksAuto: false })).status).toBe(401);
  });

  test.each(["true", 1, null, "no"])("valor no booleano %p → 422 de validación y no escribe", async (value) => {
    const res = await patch({ rpeLinksAuto: value });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("Datos inválidos");
    expect(db.team.update).not.toHaveBeenCalled();
  });

  test("PATCH solo con name sigue igual y no toca rpeLinksAuto", async () => {
    const res = await patch({ name: "Club Norte" });
    expect(res.status).toBe(200);
    expect(db.team.update).toHaveBeenCalledWith({ where: { id: "t1" }, data: { name: "Club Norte" } });
    expect(db.team.update.mock.calls[0][0].data).not.toHaveProperty("rpeLinksAuto");
  });

  test("claves desconocidas se ignoran como hasta ahora", async () => {
    await patch({ rpeLinksAuto: true, timezone: "Asia/Tokyo", inviteToken: "x" });
    expect(db.team.update.mock.calls[0][0].data).toEqual({ rpeLinksAuto: true });
  });

  test("log: solo teamId y nombres de campo, nunca valores", async () => {
    await patch({ name: "Club Secreto SA", description: "Descripción privada", rpeLinksAuto: false });
    const logged = JSON.stringify((logger.info as jest.Mock).mock.calls);
    expect(logged).toContain('"teamId":"t1"');
    expect(logged).toContain('"fields":["name","description","rpeLinksAuto"]');
    expect(logged).not.toContain("Secreto");
    expect(logged).not.toContain("privada");
    expect(logged).not.toContain("coach-1");
  });
});
