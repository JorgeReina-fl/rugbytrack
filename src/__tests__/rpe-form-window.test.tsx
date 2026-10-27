import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RpeForm } from "@/components/training/RpeForm";
import { playerRpeUi } from "@/lib/rpe-window";

jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: jest.fn() }) }));

const LABEL = "22 de octubre a las 23:00 hs";

describe("RpeForm — plazo", () => {
  test("abierto: formulario y línea «Puedes registrarlo hasta…»", () => {
    render(<RpeForm eventId="ev1" closesAtLabel={LABEL} />);
    expect(screen.getByText(`Puedes registrarlo hasta el ${LABEL}`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /guardar rpe/i })).toBeInTheDocument();
  });

  test("cerrado: solo el texto, sin formulario", () => {
    const { container } = render(<RpeForm eventId="ev1" closesAtLabel={LABEL} closed />);
    expect(screen.getByText(`El plazo para registrar el RPE de este evento terminó el ${LABEL}`)).toBeInTheDocument();
    expect(container.querySelector("form")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText(/puedes registrarlo/i)).toBeNull();
  });

  test("ya registrado: la página no monta el formulario ni el mensaje de plazo", () => {
    // Las páginas deciden con playerRpeUi: con RPE existente nunca se renderiza RpeForm
    expect(playerRpeUi("open", true)).toBe("registered");
    expect(playerRpeUi("closed", true)).toBe("registered");
  });

  test("si la API responde RPE_WINDOW_CLOSED se explica en español", async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: "RPE_WINDOW_CLOSED" }),
    });
    render(<RpeForm eventId="ev1" closesAtLabel={LABEL} />);
    fireEvent.click(screen.getByRole("button", { name: "7" }));
    fireEvent.change(screen.getByLabelText(/duración efectiva/i), { target: { value: "60" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar rpe/i }));
    await waitFor(() =>
      expect(screen.getByText(/el plazo para registrar el rpe de este evento ya terminó/i)).toBeInTheDocument()
    );
  });
});
