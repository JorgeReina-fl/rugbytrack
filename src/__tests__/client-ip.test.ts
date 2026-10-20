/**
 * @jest-environment node
 */

import { getClientIp } from "@/lib/client-ip";

const h = (init: Record<string, string>) => new Headers(init);

describe("getClientIp", () => {
  test("solo X-Real-IP", () => {
    expect(getClientIp(h({ "x-real-ip": "203.0.113.7" }))).toBe("203.0.113.7");
  });

  test("X-Real-IP gana a X-Forwarded-For", () => {
    expect(
      getClientIp(h({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "6.6.6.6, 7.7.7.7" }))
    ).toBe("203.0.113.7");
  });

  test("sin X-Real-IP, usa el último valor de X-Forwarded-For (el añadido por nginx)", () => {
    expect(getClientIp(h({ "x-forwarded-for": "falsa, 203.0.113.9" }))).toBe("203.0.113.9");
    expect(getClientIp(h({ "x-forwarded-for": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  test("sin cabeceras → unknown", () => {
    expect(getClientIp(h({}))).toBe("unknown");
  });
});
