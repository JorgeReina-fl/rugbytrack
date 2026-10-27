/**
 * @jest-environment node
 */

import { rpeRecipientsWhere, countPendingRpe } from "@/lib/rpe-recipients";
import { sendRpeLinks } from "@/lib/rpe-links";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findUnique: jest.fn(), updateMany: jest.fn() },
    attendance: { findMany: jest.fn(), count: jest.fn() },
  },
}));
jest.mock("@/lib/resend", () => ({ sendEmail: jest.fn() }));
jest.mock("@/lib/email-budget", () => ({ trackEmailBudget: jest.fn().mockResolvedValue(true) }));
jest.mock("@/lib/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const db = prisma as any;

test("el contador del panel y los destinatarios de sendRpeLinks usan la misma consulta", async () => {
  const now = new Date("2026-10-27T12:00:00Z");
  db.event.findUnique.mockResolvedValue({
    id: "e1", teamId: "t1", title: "T", type: "TRAINING", rpeLinksSentAt: null,
    startDate: new Date(now.getTime() - 5 * 3600_000), endDate: null,
    team: { timezone: "Europe/Madrid", rpeLinksAuto: true },
  });
  db.event.updateMany.mockResolvedValue({ count: 1 });
  db.attendance.findMany.mockResolvedValue([]);
  db.attendance.count.mockResolvedValue(0);

  await sendRpeLinks("e1", { trigger: "manual", now });
  await countPendingRpe("e1", "t1");

  const recipientsWhere = db.attendance.findMany.mock.calls[0][0].where;
  const countWhere = db.attendance.count.mock.calls[0][0].where;
  expect(countWhere).toEqual(recipientsWhere);
  expect(countWhere).toEqual(rpeRecipientsWhere("e1", "t1"));
  expect(countWhere).toEqual({
    eventId: "e1",
    checkedIn: true,
    user: {
      memberships: { some: { teamId: "t1", leftAt: null, isCoach: false } },
      rpeEntries: { none: { eventId: "e1" } },
    },
  });
});
