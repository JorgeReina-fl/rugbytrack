/**
 * @jest-environment node
 */

import { renderToStaticMarkup } from "react-dom/server";
import RpeLinkPage from "@/app/rpe/[token]/page";
import { verifyRpeToken } from "@/lib/tokens";
import { evaluatePlayerRpe } from "@/lib/rpe-submit";

jest.mock("server-only", () => ({}));
jest.mock("@/lib/tokens", () => ({ verifyRpeToken: jest.fn() }));
jest.mock("@/lib/rpe-submit", () => ({ evaluatePlayerRpe: jest.fn() }));
jest.mock("@/components/training/RpeForm", () => ({
  RpeForm: (p: any) => `[RpeForm url=${p.submit.url} hasToken=${"token" in p.submit.extraBody} label=${p.closesAtLabel}]`,
}));

const verify = verifyRpeToken as jest.Mock;
const evaluate = evaluatePlayerRpe as jest.Mock;
const H = 60 * 60 * 1000;

const render = async () =>
  renderToStaticMarkup(await RpeLinkPage({ params: Promise.resolve({ token: "tok-secreto" }) }));

const okEvent = {
  title: "Entreno de martes",
  type: "TRAINING",
  startDate: new Date("2026-10-20T18:00:00Z"),
  endDate: null,
  team: { name: "Club Rugby Norte", timezone: "Europe/Madrid" },
};

describe("/rpe/[token] — estados", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verify.mockReturnValue({ userId: "u1", eventId: "e1", exp: Date.now() + H, p: "rpe" });
    evaluate.mockResolvedValue({ ok: true, event: okEvent });
  });

  const INVALID = "Este enlace no es válido o ha caducado.";

  test("token inválido o caducado → mensaje sin datos del evento, sin consultar nada", async () => {
    verify.mockReturnValue(null);
    const html = await render();
    expect(html).toContain(INVALID);
    expect(evaluate).not.toHaveBeenCalled();
    expect(html).not.toContain("Entreno");
  });

  test.each(["EVENT_NOT_FOUND", "NOT_MEMBER", "IS_COACH", "NOT_STARTED"])("%s → INVALID_LINK sin datos del evento", async (code) => {
    evaluate.mockResolvedValue({ ok: false, code });
    const html = await render();
    expect(html).toContain(INVALID);
    expect(html).not.toContain("Club Rugby Norte");
  });

  test("NOT_CHECKED_IN", async () => {
    evaluate.mockResolvedValue({ ok: false, code: "NOT_CHECKED_IN" });
    expect(await render()).toContain(
      "Solo pueden registrar el RPE quienes figuran como presentes en la lista del entrenador."
    );
  });

  test("RPE_WINDOW_CLOSED con fecha y hora en la zona del equipo", async () => {
    evaluate.mockResolvedValue({
      ok: false,
      code: "WINDOW_CLOSED",
      closesAt: new Date("2026-10-22T21:30:00Z"),
      timezone: "Europe/Madrid",
    });
    const html = await render();
    expect(html).toContain("El plazo para registrar el RPE de este evento terminó el");
    expect(html).toContain("22 de octubre a las 23:30 hs");
  });

  test("ALREADY_RECORDED sin valor", async () => {
    evaluate.mockResolvedValue({ ok: false, code: "ALREADY_RECORDED" });
    const html = await render();
    expect(html).toContain("Ya registraste tu RPE para este evento.");
    expect(html).not.toMatch(/RPE:? ?\d/);
  });

  test("OK: título, tipo, fecha, equipo y formulario contra /api/rpe/link con token", async () => {
    const html = await render();
    expect(html).toContain("Entreno de martes");
    expect(html).toContain("Entrenamiento");
    expect(html).toContain("Club Rugby Norte");
    expect(html).toContain("martes 20 de octubre, 20:00");
    expect(html).toContain("url=/api/rpe/link hasToken=true");
    expect(html).toMatch(/label=\d+ de \w+ a las \d\d:\d\d hs/);
  });

  test("nunca aparece el nombre ni el email del jugador, ni se pasan a la página", async () => {
    for (const r of [
      { ok: true, event: okEvent },
      { ok: false, code: "NOT_CHECKED_IN" },
      { ok: false, code: "ALREADY_RECORDED" },
      { ok: false, code: "IS_COACH" },
    ]) {
      evaluate.mockResolvedValue(r);
      const html = await render();
      expect(html).not.toMatch(/@/);
      expect(html).not.toContain("tok-secreto");
      expect(html).not.toContain("u1");
    }
  });
});
