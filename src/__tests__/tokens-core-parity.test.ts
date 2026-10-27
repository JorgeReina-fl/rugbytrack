/**
 * @jest-environment node
 */

import { signEventToken } from "../../prisma/token-core";
import { generateRsvpToken, verifyRsvpToken } from "@/lib/tokens";
import { verifyEventToken } from "../../prisma/token-core";

const SECRET = "test-secret-test-secret-test-secret-123";

describe("paridad núcleo compartido (cron) ↔ src/lib/tokens", () => {
  const original = process.env.NEXTAUTH_SECRET;
  beforeAll(() => {
    process.env.NEXTAUTH_SECRET = SECRET;
  });
  afterAll(() => {
    process.env.NEXTAUTH_SECRET = original;
  });

  test("token rsvp firmado por el core (como el cron) lo acepta verifyRsvpToken", () => {
    const t = signEventToken({ userId: "u1", eventId: "e1", purpose: "rsvp", ttlMs: 60_000 });
    expect(verifyRsvpToken(t)).toEqual({ userId: "u1", eventId: "e1" });
    expect(verifyEventToken(t, "rsvp")?.p).toBe("rsvp");
  });

  test("token de generateRsvpToken lo acepta verifyEventToken del core y lleva p:rsvp", () => {
    const t = generateRsvpToken("u1", "e1");
    expect(verifyEventToken(t, "rsvp")).toMatchObject({ userId: "u1", eventId: "e1", p: "rsvp" });
    expect(verifyEventToken(t, "rpe")).toBeNull();
  });
});
