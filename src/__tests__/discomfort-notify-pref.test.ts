/**
 * @jest-environment node
 */

import { notifyCoachesOfDiscomfort } from "@/lib/discomfort-notify";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/resend";

jest.mock("@/lib/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock("@/lib/email-budget", () => ({ trackEmailBudget: jest.fn().mockResolvedValue(true) }));
jest.mock("@/lib/resend", () => ({ sendEmail: jest.fn().mockResolvedValue({ data: { id: "m" } }) }));
jest.mock("@/lib/prisma", () => ({ prisma: { teamMember: { findMany: jest.fn() } } }));

const COACHES = [
  { email: "activo@example.test", notifyDiscomforts: true },
  { email: "silenciado@example.test", notifyDiscomforts: false },
];
const findMany = (prisma as any).teamMember.findMany as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  // La BD aplica el filtro de la consulta: simulamos solo el criterio notifyDiscomforts
  findMany.mockImplementation(async ({ where }: any) =>
    COACHES.filter((c) => where.user?.notifyDiscomforts === undefined || c.notifyDiscomforts === where.user.notifyDiscomforts).map((c) => ({ user: { email: c.email } }))
  );
});

describe("notifyCoachesOfDiscomfort — preferencia", () => {
  test("la consulta pide solo coaches activos con notifyDiscomforts = true", async () => {
    await notifyCoachesOfDiscomfort({ id: "e1", teamId: "t1", title: "Partido" });
    expect(findMany.mock.calls[0][0].where).toEqual({ teamId: "t1", isCoach: true, leftAt: null, user: { notifyDiscomforts: true } });
  });

  test("envía al coach con la preferencia activada y no al desactivada", async () => {
    await notifyCoachesOfDiscomfort({ id: "e1", teamId: "t1", title: "Partido" });
    const to = (sendEmail as jest.Mock).mock.calls.map((c) => c[0].to);
    expect(to).toEqual(["activo@example.test"]);
  });

  test("si todos los coaches lo tienen desactivado, no se envía nada", async () => {
    COACHES.forEach((c) => (c.notifyDiscomforts = false));
    await notifyCoachesOfDiscomfort({ id: "e1", teamId: "t1", title: "Partido" });
    expect(sendEmail).not.toHaveBeenCalled();
    COACHES.forEach((c, i) => (c.notifyDiscomforts = i === 0));
  });
});
