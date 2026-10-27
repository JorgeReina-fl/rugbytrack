/**
 * @jest-environment node
 */

import { verifyCronToken } from "../../prisma/token-core";

const SECRET = "test-secret-test-secret-test-secret-123";

describe("prisma/send-rpe-links.ts", () => {
  const original = { secret: process.env.NEXTAUTH_SECRET, port: process.env.PORT };
  const realFetch = global.fetch;
  let log: jest.SpyInstance;
  let err: jest.SpyInstance;

  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = SECRET;
    delete process.env.PORT;
    log = jest.spyOn(console, "log").mockImplementation(() => {});
    err = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });
  afterAll(() => {
    process.env.NEXTAUTH_SECRET = original.secret;
    if (original.port !== undefined) process.env.PORT = original.port;
  });

  const load = async () => (await import("../../prisma/send-rpe-links")).main;
  const mockFetch = (impl: () => Promise<unknown>) => {
    const fn: jest.Mock = jest.fn(impl);
    global.fetch = fn as unknown as typeof fetch;
    return fn;
  };

  test("importarlo no ejecuta main() ni llama a fetch", async () => {
    const f = mockFetch(async () => ({ ok: true }));
    await load();
    expect(f).not.toHaveBeenCalled();
  });

  test("200: URL y cabecera correctas, sale con 0 e imprime una línea con recuentos", async () => {
    const f = mockFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: { events: 2, sent: 5, failed: 1, skipped: 0 } }),
    }));
    const main = await load();
    expect(await main()).toBe(0);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:3000/api/internal/rpe-links-auto");
    expect(init.method).toBe("POST");
    const auth = init.headers.Authorization as string;
    expect(auth).toMatch(/^Bearer /);
    expect(verifyCronToken(auth.slice(7), "rpe-links-auto")).not.toBeNull();
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toMatch(/^\[\d{4}-\d\d-\d\dT.*Z\] http=200 events=2 sent=5 failed=1 skipped=0$/);
    expect(log.mock.calls[0][0]).not.toContain(auth.slice(7, 27));
  });

  test("usa PORT si está definido", async () => {
    process.env.PORT = "4010";
    const f = mockFetch(async () => ({ ok: true, status: 200, json: async () => ({ data: { events: 0, sent: 0, failed: 0, skipped: 0 } }) }));
    const main = await load();
    await main();
    expect(f.mock.calls[0][0]).toBe("http://127.0.0.1:4010/api/internal/rpe-links-auto");
  });

  test.each([404, 500])("HTTP %i → sale con 1", async (status) => {
    mockFetch(async () => ({ ok: false, status, json: async () => ({}) }));
    const main = await load();
    expect(await main()).toBe(1);
    expect(err.mock.calls[0][0]).toContain(`http=${status}`);
  });

  test("timeout o error de red → sale con 1 sin volcar el mensaje del error", async () => {
    mockFetch(() => Promise.reject(Object.assign(new Error("connect http://127.0.0.1:3000 Bearer xyz"), { name: "TimeoutError" })));
    const main = await load();
    expect(await main()).toBe(1);
    expect(err.mock.calls[0][0]).toContain("error=TimeoutError");
    expect(err.mock.calls[0][0]).not.toContain("Bearer");
  });
});
