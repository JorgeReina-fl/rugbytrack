/**
 * @jest-environment node
 */

import { PATCH } from "@/app/api/profile/notifications/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/prisma", () => ({ prisma: { user: { update: jest.fn() } } }));

const db = prisma as unknown as { user: { update: jest.Mock } };
const patch = (body: unknown) => PATCH(new Request("http://x/api/profile/notifications", { method: "PATCH", body: JSON.stringify(body) }));

describe("PATCH /api/profile/notifications — notifyDiscomforts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue({ user: { id: "u1" } });
    db.user.update.mockResolvedValue({});
  });

  test("guarda la preferencia del propio usuario", async () => {
    const res = await patch({ notifyDiscomforts: false });
    expect(res.status).toBe(200);
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { notifyDiscomforts: false } });
  });

  test("valor no booleano → 422 sin escribir", async () => {
    const res = await patch({ notifyDiscomforts: "no" });
    expect(res.status).toBe(422);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  test("sin sesión → 401", async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    expect((await patch({ notifyDiscomforts: false })).status).toBe(401);
    expect(db.user.update).not.toHaveBeenCalled();
  });
});
