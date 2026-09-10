/**
 * @jest-environment node
 */

import { POST as createPoll } from "@/app/api/teams/[id]/polls/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

jest.mock("@/auth", () => ({ auth: jest.fn() }));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    teamMember: { findFirst: jest.fn() },
    poll: { create: jest.fn() },
    team: { findUnique: jest.fn() },
  },
}));

jest.mock("@/lib/resend", () => ({
  sendPollNotification: jest.fn().mockResolvedValue(undefined),
}));

// sendPollNotification is imported inside the route module — grab from the mock
const { sendPollNotification } = jest.requireMock("@/lib/resend") as {
  sendPollNotification: jest.Mock;
};

describe("Preferencias de notificación — filtrado de batch de encuestas", () => {
  const mockAuth = auth as jest.Mock;
  const mockPrisma = prisma as unknown as {
    teamMember: { findFirst: jest.Mock };
    poll: { create: jest.Mock };
    team: { findUnique: jest.Mock };
  };

  const VALID_CUID = "clxxxxxxxxxxxxxxxxxxxxxx";

  beforeEach(() => jest.clearAllMocks());

  function makeRequest(teamId: string) {
    return new NextRequest(`http://localhost/api/teams/${teamId}/polls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "¿Entrenamos el sábado?",
        options: ["Sí", "No"],
      }),
    });
  }

  test("excluye a miembros con notifyPolls=false del batch", async () => {
    mockAuth.mockResolvedValue({ user: { id: "coach-1", name: "Entrenador" } });

    mockPrisma.teamMember.findFirst.mockResolvedValue({ isCoach: true });

    mockPrisma.poll.create.mockResolvedValue({
      id: VALID_CUID,
      title: "¿Entrenamos el sábado?",
      teamId: "team-1",
      options: [],
      createdBy: { name: "Entrenador", image: null },
    });

    // Alice (notifyPolls=true) debe recibir, Bob (notifyPolls=false) NO
    mockPrisma.team.findUnique.mockResolvedValue({
      name: "Equipo Rugby Test",
      members: [
        { user: { email: "alice@test.com", name: "Alice", notifyPolls: true } },
        { user: { email: "bob@test.com", name: "Bob", notifyPolls: false } },
      ],
    });

    const res = await createPoll(makeRequest("team-1"), {
      params: Promise.resolve({ id: "team-1" }),
    });

    // Flush the fire-and-forget promise chain (.then inside the route)
    await new Promise((r) => setImmediate(r));

    expect(res.status).toBe(200);
    expect(sendPollNotification).toHaveBeenCalledTimes(1);

    const { members } = sendPollNotification.mock.calls[0][0] as { members: { email: string }[] };
    expect(members).toHaveLength(1);
    expect(members[0]!.email).toBe("alice@test.com");
    expect(members.find((m) => m.email === "bob@test.com")).toBeUndefined();
  });

  test("envía a todos cuando todos tienen notifyPolls=true", async () => {
    mockAuth.mockResolvedValue({ user: { id: "coach-1", name: "Entrenador" } });
    mockPrisma.teamMember.findFirst.mockResolvedValue({ isCoach: true });
    mockPrisma.poll.create.mockResolvedValue({
      id: VALID_CUID,
      title: "¿Partido en casa?",
      teamId: "team-1",
      options: [],
      createdBy: { name: "Entrenador", image: null },
    });
    mockPrisma.team.findUnique.mockResolvedValue({
      name: "Equipo Rugby Test",
      members: [
        { user: { email: "alice@test.com", name: "Alice", notifyPolls: true } },
        { user: { email: "carlos@test.com", name: "Carlos", notifyPolls: true } },
      ],
    });

    await createPoll(makeRequest("team-1"), {
      params: Promise.resolve({ id: "team-1" }),
    });
    await new Promise((r) => setImmediate(r));

    const { members } = sendPollNotification.mock.calls[0][0] as { members: { email: string }[] };
    expect(members).toHaveLength(2);
  });

  test("no llama a sendPollNotification si todos tienen notifyPolls=false", async () => {
    mockAuth.mockResolvedValue({ user: { id: "coach-1", name: "Entrenador" } });
    mockPrisma.teamMember.findFirst.mockResolvedValue({ isCoach: true });
    mockPrisma.poll.create.mockResolvedValue({
      id: VALID_CUID,
      title: "¿Viaje de equipo?",
      teamId: "team-1",
      options: [],
      createdBy: { name: "Entrenador", image: null },
    });
    mockPrisma.team.findUnique.mockResolvedValue({
      name: "Equipo Rugby Test",
      members: [
        { user: { email: "alice@test.com", name: "Alice", notifyPolls: false } },
        { user: { email: "bob@test.com", name: "Bob", notifyPolls: false } },
      ],
    });

    await createPoll(makeRequest("team-1"), {
      params: Promise.resolve({ id: "team-1" }),
    });
    await new Promise((r) => setImmediate(r));

    // sendPollNotification recibe members=[] → resend.ts lo omite por members.length===0
    const { members } = sendPollNotification.mock.calls[0][0] as { members: { email: string }[] };
    expect(members).toHaveLength(0);
  });
});
