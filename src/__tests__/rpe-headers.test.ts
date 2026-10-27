/**
 * @jest-environment node
 */

import nextConfig from "../../next.config";

describe("cabeceras de /rpe/*", () => {
  test("Referrer-Policy no-referrer, Cache-Control no-store y noindex, después de la regla global", async () => {
    const rules = await nextConfig.headers!();
    const idx = rules.findIndex((r) => r.source === "/rpe/:path*");
    expect(idx).toBeGreaterThan(rules.findIndex((r) => r.source === "/(.*)"));
    const h = Object.fromEntries(rules[idx]!.headers.map((x) => [x.key, x.value]));
    expect(h["Referrer-Policy"]).toBe("no-referrer");
    expect(h["Cache-Control"]).toBe("no-store");
    expect(h["X-Robots-Tag"]).toBe("noindex, nofollow");
  });
});
