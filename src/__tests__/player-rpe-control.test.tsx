import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PlayerRpeControl, type PlayerRpeEntry } from "@/components/event/PlayerRpeControl";

const refresh = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const entry = (over: Partial<PlayerRpeEntry> = {}): PlayerRpeEntry => ({
  rpe: 7,
  duration: 60,
  workload: 420,
  recordedById: "player-1",
  updatedAt: "2026-10-20T10:00:00.000Z",
  ...over,
});

const setup = (props: Partial<React.ComponentProps<typeof PlayerRpeControl>> = {}) =>
  render(
    <PlayerRpeControl
      eventId="ev1"
      userId="player-1"
      name="Juan"
      checkedIn
      started
      entry={null}
      {...props}
    />
  );

const mockFetch = (status: number, body: unknown = {}) => {
  const fn = jest.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body });
  (global as any).fetch = fn;
  return fn;
};

describe("PlayerRpeControl", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.confirm = jest.fn().mockReturnValue(true);
  });

  test("anota un RPE: PUT con rpe y duración y refresca", async () => {
    const fetchMock = mockFetch(200);
    setup();
    fireEvent.click(screen.getByText("Anotar RPE"));
    expect(screen.getByText("Guardar")).toBeDisabled();
    fireEvent.click(screen.getByText("8"));
    fireEvent.change(screen.getByLabelText("Duración en minutos"), { target: { value: "75" } });
    fireEvent.click(screen.getByText("Guardar"));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/events/ev1/rpe/player-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rpe: 8, duration: 75 }),
    });
  });

  test("muestra el RPE con su autor según recordedById", () => {
    const { rerender } = setup({ entry: entry() });
    expect(screen.getByText("RPE 7 · 60 min · carga 420")).toBeInTheDocument();
    expect(screen.getByText("anotado por el jugador")).toBeInTheDocument();
    rerender(<PlayerRpeControl eventId="ev1" userId="player-1" name="Juan" checkedIn started entry={entry({ recordedById: "coach-1" })} />);
    expect(screen.getByText("anotado por el coach")).toBeInTheDocument();
    rerender(<PlayerRpeControl eventId="ev1" userId="player-1" name="Juan" checkedIn started entry={entry({ recordedById: null })} />);
    expect(screen.getByText("autor desconocido")).toBeInTheDocument();
  });

  test("edita un RPE existente: parte de sus valores y envía PUT", async () => {
    const fetchMock = mockFetch(200);
    setup({ entry: entry() });
    fireEvent.click(screen.getByText("Editar"));
    expect(screen.getByLabelText("Duración en minutos")).toHaveValue(60);
    fireEvent.click(screen.getByText("9"));
    fireEvent.click(screen.getByText("Guardar"));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ rpe: 9, duration: 60 });
  });

  test("borra con confirmación nativa y DELETE", async () => {
    const fetchMock = mockFetch(200, { deleted: true });
    setup({ entry: entry() });
    fireEvent.click(screen.getByText("Borrar"));
    expect(window.confirm).toHaveBeenCalledWith("¿Borrar el RPE de Juan?");
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/events/ev1/rpe/player-1", { method: "DELETE" });
  });

  test("si se cancela el confirm no se borra", () => {
    window.confirm = jest.fn().mockReturnValue(false);
    const fetchMock = mockFetch(200);
    setup({ entry: entry() });
    fireEvent.click(screen.getByText("Borrar"));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  test.each([
    [409, "El jugador no está marcado como presente"],
    [400, "El evento aún no ha comenzado"],
    [500, "No se pudo guardar el RPE"],
  ])("error %i al guardar → mensaje en español, sin refrescar", async (status, message) => {
    mockFetch(status, { error: "texto técnico interno" });
    setup();
    fireEvent.click(screen.getByText("Anotar RPE"));
    fireEvent.click(screen.getByText("5"));
    fireEvent.change(screen.getByLabelText("Duración en minutos"), { target: { value: "30" } });
    fireEvent.click(screen.getByText("Guardar"));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByText(/técnico/)).not.toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  test("fallo de red al guardar → mensaje genérico", async () => {
    (global as any).fetch = jest.fn().mockRejectedValue(new Error("boom"));
    setup();
    fireEvent.click(screen.getByText("Anotar RPE"));
    fireEvent.click(screen.getByText("5"));
    fireEvent.change(screen.getByLabelText("Duración en minutos"), { target: { value: "30" } });
    fireEvent.click(screen.getByText("Guardar"));
    expect(await screen.findByText("No se pudo guardar el RPE")).toBeInTheDocument();
  });

  test("jugador no presente con RPE previo: solo lectura y Borrar", () => {
    setup({ checkedIn: false, entry: entry() });
    expect(screen.getByText("RPE 7 · 60 min · carga 420")).toBeInTheDocument();
    expect(screen.getByText("Borrar")).toBeInTheDocument();
    expect(screen.queryByText("Editar")).not.toBeInTheDocument();
    expect(screen.queryByText("Anotar RPE")).not.toBeInTheDocument();
  });

  test("jugador no presente sin RPE: nada", () => {
    const { container } = setup({ checkedIn: false });
    expect(container).toBeEmptyDOMElement();
  });

  test("evento sin empezar: sin controles de RPE", () => {
    const { container } = setup({ started: false, entry: entry() });
    expect(container).toBeEmptyDOMElement();
  });
});
