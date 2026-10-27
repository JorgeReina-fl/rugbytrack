import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RpeForm } from "@/components/training/RpeForm";

const refresh = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const LABEL = "22 de octubre a las 23:30 hs";
const TOKEN = "tok-de-prueba";

const mockFetch = (status: number, body: unknown = {}, json = true) => {
  const fn = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: json ? async () => body : async () => Promise.reject(new Error("no json")),
  });
  (global as any).fetch = fn;
  return fn;
};

const setup = () => {
  render(<RpeForm submit={{ url: "/api/rpe/link", extraBody: { token: TOKEN } }} closesAtLabel={LABEL} />);
  fireEvent.click(screen.getByRole("button", { name: "7" }));
  fireEvent.change(screen.getByLabelText(/duración efectiva/i), { target: { value: "60" } });
  fireEvent.click(screen.getByRole("button", { name: /guardar rpe/i }));
};

describe("RpeForm — modo enlace", () => {
  beforeEach(() => jest.clearAllMocks());

  test("envía el token en el body a /api/rpe/link (sin eventId) y con 201 muestra el agradecimiento sin formulario", async () => {
    const fetchMock = mockFetch(201, { data: { recorded: true } });
    setup();
    await waitFor(() => expect(screen.getByText("RPE registrado. Gracias.")).toBeInTheDocument());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/rpe/link");
    expect(JSON.parse(init.body)).toMatchObject({ rpe: 7, duration: 60, token: TOKEN });
    expect(JSON.parse(init.body)).not.toHaveProperty("eventId");
    expect(screen.queryByRole("button", { name: /guardar rpe/i })).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });

  test.each([
    [409, "ALREADY_RECORDED", "Ya registraste tu RPE para este evento."],
    [403, "NOT_CHECKED_IN", "Solo pueden registrar el RPE quienes figuran como presentes en la lista del entrenador."],
    [403, "RPE_WINDOW_CLOSED", `El plazo para registrar el RPE de este evento terminó el ${LABEL}.`],
    [400, "INVALID_LINK", "Este enlace no es válido o ha caducado."],
    [400, "Datos inválidos", "Datos inválidos. Revisa el formulario."],
    [429, "TOO_MANY_REQUESTS", "Demasiados intentos. Prueba de nuevo en unos minutos."],
  ])("%i %s → mensaje", async (status, code, text) => {
    mockFetch(status, { error: code });
    setup();
    await waitFor(() => expect(screen.getByText(text)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /guardar rpe/i })).toBeInTheDocument();
  });

  test("429 con respuesta no JSON (proxy) también se explica", async () => {
    mockFetch(429, null, false);
    setup();
    await waitFor(() =>
      expect(screen.getByText("Demasiados intentos. Prueba de nuevo en unos minutos.")).toBeInTheDocument()
    );
  });
});
