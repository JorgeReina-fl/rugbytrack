/**
 * @jest-environment node
 */

import crypto from "crypto";
import {
  generateRsvpToken,
  verifyRsvpToken,
  signEventToken,
  verifyEventToken,
} from "@/lib/tokens";

const SECRET = "test-secret-test-secret-test-secret-123";
const DAY = 24 * 60 * 60 * 1000;

const decode = (token: string) => JSON.parse(Buffer.from(token, "base64url").toString("utf-8"));
const encode = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64url");

// Token RSVP en el formato anterior (sin p), construido como lo hacía el código antiguo
function legacyRsvp(exp = Date.now() + 7 * DAY): string {
  const payloadStr = JSON.stringify({ userId: "u1", eventId: "e1", exp });
  const hmac = crypto.createHmac("sha256", SECRET).update(payloadStr).digest("hex");
  return encode({ payload: payloadStr, hmac });
}

const rpe = () => signEventToken({ userId: "u1", eventId: "e1", purpose: "rpe", ttlMs: DAY });

describe("tokens con propósito", () => {
  const original = process.env.NEXTAUTH_SECRET;
  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = SECRET;
  });
  afterAll(() => {
    process.env.NEXTAUTH_SECRET = original;
  });

  test("a) RSVP antiguo sin p: vale como rsvp, no como rpe", () => {
    const t = legacyRsvp();
    expect(verifyRsvpToken(t)).toEqual({ userId: "u1", eventId: "e1" });
    expect(verifyEventToken(t, "rpe")).toBeNull();
  });

  test("b) RSVP nuevo: ida y vuelta, y rechazado como rpe", () => {
    const t = generateRsvpToken("u1", "e1");
    expect(verifyRsvpToken(t)).toEqual({ userId: "u1", eventId: "e1" });
    expect(verifyEventToken(t, "rsvp")?.p).toBe("rsvp");
    expect(verifyEventToken(t, "rpe")).toBeNull();
  });

  test("b) RSVP nuevo caduca a los 7 días", () => {
    const t = generateRsvpToken("u1", "e1");
    const { exp } = verifyEventToken(t, "rsvp")!;
    expect(exp - Date.now()).toBeGreaterThan(7 * DAY - 5000);
    expect(exp - Date.now()).toBeLessThanOrEqual(7 * DAY);
  });

  test("c) rpe: ida y vuelta, y rechazado por verifyRsvpToken", () => {
    const t = rpe();
    expect(verifyEventToken(t, "rpe")).toMatchObject({ userId: "u1", eventId: "e1", p: "rpe" });
    expect(verifyRsvpToken(t)).toBeNull();
    expect(verifyEventToken(t, "rsvp")).toBeNull();
  });

  test("d) rpe con p quitada o cambiada sin re-firmar → rechazado como rpe y como rsvp", () => {
    const t = decode(rpe());
    const orig = JSON.parse(t.payload);

    const sinP = { ...orig };
    delete sinP.p;
    const quitada = encode({ payload: JSON.stringify(sinP), hmac: t.hmac });
    const cambiada = encode({ payload: JSON.stringify({ ...orig, p: "rsvp" }), hmac: t.hmac });

    for (const forged of [quitada, cambiada]) {
      expect(verifyEventToken(forged, "rpe")).toBeNull();
      expect(verifyEventToken(forged, "rsvp")).toBeNull();
      expect(verifyRsvpToken(forged)).toBeNull();
    }
  });

  test("e) caducado, firma alterada, longitud distinta, basura y base64url inválido → null", () => {
    jest.useFakeTimers().setSystemTime(Date.now() - 2 * DAY);
    const caducado = rpe();
    jest.useRealTimers();
    expect(verifyEventToken(caducado, "rpe")).toBeNull();
    expect(verifyEventToken(legacyRsvp(Date.now() - 1000), "rsvp")).toBeNull();

    const t = decode(rpe());
    const flipped = (t.hmac[0] === "a" ? "b" : "a") + t.hmac.slice(1);
    expect(verifyEventToken(encode({ ...t, hmac: flipped }), "rpe")).toBeNull();
    expect(verifyEventToken(encode({ ...t, hmac: t.hmac.slice(0, 10) }), "rpe")).toBeNull();
    expect(verifyEventToken(encode({ ...t, hmac: t.hmac + "00" }), "rpe")).toBeNull();
    expect(verifyEventToken(encode({ ...t, hmac: 123 }), "rpe")).toBeNull();

    for (const junk of ["", "x", "%%%no-es-base64%%%", "!!!", encode("texto"), encode(null), encode({})]) {
      expect(verifyEventToken(junk, "rpe")).toBeNull();
      expect(verifyEventToken(junk, "rsvp")).toBeNull();
    }
  });

  test.each([undefined, "", "corto-menos-de-32-caracteres"])(
    "f) secreto %p → error al firmar y al verificar",
    (secret) => {
      const valid = rpe();
      if (secret === undefined) delete process.env.NEXTAUTH_SECRET;
      else process.env.NEXTAUTH_SECRET = secret;
      expect(() => rpe()).toThrow();
      expect(() => generateRsvpToken("u1", "e1")).toThrow();
      expect(() => verifyEventToken(valid, "rpe")).toThrow();
      expect(() => verifyRsvpToken(valid)).toThrow();
    },
  );
});
