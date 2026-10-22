/**
 * @jest-environment node
 */

// El cron se importa con Prisma y fetch mockeados: no hay BD ni red ni correos reales.
const mockEventFindMany = jest.fn();
const mockAttendanceFindMany = jest.fn();
const mockUpdateMany = jest.fn();
const mockDisconnect = jest.fn();

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    event: { findMany: (...a: unknown[]) => mockEventFindMany(...a) },
    attendance: { findMany: (...a: unknown[]) => mockAttendanceFindMany(...a), updateMany: (...a: unknown[]) => mockUpdateMany(...a) },
    $disconnect: (...a: unknown[]) => mockDisconnect(...a),
  })),
}));

const fetchMock = jest.fn();

async function runCron() {
  jest.resetModules();
  mockDisconnect.mockClear();
  await new Promise<void>((resolve) => {
    mockDisconnect.mockImplementation(async () => resolve());
    require("../../prisma/send-rsvp-reminders");
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.RESEND_API_KEY = "re_fake";
  process.env.NEXTAUTH_SECRET = "x".repeat(40);
  (global as any).fetch = fetchMock;
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: [{ id: "m1" }] }) });
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  mockEventFindMany.mockResolvedValue([{ id: "e1", teamId: "t1", title: "Partido", startDate: new Date(Date.now() + 24 * 3600_000), location: null, team: { timezone: "Europe/Madrid" } }]);
  mockAttendanceFindMany.mockResolvedValue([{ user: { id: "u1", email: "a@example.test", name: "A" } }]);
  mockUpdateMany.mockResolvedValue({ count: 1 });
});

describe("cron de recordatorios RSVP — preferencia", () => {
  test("la consulta de destinatarios exige notifyRsvpReminders = true y conserva el resto de filtros", async () => {
    await runCron();
    expect(mockAttendanceFindMany).toHaveBeenCalledTimes(1);
    expect(mockAttendanceFindMany.mock.calls[0][0].where).toEqual({
      eventId: "e1",
      status: "PENDING",
      reminderSentAt: null,
      user: { notifyRsvpReminders: true, memberships: { some: { teamId: "t1", leftAt: null } } },
    });
  });

  test("solo se envía a los devueltos por esa consulta (una llamada a Resend, sin consultas por jugador)", async () => {
    await runCron();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toHaveLength(1);
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
  });

  test("si todos tienen el aviso desactivado, no hay envío", async () => {
    mockAttendanceFindMany.mockResolvedValue([]);
    await runCron();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });
});
