/**
 * @jest-environment node
 */

// Los logs de los envíos de email nunca llevan email ni nombre del destinatario, ni en éxito ni en error.
const EMAIL = "jugador.secreto@example.test";
const NAME = "Nombre Secreto";
const COACH_EMAIL = "coach.secreto@example.test";

const logCalls: unknown[][] = [];
const record = (...a: unknown[]) => void logCalls.push(a);
jest.mock("@/lib/logger", () => ({
  logger: {
    info: (...a: unknown[]) => record(...a),
    warn: (...a: unknown[]) => record(...a),
    error: (...a: unknown[]) => record(...a),
    debug: (...a: unknown[]) => record(...a),
  },
}));

const mockBatchSend = jest.fn();
const sendEmail = jest.fn();
jest.mock("@/lib/resend", () => ({ resend: { batch: { send: (...a: unknown[]) => mockBatchSend(...a) } }, sendEmail: (...a: unknown[]) => sendEmail(...a) }));
jest.mock("@/lib/email-budget", () => ({ trackEmailBudget: jest.fn().mockResolvedValue(true) }));
jest.mock("@/lib/tokens", () => ({ generateRsvpToken: () => "tok" }));
jest.mock("@react-email/components", () => ({ render: async () => "<html/>" }));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findUnique: jest.fn() },
    attendance: { findMany: jest.fn() },
    user: { findMany: jest.fn(), findUnique: jest.fn() },
    teamMember: { findMany: jest.fn() },
  },
}));

const mockCreateResetToken = jest.fn().mockReturnValue("t");
const mockSendResetEmail = jest.fn();
jest.mock("@mivia/auth-reset", () => ({
  mockCreateResetToken: (...a: unknown[]) => mockCreateResetToken(...a),
  mockSendResetEmail: (...a: unknown[]) => mockSendResetEmail(...a),
}));
jest.mock("@/lib/rate-limit", () => ({ checkRateLimit: jest.fn().mockResolvedValue({ allowed: true, resetInSeconds: 0 }) }));
jest.mock("@/lib/client-ip", () => ({ getClientIp: () => "1.2.3.4" }));

import { prisma } from "@/lib/prisma";
import { sendRsvpNotifications } from "@/lib/rsvp-notify";
import { notifyLineupChanges } from "@/lib/lineup-notify";
import { notifyCoachesOfDiscomfort } from "@/lib/discomfort-notify";
import { POST as forgotPassword } from "@/app/api/auth/forgot-password/route";
import { handleUnknownError } from "@/lib/api-response";

const db = prisma as any;
const logged = () => JSON.stringify(logCalls);
const expectNoPii = () => {
  expect(logCalls.length).toBeGreaterThan(0);
  const out = logged();
  for (const pii of [EMAIL, NAME, COACH_EMAIL, "jugador.secreto", "Nombre"]) expect(out).not.toContain(pii);
  expect(out).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/);
};

beforeEach(() => {
  logCalls.length = 0;
  jest.clearAllMocks();
  process.env.AUTH_RESET_SECRET = "s";
  process.env.SMTP_HOST = "h";
  process.env.SMTP_USER = "u";
  process.env.SMTP_PASS = "p";
  db.event.findUnique.mockResolvedValue({ id: "e1", teamId: "t1", title: "Partido", startDate: new Date(Date.now() + 1e8), location: null, team: { timezone: "Europe/Madrid" } });
  db.attendance.findMany.mockResolvedValue([{ user: { id: "u1", email: EMAIL, name: NAME } }]);
  db.user.findMany.mockResolvedValue([{ id: "u1", email: EMAIL, name: NAME }]);
  db.teamMember.findMany.mockResolvedValue([{ user: { email: COACH_EMAIL } }]);
  db.user.findUnique.mockResolvedValue({ id: "u1", email: EMAIL, name: NAME });
  sendEmail.mockResolvedValue({ data: { id: "m1" } });
});

describe("logs sin datos personales en los envíos de email", () => {
  test("rsvp-notify: envío correcto", async () => {
    mockBatchSend.mockResolvedValue({ data: { data: [{ id: "m1" }] }, error: null });
    await sendRsvpNotifications("e1");
    expectNoPii();
  });

  test("rsvp-notify: error del proveedor con el destinatario en el mensaje", async () => {
    mockBatchSend.mockResolvedValue({ data: null, error: { name: "validation_error", message: `Invalid to: ${EMAIL} (${NAME})`, statusCode: 422 } });
    await sendRsvpNotifications("e1");
    expectNoPii();
    expect(logged()).toContain("validation_error");
  });

  test("lineup-notify: aviso de cambio y fallo", async () => {
    await notifyLineupChanges({ id: "e1", title: "Partido" }, { entered: [], left: [], changed: [{ userId: "u1", description: "Suplente (n.º 9)" }] });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: EMAIL })); // el email sí se envía
    logCalls.length = 0;
    sendEmail.mockRejectedValue(new Error(`SMTP rechazó ${EMAIL} (${NAME})`));
    await notifyLineupChanges({ id: "e1", title: "Partido" }, { entered: [], left: ["u1"], changed: [] });
    expectNoPii();
  });

  test("discomfort-notify: fallo del envío", async () => {
    sendEmail.mockRejectedValue(new Error(`rechazado ${COACH_EMAIL}`));
    await notifyCoachesOfDiscomfort({ id: "e1", teamId: "t1", title: "Partido" });
    expectNoPii();
  });

  const post = (email: string) =>
    forgotPassword(new Request("http://x/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }));

  test("forgot-password: email enviado, fallo de envío y email desconocido", async () => {
    mockSendResetEmail.mockResolvedValue(undefined);
    await post(EMAIL);
    mockSendResetEmail.mockRejectedValue(new Error(`550 no such user ${EMAIL}`));
    await post(EMAIL);
    db.user.findUnique.mockResolvedValue(null);
    await post("otro.secreto@example.test");
    expectNoPii();
    expect(logged()).not.toContain("otro.secreto");
  });

  test("api-response: el error inesperado solo registra nombre/código, no el mensaje", () => {
    const err = Object.assign(new Error(`Unique constraint failed on email = ${EMAIL}`), { name: "PrismaClientKnownRequestError", code: "P2002" });
    handleUnknownError(err, "ctx");
    expectNoPii();
    expect(logged()).toContain("P2002");
  });
});
