/**
 * @jest-environment node
 */

import { renderToStaticMarkup } from "react-dom/server";
import TeamDetailPage from "@/app/teams/[id]/page";
import { requireActiveMembership } from "@/lib/membership";
import { prisma } from "@/lib/prisma";

jest.mock("server-only", () => ({}));
jest.mock("@/auth", () => ({ auth: jest.fn().mockResolvedValue({ user: { id: "u1" } }) }));
jest.mock("@/lib/prisma", () => ({ prisma: { team: { findUnique: jest.fn() } } }));
jest.mock("@/lib/membership", () => ({ requireActiveMembership: jest.fn() }));
jest.mock("next/navigation", () => ({ redirect: jest.fn(), notFound: jest.fn() }));
jest.mock("@/components/dashboard/DashboardHeader", () => ({ DashboardHeader: () => null }));
jest.mock("@/components/teams/TeamRosterClient", () => ({ TeamRosterClient: () => null }));
jest.mock("@/components/teams/TeamSettingsCard", () => ({
  TeamSettingsCard: (p: any) => `[Ajustes team=${p.teamId} auto=${p.rpeLinksAuto}]`,
}));

const render = async () => renderToStaticMarkup(await TeamDetailPage({ params: Promise.resolve({ id: "t1" }) }));

describe("página del equipo — tarjeta Ajustes", () => {
  beforeEach(() => {
    (prisma as any).team.findUnique.mockResolvedValue({
      id: "t1", name: "Club", description: null, inviteToken: "tok", rpeLinksAuto: false, members: [],
    });
  });

  test("coach: recibe el valor actual", async () => {
    (requireActiveMembership as jest.Mock).mockResolvedValue({ isCoach: true });
    expect(await render()).toContain("[Ajustes team=t1 auto=false]");
  });

  test("jugador: sin tarjeta", async () => {
    (requireActiveMembership as jest.Mock).mockResolvedValue({ isCoach: false });
    expect(await render()).not.toContain("Ajustes");
  });
});
