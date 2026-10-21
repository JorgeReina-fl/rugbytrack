import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { CoachDiscomfortList, type CoachDiscomfortItem } from "@/components/event/CoachDiscomfortList";
import { DiscomfortBadge } from "@/components/event/DiscomfortBadge";

const refresh = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const item = (over: Partial<CoachDiscomfortItem> = {}): CoachDiscomfortItem => ({
  id: "d1",
  playerName: "Marta Pérez",
  bodyArea: "KNEE",
  intensity: 8,
  note: "al girar",
  createdLabel: "21 oct, 10:30",
  isNew: true,
  ...over,
});

const mockFetch = (...responses: Array<{ status: number }>) => {
  const fn = jest.fn();
  for (const r of responses) fn.mockResolvedValueOnce({ ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => ({}) });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
};

beforeEach(() => {
  jest.clearAllMocks();
  window.confirm = jest.fn(() => true);
});

describe("CoachDiscomfortList", () => {
  test("título con el total y filas con jugador, zona · intensidad, nota y hora", () => {
    mockFetch({ status: 200 });
    render(<CoachDiscomfortList eventId="ev1" items={[item(), item({ id: "d2", playerName: "Luis", bodyArea: "NECK", intensity: 2, note: null, createdLabel: "21 oct, 11:00", isNew: false })]} />);
    expect(screen.getByRole("heading").textContent).toBe("Molestias reportadas (2)");
    expect(screen.getByText("Marta Pérez")).toBeTruthy();
    expect(screen.getByText("Rodilla ·")).toBeTruthy();
    expect(screen.getByText("intensidad 8/10")).toBeTruthy();
    expect(screen.getByText("al girar")).toBeTruthy();
    expect(screen.getByText("21 oct, 10:30")).toBeTruthy();
    expect(screen.getByText("Cuello ·")).toBeTruthy();
  });

  test("solo las no vistas llevan «Nueva»", () => {
    mockFetch({ status: 200 });
    render(<CoachDiscomfortList eventId="ev1" items={[item(), item({ id: "d2", playerName: "Luis", isNew: false })]} />);
    expect(screen.getAllByText("Nueva")).toHaveLength(1);
  });

  test("con alguna sin ver llama una sola vez a /seen, aunque se vuelva a renderizar; las «Nueva» siguen visibles", async () => {
    const f = mockFetch({ status: 200 });
    const { rerender } = render(<CoachDiscomfortList eventId="ev1" items={[item()]} />);
    rerender(<CoachDiscomfortList eventId="ev1" items={[item()]} />);
    await waitFor(() => expect(f).toHaveBeenCalledTimes(1));
    expect(f).toHaveBeenCalledWith("/api/events/ev1/discomforts/seen", { method: "POST" });
    expect(screen.getByText("Nueva")).toBeTruthy();
  });

  test("si todas están vistas no llama a /seen", () => {
    const f = mockFetch();
    render(<CoachDiscomfortList eventId="ev1" items={[item({ isNew: false })]} />);
    expect(f).not.toHaveBeenCalled();
  });

  test("sin molestias: mensaje vacío y sin llamadas", () => {
    const f = mockFetch();
    render(<CoachDiscomfortList eventId="ev1" items={[]} />);
    expect(screen.getByText("Ningún jugador ha reportado molestias para este evento.")).toBeTruthy();
    expect(screen.getByRole("heading").textContent).toBe("Molestias reportadas (0)");
    expect(f).not.toHaveBeenCalled();
  });

  test("borrar: confirm con el nombre, DELETE y refresh", async () => {
    const f = mockFetch({ status: 200 }, { status: 200 });
    render(<CoachDiscomfortList eventId="ev1" items={[item({ isNew: false })]} />);
    fireEvent.click(screen.getByRole("button", { name: "Borrar" }));
    expect(window.confirm).toHaveBeenCalledWith("¿Borrar la molestia de Marta Pérez?");
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(f).toHaveBeenCalledWith("/api/discomforts/d1", { method: "DELETE" });
  });

  test("si cancela el confirm no borra", () => {
    (window.confirm as jest.Mock).mockReturnValue(false);
    const f = mockFetch();
    render(<CoachDiscomfortList eventId="ev1" items={[item({ isNew: false })]} />);
    fireEvent.click(screen.getByRole("button", { name: "Borrar" }));
    expect(f).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  test("error al borrar → «No se pudo borrar la molestia» y sin refresh", async () => {
    mockFetch({ status: 500 });
    render(<CoachDiscomfortList eventId="ev1" items={[item({ isNew: false })]} />);
    fireEvent.click(screen.getByRole("button", { name: "Borrar" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("No se pudo borrar la molestia"));
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("DiscomfortBadge", () => {
  test("con 0 no pinta nada", () => {
    expect(renderToStaticMarkup(<DiscomfortBadge count={0} />)).toBe("");
  });

  test("con N muestra «N molestias nuevas»; con 1, en singular", () => {
    expect(renderToStaticMarkup(<DiscomfortBadge count={3} />)).toContain("3 molestias nuevas");
    expect(renderToStaticMarkup(<DiscomfortBadge count={1} />)).toContain("1 molestia nueva");
  });
});
