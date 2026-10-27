/**
 * @jest-environment node
 */

import { renderToStaticMarkup } from "react-dom/server";
import EventDetailPage from "@/app/events/[id]/page";
import RsvpPage from "@/app/rsvp/[token]/page";
import RpeLinkPage from "@/app/rpe/[token]/page";
import { prisma } from "@/lib/prisma";
import { verifyRsvpToken, verifyRpeToken } from "@/lib/tokens";
import { getActiveMembership } from "@/lib/membership";
import { evaluatePlayerRpe } from "@/lib/rpe-submit";

jest.mock("server-only", () => ({}));
jest.mock("@/auth", () => ({ auth: jest.fn().mockResolvedValue({ user: { id: "u1" } }) }));
jest.mock("next/navigation", () => ({ redirect: jest.fn(), notFound: jest.fn() }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    rpeEntry: { findFirst: jest.fn() },
    discomfort: { findMany: jest.fn() },
  },
}));
jest.mock("@/lib/membership", () => ({ getActiveMembership: jest.fn() }));
jest.mock("@/lib/tokens", () => ({ verifyRsvpToken: jest.fn(), verifyRpeToken: jest.fn() }));
jest.mock("@/lib/rpe-submit", () => ({ evaluatePlayerRpe: jest.fn() }));
jest.mock("@/lib/discomfort-coach", () => ({ getEventDiscomforts: jest.fn().mockResolvedValue([]) }));
jest.mock("@/app/events/[id]/rsvp-control", () => ({ RsvpControl: () => null }));
jest.mock("@/app/rsvp/[token]/rsvp-action", () => ({ RsvpAction: () => null }));
jest.mock("@/components/dashboard/DashboardHeader", () => ({ DashboardHeader: () => null }));
jest.mock("@/components/event/DiscomfortSection", () => ({ DiscomfortSection: () => null }));
jest.mock("@/components/event/CoachDiscomfortList", () => ({ CoachDiscomfortList: () => null }));
jest.mock("@/components/event/NotifyButton", () => ({ NotifyButton: () => null }));
jest.mock("@/components/event/LineupSheet", () => ({ LineupSheet: () => null }));
jest.mock("@/components/training/RpeForm", () => ({ RpeForm: () => null }));

const db = prisma as any;
// Sábado 24 de octubre de 2026, 10:05 UTC = 12:05 en Madrid
const START = new Date("2026-10-24T10:05:00Z");
const EXPECTED_LONG = "Sábado, 24 de octubre a las 12:05 hs";

const event = {
  id: "e1", teamId: "t1", title: "Entreno", type: "TRAINING", startDate: START, endDate: null,
  rsvpDeadline: null, location: null, description: null, callups: [], attendances: [], proposal: null,
  team: { name: "Club", timezone: "Europe/Madrid", rpeLinksAuto: true }, _count: { attendances: 0 },
};

// Elemento <p> que contiene la fecha: debe llevar el texto con solo la inicial en mayúscula y sin la clase capitalize
const paragraphWith = (html: string, text: string) => {
  const m = new RegExp(`<p class="([^"]*)">[^<]*${text}[^<]*</p>`).exec(html);
  expect(m).not.toBeNull();
  return m![1]!;
};

describe("fechas largas: mayúscula solo inicial", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.event.findUnique.mockResolvedValue(event);
    db.rpeEntry.findFirst.mockResolvedValue(null);
    db.discomfort.findMany.mockResolvedValue([]);
    db.user.findUnique.mockResolvedValue({ name: "Ana", healthConsentAt: null, healthConsentVersion: null });
    (getActiveMembership as jest.Mock).mockResolvedValue({ isCoach: false });
  });

  test("/events/[id]", async () => {
    const html = renderToStaticMarkup(await EventDetailPage({ params: Promise.resolve({ id: "e1" }) }));
    expect(html).toContain(EXPECTED_LONG);
    expect(html).toContain("de octubre");
    expect(html).toContain("a las");
    expect(paragraphWith(html, "de octubre")).not.toContain("capitalize");
  });

  test("/rsvp/[token]", async () => {
    (verifyRsvpToken as jest.Mock).mockReturnValue({ userId: "u1", eventId: "e1" });
    const html = renderToStaticMarkup(await RsvpPage({ params: Promise.resolve({ token: "t" }) }));
    expect(html).toContain("Sábado 24 de octubre, 12:05");
    expect(html).toContain("de octubre");
    expect(paragraphWith(html, "de octubre")).not.toContain("capitalize");
  });

  test("/rpe/[token]", async () => {
    (verifyRpeToken as jest.Mock).mockReturnValue({ userId: "u1", eventId: "e1", exp: Date.now() + 1e6, p: "rpe" });
    (evaluatePlayerRpe as jest.Mock).mockResolvedValue({ ok: true, event });
    const html = renderToStaticMarkup(await RpeLinkPage({ params: Promise.resolve({ token: "t" }) }));
    expect(html).toContain("Sábado 24 de octubre, 12:05");
    expect(html).toContain("de octubre");
    expect(paragraphWith(html, "de octubre")).not.toContain("capitalize");
  });
});
