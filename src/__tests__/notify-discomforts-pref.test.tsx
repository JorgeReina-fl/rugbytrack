import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import NotificationsForm from "@/app/profile/NotificationsForm";

const initial = { notifyPolls: true, notifyProposals: true, notifyForumThreads: true, notifyRsvpReminders: true, notifyDiscomforts: true };
const LABEL = "Avisos de molestias de mis jugadores";

describe("NotificationsForm — avisos de molestias", () => {
  test("coach activo: ve el interruptor y lo guarda con PATCH", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    (global as any).fetch = fetchMock;
    render(<NotificationsForm initial={initial} isCoach />);
    const sw = screen.getByText(LABEL).closest("label")!.querySelector("button")!;
    expect(sw.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(sw);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/profile/notifications");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ notifyDiscomforts: false });
    expect(sw.getAttribute("aria-checked")).toBe("false");
  });

  test("jugador: no ve el interruptor, pero sí el resto", () => {
    render(<NotificationsForm initial={initial} isCoach={false} />);
    expect(screen.queryByText(LABEL)).toBeNull();
    expect(screen.getByText("Encuestas del equipo")).toBeTruthy();
  });

  test("por defecto (sin isCoach) tampoco se muestra", () => {
    render(<NotificationsForm initial={initial} />);
    expect(screen.queryByText(LABEL)).toBeNull();
  });

  test("texto fijo sobre convocatorias, para todos", () => {
    render(<NotificationsForm initial={initial} />);
    expect(
      screen.getByText("Las convocatorias a eventos siempre se envían por correo; los recordatorios y el resto de avisos puedes desactivarlos aquí.")
    ).toBeTruthy();
  });
});
