/**
 * @jest-environment node
 */

import { RPE_PLAYER_WINDOW_MS, playerRpeUi, rpeWindow } from "@/lib/rpe-window";

const H = 60 * 60 * 1000;
const MIN = 60 * 1000;
const start = new Date("2026-10-20T18:00:00Z");
const end = new Date("2026-10-20T20:00:00Z");

describe("rpeWindow", () => {
  test("la ventana es de 48 h", () => {
    expect(RPE_PLAYER_WINDOW_MS).toBe(48 * H);
  });

  describe("con endDate", () => {
    const ev = { startDate: start, endDate: end };

    test("antes del inicio → not_started", () => {
      expect(rpeWindow(ev, new Date(start.getTime() - 1)).state).toBe("not_started");
    });
    test("justo en el inicio → open", () => {
      expect(rpeWindow(ev, start).state).toBe("open");
    });
    test("fin + 47 h 59 min → open", () => {
      expect(rpeWindow(ev, new Date(end.getTime() + 47 * H + 59 * MIN)).state).toBe("open");
    });
    test("fin + 48 h → closed", () => {
      expect(rpeWindow(ev, new Date(end.getTime() + 48 * H)).state).toBe("closed");
    });
    test("opensAt y closesAt", () => {
      const w = rpeWindow(ev, start);
      expect(w.opensAt).toEqual(start);
      expect(w.closesAt).toEqual(new Date(end.getTime() + 48 * H));
    });
  });

  describe("sin endDate (inicio + 3 h)", () => {
    const ev = { startDate: start, endDate: null };
    const implicitEnd = new Date(start.getTime() + 3 * H);

    test("abierto en fin implícito + 47 h 59 min", () => {
      expect(rpeWindow(ev, new Date(implicitEnd.getTime() + 47 * H + 59 * MIN)).state).toBe("open");
    });
    test("cerrado en fin implícito + 48 h", () => {
      const w = rpeWindow(ev, new Date(implicitEnd.getTime() + 48 * H));
      expect(w.state).toBe("closed");
      expect(w.closesAt).toEqual(new Date(implicitEnd.getTime() + 48 * H));
    });
  });
});

describe("playerRpeUi", () => {
  test("formulario, aviso de cierre, ya registrado y aún no empezado", () => {
    expect(playerRpeUi("open", false)).toBe("form");
    expect(playerRpeUi("closed", false)).toBe("closed");
    expect(playerRpeUi("open", true)).toBe("registered");
    expect(playerRpeUi("closed", true)).toBe("registered");
    expect(playerRpeUi("not_started", false)).toBe("none");
  });
});
