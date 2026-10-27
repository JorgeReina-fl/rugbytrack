/**
 * @jest-environment node
 */

import { POST as createRpeRoute } from "@/app/api/rpe/route";
import { PUT as coachRpeRoute } from "@/app/api/events/[id]/rpe/[userId]/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findUnique: jest.fn() },
    teamMember: { findFirst: jest.fn() },
    attendance: { findFirst: jest.fn() },
    rpeEntry: { create: jest.fn(), findUnique: jest.fn(), upsert: jest.fn() },
  },
}));

const H = 60 * 60 * 1000;
const DAY = 24 * H;
const mockAuth = auth as jest.Mock;
const db = prisma as any;
const EVENT_ID = "cl00000000000000000000000";

// Evento sin endDate que empezó hace `ago` ms: cierra a inicio + 3 h + 48 h = 51 h
const eventStartedAgo = (ago: number) => ({
  id: EVENT_ID,
  teamId: "team-123",
  startDate: new Date(Date.now() - ago),
  attendances: [{ userId: "player-123", status: "CONFIRMED", checkedIn: false }],
  _count: { attendances: 0 },
});

const post = () =>
  createRpeRoute(
    new NextRequest("http://localhost:3000/api/rpe", {
      method: "POST",
      body: JSON.stringify({ eventId: EVENT_ID, rpe: 8, duration: 80 }),
    })
  );

describe("POST /api/rpe — plazo de 48 h", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "player-123", role: "PLAYER" } });
    db.teamMember.findFirst.mockResolvedValue({ isCoach: false });
    db.rpeEntry.findUnique.mockResolvedValue(null);
    db.rpeEntry.create.mockImplementation(({ data }: any) => Promise.resolve({ id: "rpe-1", ...data }));
  });

  test("fuera de plazo con permiso → 403 RPE_WINDOW_CLOSED y no crea", async () => {
    db.event.findUnique.mockResolvedValue(eventStartedAgo(52 * H));
    const res = await post();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "RPE_WINDOW_CLOSED" });
    expect(db.rpeEntry.create).not.toHaveBeenCalled();
  });

  test("dentro de plazo → 201 como hoy", async () => {
    db.event.findUnique.mockResolvedValue(eventStartedAgo(50 * H));
    const res = await post();
    expect(res.status).toBe(201);
    expect(db.rpeEntry.create).toHaveBeenCalledTimes(1);
  });

  test("ya existente y fuera de plazo → 409", async () => {
    db.event.findUnique.mockResolvedValue(eventStartedAgo(60 * H));
    db.rpeEntry.findUnique.mockResolvedValue({ id: "rpe-0" });
    const res = await post();
    expect(res.status).toBe(409);
    expect(db.rpeEntry.create).not.toHaveBeenCalled();
  });

  test("sin permiso (no confirmó asistencia) y fuera de plazo → 403 de asistencia, no el del plazo", async () => {
    const ev = eventStartedAgo(60 * H);
    ev.attendances = [{ userId: "player-123", status: "PENDING", checkedIn: false }];
    db.event.findUnique.mockResolvedValue(ev);
    const res = await post();
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Debes confirmar tu asistencia antes de registrar el RPE");
  });

  test("sin permiso (no es del equipo) y fuera de plazo → mismo 403 de siempre", async () => {
    db.event.findUnique.mockResolvedValue(eventStartedAgo(60 * H));
    db.teamMember.findFirst.mockResolvedValue(null);
    const res = await post();
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("No perteneces al equipo asociado a este evento");
  });
});

describe("PUT /api/events/[id]/rpe/[userId] — el coach no tiene plazo", () => {
  test("a fin + 10 días sigue permitido → 200", async () => {
    mockAuth.mockResolvedValue({ user: { id: "coach-1", role: "PLAYER" } });
    db.event.findUnique.mockResolvedValue({
      id: "ev1",
      teamId: "team-1",
      startDate: new Date(Date.now() - 13 * DAY),
      endDate: new Date(Date.now() - 10 * DAY),
    });
    db.teamMember.findFirst.mockImplementation(({ where }: any) =>
      Promise.resolve(where.userId === "coach-1" ? { isCoach: true } : { isCoach: false })
    );
    db.attendance.findFirst.mockResolvedValue({ checkedIn: true });
    db.rpeEntry.findUnique.mockResolvedValue(null);
    db.rpeEntry.upsert.mockImplementation(({ create }: any) =>
      Promise.resolve({ rpe: create.rpe, duration: create.duration, workload: create.workload, recordedById: create.recordedById, updatedAt: new Date() })
    );

    const res = await coachRpeRoute(
      new Request("http://localhost/api/events/ev1/rpe/player-1", {
        method: "PUT",
        body: JSON.stringify({ rpe: 8, duration: 70 }),
      }),
      { params: Promise.resolve({ id: "ev1", userId: "player-1" }) }
    );
    expect(res.status).toBe(200);
    expect(db.rpeEntry.upsert).toHaveBeenCalled();
  });
});
