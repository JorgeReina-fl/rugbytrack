/**
 * @jest-environment node
 */

import { generateRsvpToken, verifyRsvpToken } from "@/lib/tokens";

const SECRET = "test-secret-test-secret-test-secret-123";

// Token generado con la implementación anterior (comparación con !==), exp en 2100
const LEGACY_TOKEN =
  "eyJwYXlsb2FkIjoie1widXNlcklkXCI6XCJ1MVwiLFwiZXZlbnRJZFwiOlwiZTFcIixcImV4cFwiOjQxMDI0NDQ4MDAwMDB9IiwiaG1hYyI6IjY0NWRmMzJmMjlmMmIxNGUzZTAyNGE4MjExM2Y4ZGE1MTNhNjY2OThiOTdlNWVlYzMyNzRiMzg1YjA1MzAzN2QifQ";

const decode = (token: string) => JSON.parse(Buffer.from(token, "base64url").toString("utf-8"));
const encode = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64url");

describe("RSVP token", () => {
  const original = process.env.NEXTAUTH_SECRET;
  beforeAll(() => {
    process.env.NEXTAUTH_SECRET = SECRET;
  });
  afterAll(() => {
    process.env.NEXTAUTH_SECRET = original;
  });

  test("token válido recién generado", () => {
    expect(verifyRsvpToken(generateRsvpToken("u1", "e1"))).toEqual({ userId: "u1", eventId: "e1" });
  });

  test("tokens existentes (formato anterior) siguen validando", () => {
    expect(verifyRsvpToken(LEGACY_TOKEN)).toEqual({ userId: "u1", eventId: "e1" });
  });

  test("firma alterada → null", () => {
    const t = decode(LEGACY_TOKEN);
    const flipped = (t.hmac[0] === "a" ? "b" : "a") + t.hmac.slice(1);
    expect(verifyRsvpToken(encode({ ...t, hmac: flipped }))).toBeNull();
  });

  test("firma de otra longitud → null (sin lanzar)", () => {
    const t = decode(LEGACY_TOKEN);
    expect(verifyRsvpToken(encode({ ...t, hmac: t.hmac.slice(0, 10) }))).toBeNull();
    expect(verifyRsvpToken(encode({ ...t, hmac: t.hmac + "00" }))).toBeNull();
  });

  test("firma que no es string → null", () => {
    const t = decode(LEGACY_TOKEN);
    expect(verifyRsvpToken(encode({ ...t, hmac: 123 }))).toBeNull();
  });

  test("base64 corrupto o basura → null", () => {
    expect(verifyRsvpToken("%%%no-es-base64%%%")).toBeNull();
    expect(verifyRsvpToken("x")).toBeNull();
    expect(verifyRsvpToken("")).toBeNull();
  });

  test("token caducado (firma válida) → null", () => {
    jest.useFakeTimers().setSystemTime(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const old = generateRsvpToken("u1", "e1");
    jest.useRealTimers();
    expect(verifyRsvpToken(old)).toBeNull();
  });

  test("payload modificado con la firma original → null", () => {
    const t = decode(LEGACY_TOKEN);
    const forged = JSON.stringify({ ...JSON.parse(t.payload), userId: "u2" });
    expect(verifyRsvpToken(encode({ payload: forged, hmac: t.hmac }))).toBeNull();
  });
});
