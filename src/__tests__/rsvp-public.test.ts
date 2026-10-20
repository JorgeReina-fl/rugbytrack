/**
 * @jest-environment node
 */

import { POST } from "@/app/api/rsvp/route";
import { prisma } from "@/lib/prisma";
import { verifyRsvpToken } from "@/lib/tokens";
import { rsvpErrorMessage } from "@/lib/rsvp-messages";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findUnique: jest.fn() },
    teamMember: { findFirst: jest.fn() },
    attendance: { updateMany: jest.fn() },
  },
}));

jest.mock("@/lib/tokens", () => ({ verifyRsvpToken: jest.fn() }));

const db = prisma as any;
const verify = verifyRsvpToken as jest.Mock;

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/rsvp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );

const future = new Date(Date.now() + 86400000);

describe("POST /api/rsvp (token)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verify.mockReturnValue({ userId: "u1", eventId: "e1" });
    db.event.findUnique.mockResolvedValue({ teamId: "t1", startDate: future, rsvpDeadline: null });
    db.teamMember.findFirst.mockResolvedValue({ id: "m1" });
    db.attendance.updateMany.mockResolvedValue({ count: 1 });
  });

  test("400 con body vacío o no JSON, siempre JSON", async () => {
    for (const b of ["", "no-json", {}, { token: "x", status: "PENDING" }]) {
      const res = await post(b);
      expect(res.status).toBe(400);
      expect(res.headers.get("content-type")).toContain("application/json");
    }
  });

  test("401 con token inválido", async () => {
    verify.mockReturnValue(null);
    const res = await post({ token: "x", status: "CONFIRMED" });
    expect(res.status).toBe(401);
    expect(db.attendance.updateMany).not.toHaveBeenCalled();
  });

  test("403 si ya no es miembro activo", async () => {
    db.teamMember.findFirst.mockResolvedValue(null);
    const res = await post({ token: "x", status: "CONFIRMED" });
    expect(res.status).toBe(403);
    expect(db.teamMember.findFirst.mock.calls[0][0].where.leftAt).toBeNull();
    expect(db.attendance.updateMany).not.toHaveBeenCalled();
  });

  test("409 con plazo vencido o evento empezado", async () => {
    db.event.findUnique.mockResolvedValue({ teamId: "t1", startDate: future, rsvpDeadline: new Date(Date.now() - 1000) });
    expect((await post({ token: "x", status: "DECLINED" })).status).toBe(409);
    db.event.findUnique.mockResolvedValue({ teamId: "t1", startDate: new Date(Date.now() - 1000), rsvpDeadline: null });
    expect((await post({ token: "x", status: "DECLINED" })).status).toBe(409);
    expect(db.attendance.updateMany).not.toHaveBeenCalled();
  });

  test("404 sin convocatoria", async () => {
    db.attendance.updateMany.mockResolvedValue({ count: 0 });
    expect((await post({ token: "x", status: "CONFIRMED" })).status).toBe(404);
  });

  test("200 solo escribe status, sin tocar checkedIn", async () => {
    const res = await post({ token: "x", status: "DECLINED" });
    expect(res.status).toBe(200);
    expect(db.attendance.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", eventId: "e1" },
      data: { status: "DECLINED" },
    });
  });
});

describe("rsvpErrorMessage", () => {
  test("mapea códigos a mensajes en español", () => {
    expect(rsvpErrorMessage(401)).toBe("El enlace no es válido o ha caducado");
    expect(rsvpErrorMessage(409)).toBe("El plazo para responder ha terminado");
    expect(rsvpErrorMessage(403)).toBe("Ya no formas parte del equipo");
    expect(rsvpErrorMessage(500)).toMatch(/No se pudo guardar/);
    expect(rsvpErrorMessage(null)).toMatch(/No se pudo guardar/);
  });
});
