/**
 * @jest-environment node
 */

import { signCronToken, verifyCronToken, signEventToken, verifyEventToken } from "../../prisma/token-core";
import { generateRsvpToken, verifyRsvpToken, generateRpeToken, verifyRpeToken } from "@/lib/tokens";

const SECRET = "test-secret-test-secret-test-secret-123";
const MIN = 60 * 1000;

describe("token cron", () => {
  const original = process.env.NEXTAUTH_SECRET;
  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = SECRET;
  });
  afterEach(() => jest.useRealTimers());
  afterAll(() => {
    process.env.NEXTAUTH_SECRET = original;
  });

  test("ida y vuelta: userId y eventId fijos, p = cron, exp = ahora + 5 min", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-10-27T12:00:00Z"));
    const payload = verifyCronToken(signCronToken("rpe-links-auto"), "rpe-links-auto");
    expect(payload).toEqual({
      userId: "cron",
      eventId: "rpe-links-auto",
      exp: Date.now() + 5 * MIN,
      p: "cron",
    });
  });

  test("caduca a los 5 min", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-10-27T12:00:00Z"));
    const t = signCronToken("rpe-links-auto");
    jest.setSystemTime(Date.now() + 5 * MIN - 1);
    expect(verifyCronToken(t, "rpe-links-auto")).not.toBeNull();
    jest.setSystemTime(Date.now() + 2);
    expect(verifyCronToken(t, "rpe-links-auto")).toBeNull();
  });

  test("con job distinto → inválido", () => {
    expect(verifyCronToken(signCronToken("rpe-links-auto"), "otro-job")).toBeNull();
  });

  test("un token cron no vale como rsvp ni como rpe, y al revés", () => {
    const cron = signCronToken("rpe-links-auto");
    expect(verifyRsvpToken(cron)).toBeNull();
    expect(verifyRpeToken(cron)).toBeNull();
    expect(verifyEventToken(cron, "rsvp")).toBeNull();
    expect(verifyCronToken(generateRsvpToken("cron", "rpe-links-auto"), "rpe-links-auto")).toBeNull();
    expect(verifyCronToken(generateRpeToken("cron", "rpe-links-auto", new Date(Date.now() + 5 * MIN)), "rpe-links-auto")).toBeNull();
  });

  test("un token rpe/rsvp con userId y eventId de cron sigue sin valer", () => {
    const forged = signEventToken({ userId: "cron", eventId: "rpe-links-auto", purpose: "rpe", ttlMs: MIN });
    expect(verifyCronToken(forged, "rpe-links-auto")).toBeNull();
  });
});
