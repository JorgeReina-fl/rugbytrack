import { render, screen, fireEvent } from "@testing-library/react";
import { LineupForm } from "@/app/events/[id]/lineup/lineup-form";

const refresh = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn(), refresh }) }));

const members = [
  { userId: "u1", name: "Luis" },
  { userId: "u2", name: "Marta" },
];
const fetchMock = jest.fn();

beforeEach(() => {
  refresh.mockClear();
  fetchMock.mockReset();
  (global as any).fetch = fetchMock;
  render(<LineupForm eventId="e1" members={members} initialFormat="SEVENS" initialPlayers={[{ userId: "u1", shirtNumber: 1 }]} />);
});
const save = () => fireEvent.click(screen.getByText("Guardar alineación"));

describe("Página de edición de alineación", () => {
  test("guardar OK: PUT con la alineación, mensaje de éxito y router.refresh()", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    fireEvent.change(screen.getByLabelText("Dorsal 2"), { target: { value: "u2" } });
    save();
    expect(await screen.findByText("Alineación guardada. Se ha avisado a los jugadores afectados.")).toBeTruthy();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/events/e1/lineup");
    expect(fetchMock.mock.calls[0][1].method).toBe("PUT");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      format: "SEVENS",
      players: [
        { userId: "u1", shirtNumber: 1 },
        { userId: "u2", shirtNumber: 2 },
      ],
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test("409: «El partido ya ha empezado»", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: "El partido ya ha empezado" }) });
    save();
    expect((await screen.findByRole("alert")).textContent).toBe("El partido ya ha empezado");
    expect(refresh).not.toHaveBeenCalled();
  });

  test("422: muestra el mensaje devuelto por la API", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 422, json: async () => ({ error: "Dorsal 3 repetido" }) });
    save();
    expect((await screen.findByRole("alert")).textContent).toBe("Dorsal 3 repetido");
  });

  test("otro error o fallo de red: mensaje genérico", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    save();
    expect((await screen.findByRole("alert")).textContent).toBe("No se pudo guardar la alineación");
    fetchMock.mockRejectedValueOnce(new Error("net"));
    save();
    expect((await screen.findByRole("alert")).textContent).toBe("No se pudo guardar la alineación");
  });
});
