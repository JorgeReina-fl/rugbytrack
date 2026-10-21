import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DiscomfortSection, type DiscomfortItem } from "@/components/event/DiscomfortSection";
import HealthConsentForm from "@/app/profile/HealthConsentForm";
import { HEALTH_CONSENT_CHECKBOX, HEALTH_CONSENT_TEXT } from "@/lib/health-consent-text";

const refresh = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const mockFetch = (...responses: Array<{ status: number; body?: unknown }>) => {
  const fn = jest.fn();
  for (const r of responses) {
    fn.mockResolvedValueOnce({ ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body ?? {} });
  }
  global.fetch = fn as unknown as typeof fetch;
  return fn;
};

const item = (over: Partial<DiscomfortItem> = {}): DiscomfortItem => ({ id: "d1", bodyArea: "KNEE", intensity: 6, note: null, ...over });

const setup = (props: Partial<React.ComponentProps<typeof DiscomfortSection>> = {}) =>
  render(<DiscomfortSection eventId="ev1" hasConsent open items={[]} {...props} />);

const fillAndSend = (intensity = 7) => {
  fireEvent.click(screen.getByRole("button", { name: String(intensity) }));
  fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
};

beforeEach(() => {
  jest.clearAllMocks();
  window.confirm = jest.fn(() => true);
});

describe("DiscomfortSection — consentimiento", () => {
  test("sin consentimiento: solo el botón; al pulsarlo sale el texto exacto, el checkbox y el enlace a privacidad", () => {
    setup({ hasConsent: false });
    expect(screen.queryByText(HEALTH_CONSENT_TEXT)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reportar molestia" }));
    expect(screen.getByText(HEALTH_CONSENT_TEXT)).toBeTruthy();
    expect(screen.getByLabelText(HEALTH_CONSENT_CHECKBOX)).toBeTruthy();
    expect(screen.getByRole("link", { name: /privacidad/i }).getAttribute("href")).toBe("/privacidad");
    expect((screen.getByRole("button", { name: "Aceptar y continuar" }) as HTMLButtonElement).disabled).toBe(true);
  });

  test("aceptar → POST /api/me/health-consent, aparece el formulario y se refresca", async () => {
    const f = mockFetch({ status: 200 });
    setup({ hasConsent: false });
    fireEvent.click(screen.getByRole("button", { name: "Reportar molestia" }));
    fireEvent.click(screen.getByLabelText(HEALTH_CONSENT_CHECKBOX));
    fireEvent.click(screen.getByRole("button", { name: "Aceptar y continuar" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Enviar" })).toBeTruthy());
    expect(f).toHaveBeenCalledWith("/api/me/health-consent", { method: "POST" });
    expect(refresh).toHaveBeenCalled();
  });

  test("CONSENT_REQUIRED al enviar → vuelve a mostrar el consentimiento", async () => {
    mockFetch({ status: 403, body: { code: "CONSENT_REQUIRED" } });
    setup();
    fillAndSend();
    await waitFor(() => expect(screen.getByText(HEALTH_CONSENT_TEXT)).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Enviar" })).toBeNull();
  });
});

describe("DiscomfortSection — reportar", () => {
  test("con consentimiento: texto fijo, 11 botones 0–10, contador /280", () => {
    setup();
    expect(screen.getByText("Solo lo verán los entrenadores de tu equipo.")).toBeTruthy();
    for (let n = 0; n <= 10; n++) expect(screen.getByRole("button", { name: String(n) })).toBeTruthy();
    expect(screen.getByText("0/280")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Nota/), { target: { value: "hola" } });
    expect(screen.getByText("4/280")).toBeTruthy();
  });

  test("envío OK → POST con zona, intensidad y nota; limpia y refresca", async () => {
    const f = mockFetch({ status: 201 });
    setup();
    fireEvent.change(screen.getByLabelText("Zona"), { target: { value: "ANKLE_FOOT" } });
    fireEvent.change(screen.getByLabelText(/Nota/), { target: { value: "al apoyar" } });
    fillAndSend(4);
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("/api/events/ev1/discomforts");
    expect(JSON.parse(init.body)).toEqual({ bodyArea: "ANKLE_FOOT", intensity: 4, note: "al apoyar" });
    expect((screen.getByLabelText(/Nota/) as HTMLTextAreaElement).value).toBe("");
  });

  test("sin elegir intensidad no llama a la API", () => {
    const f = mockFetch();
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(screen.getByRole("alert").textContent).toBe("Revisa los datos");
    expect(f).not.toHaveBeenCalled();
  });

  test.each([
    [409, "El evento ya ha terminado"],
    [429, "Demasiados intentos. Espera unos minutos"],
    [422, "Revisa los datos"],
    [500, "No se pudo guardar la molestia"],
  ])("error %s → «%s»", async (status, text) => {
    mockFetch({ status });
    setup();
    fillAndSend();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(text));
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("DiscomfortSection — lista y borrado", () => {
  test("muestra «Zona · intensidad X/10» y la nota", () => {
    setup({ items: [item({ note: "al correr" })] });
    expect(screen.getByText("Rodilla · intensidad 6/10")).toBeTruthy();
    expect(screen.getByText("al correr")).toBeTruthy();
  });

  test("borrar: confirm, DELETE y refresh", async () => {
    const f = mockFetch({ status: 200 });
    setup({ items: [item()] });
    fireEvent.click(screen.getByRole("button", { name: "Borrar" }));
    expect(window.confirm).toHaveBeenCalledWith("¿Borrar esta molestia?");
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(f).toHaveBeenCalledWith("/api/discomforts/d1", { method: "DELETE" });
  });

  test("si el usuario cancela el confirm no borra", () => {
    (window.confirm as jest.Mock).mockReturnValue(false);
    const f = mockFetch();
    setup({ items: [item()] });
    fireEvent.click(screen.getByRole("button", { name: "Borrar" }));
    expect(f).not.toHaveBeenCalled();
  });

  test("tras el fin del evento: solo la lista con «Borrar», sin formulario ni consentimiento", () => {
    setup({ open: false, hasConsent: false, items: [item()] });
    expect(screen.getByRole("button", { name: "Borrar" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Enviar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reportar molestia" })).toBeNull();
    expect(screen.queryByText("Solo lo verán los entrenadores de tu equipo.")).toBeNull();
  });
});

describe("HealthConsentForm — perfil", () => {
  test("muestra la fecha y, al retirar, confirma, llama a DELETE y muestra el número borrado", async () => {
    const f = mockFetch({ status: 200, body: { deleted: 3 } });
    render(<HealthConsentForm consentDate="21 de octubre de 2026" />);
    expect(screen.getByText("Has dado consentimiento para datos de salud el 21 de octubre de 2026")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retirar consentimiento" }));
    expect(window.confirm).toHaveBeenCalledWith("Se borrarán todas tus molestias registradas. ¿Continuar?");
    await waitFor(() => expect(screen.getByText("Consentimiento retirado. Se han borrado 3 molestias.")).toBeTruthy());
    expect(f).toHaveBeenCalledWith("/api/me/health-consent", { method: "DELETE" });
    expect(refresh).toHaveBeenCalled();
  });

  test("cancelar el confirm no llama a la API; un fallo muestra error", async () => {
    (window.confirm as jest.Mock).mockReturnValueOnce(false);
    const f = mockFetch({ status: 500 });
    render(<HealthConsentForm consentDate="x" />);
    fireEvent.click(screen.getByRole("button", { name: "Retirar consentimiento" }));
    expect(f).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Retirar consentimiento" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("No se pudo retirar el consentimiento"));
  });
});
