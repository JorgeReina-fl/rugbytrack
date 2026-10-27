import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { TeamSettingsCard } from "@/components/teams/TeamSettingsCard";

const refresh = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const mockFetch = (status: number) => {
  const fn = jest.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => ({}) });
  (global as any).fetch = fn;
  return fn;
};
const box = () => screen.getByLabelText("Enviar el enlace de RPE automáticamente al terminar cada evento") as HTMLInputElement;

describe("TeamSettingsCard", () => {
  beforeEach(() => jest.clearAllMocks());

  test("muestra título, casilla con el valor actual y la ayuda", () => {
    render(<TeamSettingsCard teamId="t1" rpeLinksAuto={true} />);
    expect(screen.getByRole("heading", { name: "Ajustes" })).toBeInTheDocument();
    expect(box().checked).toBe(true);
    expect(screen.getByText(/Se envía por email a los jugadores marcados como presentes/)).toHaveTextContent(
      "Siempre puedes enviarlo a mano desde el Panel de Asistencia."
    );
  });

  test("refleja el valor false", () => {
    render(<TeamSettingsCard teamId="t1" rpeLinksAuto={false} />);
    expect(box().checked).toBe(false);
  });

  test("al cambiar envía PATCH { rpeLinksAuto }, muestra «Guardado» y refresca", async () => {
    const f = mockFetch(200);
    render(<TeamSettingsCard teamId="t1" rpeLinksAuto={true} />);
    fireEvent.click(box());
    await waitFor(() => expect(screen.getByText("Guardado")).toBeInTheDocument());
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("/api/teams/t1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ rpeLinksAuto: false });
    expect(box().checked).toBe(false);
    expect(refresh).toHaveBeenCalled();
  });

  test("«Guardado» desaparece a los pocos segundos", async () => {
    jest.useFakeTimers();
    mockFetch(200);
    render(<TeamSettingsCard teamId="t1" rpeLinksAuto={false} />);
    fireEvent.click(box());
    await act(async () => {});
    expect(screen.getByText("Guardado")).toBeInTheDocument();
    act(() => void jest.advanceTimersByTime(3100));
    expect(screen.queryByText("Guardado")).toBeNull();
    jest.useRealTimers();
  });

  test("deshabilitada mientras guarda", async () => {
    let resolve!: (v: unknown) => void;
    (global as any).fetch = jest.fn(() => new Promise((r) => (resolve = r)));
    render(<TeamSettingsCard teamId="t1" rpeLinksAuto={true} />);
    fireEvent.click(box());
    expect(box()).toBeDisabled();
    await act(async () => resolve({ ok: true, status: 200, json: async () => ({}) }));
    expect(box()).toBeEnabled();
  });

  test.each([403, 500])("error %i: vuelve al valor anterior y avisa", async (status) => {
    mockFetch(status);
    render(<TeamSettingsCard teamId="t1" rpeLinksAuto={true} />);
    fireEvent.click(box());
    await waitFor(() => expect(screen.getByText("No se pudo guardar. Inténtalo de nuevo.")).toBeInTheDocument());
    expect(box().checked).toBe(true);
    expect(refresh).not.toHaveBeenCalled();
  });

  test("fallo de red: revierte", async () => {
    (global as any).fetch = jest.fn().mockRejectedValue(new Error("net"));
    render(<TeamSettingsCard teamId="t1" rpeLinksAuto={false} />);
    fireEvent.click(box());
    await waitFor(() => expect(screen.getByText("No se pudo guardar. Inténtalo de nuevo.")).toBeInTheDocument());
    expect(box().checked).toBe(false);
  });
});
