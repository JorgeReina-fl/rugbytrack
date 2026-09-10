/**
 * @jest-environment node
 */

import { POST as changePasswordRoute } from "@/app/api/profile/change-password/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

jest.mock("@/auth", () => ({ auth: jest.fn() }));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("argon2", () => ({
  verify: jest.fn(),
  hash: jest.fn(),
  argon2id: 2,
}));

describe("POST /api/profile/change-password", () => {
  const mockAuth = auth as jest.Mock;
  const mockPrisma = prisma as unknown as {
    user: { findUnique: jest.Mock; update: jest.Mock };
  };
  const mockArgon2 = jest.requireMock("argon2") as {
    verify: jest.Mock;
    hash: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function makeRequest(body: object) {
    return new NextRequest("http://localhost:3000/api/profile/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  test("401 cuando el usuario no está autenticado", async () => {
    mockAuth.mockResolvedValue(null);

    const res = await changePasswordRoute(
      makeRequest({ currentPassword: "pass1234", newPassword: "newpass1", confirmPassword: "newpass1" })
    );

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("No autenticado");
  });

  test("400 cuando la contraseña actual es incorrecta", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      passwordHash: "$argon2id$fakehash",
    });
    mockArgon2.verify.mockResolvedValue(false);

    const res = await changePasswordRoute(
      makeRequest({ currentPassword: "wrongpassword", newPassword: "newpass1234", confirmPassword: "newpass1234" })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("La contraseña actual es incorrecta");
  });

  test("422 cuando la nueva contraseña y la confirmación no coinciden", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    const res = await changePasswordRoute(
      makeRequest({ currentPassword: "oldpass123", newPassword: "newpass1234", confirmPassword: "different1234" })
    );
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.error).toBe("Datos inválidos");
  });

  test("422 cuando la nueva contraseña es demasiado corta", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    const res = await changePasswordRoute(
      makeRequest({ currentPassword: "oldpass123", newPassword: "short", confirmPassword: "short" })
    );

    expect(res.status).toBe(422);
  });

  test("200 y actualiza la contraseña cuando todo es correcto", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      passwordHash: "$argon2id$oldhash",
    });
    mockArgon2.verify.mockResolvedValue(true);
    mockArgon2.hash.mockResolvedValue("$argon2id$newhash");
    mockPrisma.user.update.mockResolvedValue({ id: "user-1" });

    const res = await changePasswordRoute(
      makeRequest({ currentPassword: "correctpassword", newPassword: "newpass1234", confirmPassword: "newpass1234" })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.message).toContain("Contraseña actualizada");
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({
          passwordHash: "$argon2id$newhash",
          passwordResetAt: expect.any(Date),
        }),
      })
    );
  });

  test("400 cuando la cuenta no tiene contraseña configurada (OAuth)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-oauth" } });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-oauth",
      passwordHash: null,
    });

    const res = await changePasswordRoute(
      makeRequest({ currentPassword: "anything", newPassword: "newpass1234", confirmPassword: "newpass1234" })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Esta cuenta no tiene contraseña configurada");
  });
});
