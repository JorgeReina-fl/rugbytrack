/**
 * @jest-environment node
 */

import { generateRpeToken, verifyRpeToken, generateRsvpToken, verifyRsvpToken } from "@/lib/tokens";
import { isPublicPath } from "@/lib/public-paths";

const SECRET = "test-secret-test-secret-test-secret-123";
const H = 60 * 60 * 1000;

describe("generateRpeToken / verifyRpeToken", () => {
  const original = process.env.NEXTAUTH_SECRET;
  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = SECRET;
  });
  afterEach(() => {
    jest.useRealTimers();
  });
  afterAll(() => {
    process.env.NEXTAUTH_SECRET = original;
  });

  test("exp = closesAt, p = rpe", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-10-20T12:00:00Z"));
    const closesAt = new Date(Date.now() + 30 * H);
    const payload = verifyRpeToken(generateRpeToken("u1", "e1", closesAt));
    expect(payload).toEqual({ userId: "u1", eventId: "e1", exp: closesAt.getTime(), p: "rpe" });
  });

  test("lanza si closesAt ya pasó (o es ahora)", () => {
    expect(() => generateRpeToken("u1", "e1", new Date(Date.now() - 1000))).toThrow();
    jest.useFakeTimers().setSystemTime(new Date("2026-10-20T12:00:00Z"));
    expect(() => generateRpeToken("u1", "e1", new Date(Date.now()))).toThrow();
    expect(() => generateRpeToken("u1", "e1", new Date("invalid"))).toThrow();
  });

  test("caduca al llegar a closesAt", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-10-20T12:00:00Z"));
    const t = generateRpeToken("u1", "e1", new Date(Date.now() + H));
    jest.setSystemTime(new Date(Date.now() + H + 1));
    expect(verifyRpeToken(t)).toBeNull();
  });

  test("un token rpe no vale en verifyRsvpToken ni un rsvp en verifyRpeToken", () => {
    const rpe = generateRpeToken("u1", "e1", new Date(Date.now() + H));
    const rsvp = generateRsvpToken("u1", "e1");
    expect(verifyRsvpToken(rpe)).toBeNull();
    expect(verifyRpeToken(rsvp)).toBeNull();
    expect(verifyRpeToken(rpe)).not.toBeNull();
    expect(verifyRsvpToken(rsvp)).not.toBeNull();
  });
});

describe("middleware: rutas públicas", () => {
  test("/api/rpe/link es público; variantes no", () => {
    expect(isPublicPath("/api/rpe/link")).toBe(true);
    expect(isPublicPath("/api/rpe/link/x")).toBe(false);
    expect(isPublicPath("/api/rpe/linkx")).toBe(false);
    expect(isPublicPath("/api/rpe")).toBe(false);
  });
  test("las demás siguen igual", () => {
    expect(isPublicPath("/api/rsvp")).toBe(true);
    expect(isPublicPath("/api/rsvp/x")).toBe(false);
    expect(isPublicPath("/events")).toBe(false);
  });
});
