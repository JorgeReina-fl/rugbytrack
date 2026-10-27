import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AttendanceBoard } from "@/components/event/AttendanceBoard";
import { RpeLinksPanel, type RpeLinksInfo } from "@/components/event/RpeLinksPanel";

const refresh = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
jest.mock("@/hooks/useVisibleRefresh", () => ({ useVisibleRefresh: jest.fn() }));
jest.mock("@/components/event/PlayerRpeControl", () => ({ PlayerRpeControl: () => null }));

const H = 3600_000;
const NOW = new Date("2026-10-27T12:00:00Z");
const iso = (offsetH: number) => new Date(NOW.getTime() + offsetH * H).toISOString();

// Evento que terminó hace 2 h: ventana abierta hasta dentro de 46 h
const info = (over: Partial<RpeLinksInfo> = {}): RpeLinksInfo => ({
  endsAt: iso(-2),
  closesAt: iso(46),
  sentAt: null,
  pendingRpe: 3,
  autoEnabled: true,
  timezone: "Europe/Madrid",
  closesAtLabel: "29 de octubre a las 13:00 hs",
  sentAtLabel: null,
  retryHourLabel: null,
  ...over,
});

const panel = (i: RpeLinksInfo, now = NOW) => render(<RpeLinksPanel eventId="e1" info={i} now={now} />);

const mockFetch = (status: number, body: unknown) => {
  const fn = jest.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body });
  (global as any).fetch = fn;
  return fn;
};

describe("RpeLinksPanel — visibilidad (a)", () => {
  test("jugador (isCoach false) nunca lo ve", () => {
    render(
      <AttendanceBoard eventId="e1" initialAttendances={[]} event={{ startDate: iso(-5), endDate: null, rsvpDeadline: null }}
        nowIso={NOW.toISOString()} isCoach={false} rpeLinks={info()} />
    );
    expect(screen.queryByText(/Enviar enlace de RPE/)).toBeNull();
  });

  test("coach en el panel: lo ve integrado en AttendanceBoard", () => {
    render(
      <AttendanceBoard eventId="e1" initialAttendances={[]} event={{ startDate: iso(-5), endDate: null, rsvpDeadline: null }}
        nowIso={NOW.toISOString()} isCoach rpeLinks={info()} />
    );
    expect(screen.getByRole("button", { name: "Enviar enlace de RPE a 3 jugadores" })).toBeInTheDocument();
  });

  test("antes del fin: nada", () => {
    const { container } = panel(info({ endsAt: iso(1), closesAt: iso(49) }));
    expect(container).toBeEmptyDOMElement();
  });

  test("abierta con N>0: botón con N y nota del envío automático", () => {
    panel(info());
    expect(screen.getByRole("button", { name: "Enviar enlace de RPE a 3 jugadores" })).toBeEnabled();
    expect(screen.getByText("El envío automático se hace al terminar")).toBeInTheDocument();
  });

  test("sin envío y auto desactivado: sin nota", () => {
    panel(info({ autoEnabled: false }));
    expect(screen.queryByText(/envío automático/)).toBeNull();
  });

  test("N=0: mensaje y sin botón", () => {
    panel(info({ pendingRpe: 0 }));
    expect(screen.getByText("Todos los presentes tienen su RPE")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("cerrada: mensaje con la fecha y sin botón", () => {
    panel(info({ endsAt: iso(-60), closesAt: iso(-12) }));
    expect(screen.getByText("El plazo de RPE terminó el 29 de octubre a las 13:00 hs")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("reenvío: texto distinto y último envío", () => {
    panel(info({ sentAt: iso(-5), sentAtLabel: "27 de octubre a las 08:00 hs" }));
    expect(screen.getByRole("button", { name: "Reenviar a 3 jugadores sin RPE" })).toBeEnabled();
    expect(screen.getByText("Último envío: 27 de octubre a las 08:00 hs")).toBeInTheDocument();
    expect(screen.queryByText(/envío automático/)).toBeNull();
  });
});

describe("RpeLinksPanel — retryAt (b)", () => {
  test("enviado hace 10 min: botón deshabilitado y hora de reenvío", () => {
    // Enviado a las 11:50Z → reenvío a las 12:20Z = 13:20 en Madrid (UTC+1 en octubre tras el cambio)
    panel(info({ sentAt: new Date(NOW.getTime() - 10 * 60_000).toISOString(), sentAtLabel: "x", retryHourLabel: "13:20" }));
    expect(screen.getByRole("button", { name: /Reenviar a 3 jugadores sin RPE/ })).toBeDisabled();
    expect(screen.getByText("Podrás reenviar a partir de las 13:20")).toBeInTheDocument();
  });

  test("pasados 30 min vuelve a estar habilitado", () => {
    panel(info({ sentAt: new Date(NOW.getTime() - 31 * 60_000).toISOString(), sentAtLabel: "x" }));
    expect(screen.getByRole("button", { name: /Reenviar/ })).toBeEnabled();
    expect(screen.queryByText(/Podrás reenviar/)).toBeNull();
  });
});

describe("RpeLinksPanel — flujo (c)", () => {
  beforeEach(() => jest.clearAllMocks());

  const run = async () => {
    panel(info());
    fireEvent.click(screen.getByRole("button", { name: /Enviar enlace de RPE/ }));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Se enviará un email con el enlace para registrar el RPE a 3 jugadores. ¿Continuar?"
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  };

  test("cancelar no envía", () => {
    const f = mockFetch(200, {});
    panel(info());
    fireEvent.click(screen.getByRole("button", { name: /Enviar enlace de RPE/ }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  test("200 sin fallos: mensaje, POST a la ruta y refresh", async () => {
    const f = mockFetch(200, { data: { sent: 3, failed: 0, skipped: 0 } });
    await run();
    await waitFor(() => expect(screen.getByText("Enviados: 3. No enviados: 0.")).toBeInTheDocument());
    expect(f).toHaveBeenCalledWith("/api/events/e1/rpe-links", { method: "POST" });
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("200 con fallos u omisiones: suma y añade «Inténtalo más tarde.»", async () => {
    mockFetch(200, { data: { sent: 1, failed: 1, skipped: 1 } });
    await run();
    await waitFor(() => expect(screen.getByText("Enviados: 1. No enviados: 2. Inténtalo más tarde.")).toBeInTheDocument());
  });

  test.each([
    ["NOT_ENDED", "El evento aún no ha terminado."],
    ["WINDOW_CLOSED", "El plazo de RPE ya terminó."],
  ])("409 %s", async (code, text) => {
    mockFetch(409, { error: code });
    await run();
    await waitFor(() => expect(screen.getByText(text)).toBeInTheDocument());
    expect(refresh).toHaveBeenCalled();
  });

  test("429: hora de retryAt en la zona del equipo", async () => {
    mockFetch(429, { error: "TOO_SOON", retryAt: "2026-10-27T12:30:00.000Z" });
    await run();
    await waitFor(() => expect(screen.getByText("Podrás reenviar a partir de las 13:30")).toBeInTheDocument());
  });

  test.each([[500, { error: "x" }], [404, {}]])("error %i → texto genérico", async (status, body) => {
    mockFetch(status as number, body);
    await run();
    await waitFor(() => expect(screen.getByText("No se pudo enviar. Inténtalo de nuevo.")).toBeInTheDocument());
  });

  test("fallo de red → texto genérico", async () => {
    (global as any).fetch = jest.fn().mockRejectedValue(new Error("net"));
    await run();
    await waitFor(() => expect(screen.getByText("No se pudo enviar. Inténtalo de nuevo.")).toBeInTheDocument());
  });
});
