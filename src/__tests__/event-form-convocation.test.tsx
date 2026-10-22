import { render, screen, fireEvent } from "@testing-library/react";
import { EventForm } from "@/app/events/new/event-form";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }) }));

const members = [
  { id: "m1", userId: "u1", isCoach: false, position: null, user: { name: "Luis Jugador" } },
  { id: "m2", userId: "u2", isCoach: true, position: null, user: { name: "Ana Coach" } },
] as any;

const setup = () => render(<EventForm teamId="t1" timezone="Europe/Madrid" members={members} />);
const changeType = (value: string) => fireEvent.change(screen.getByDisplayValue("Entrenamiento"), { target: { value } });

describe("EventForm — convocatoria según el tipo", () => {
  test("entrenamiento (tipo por defecto): texto «Se convocará a todo el equipo» y sin selección", () => {
    setup();
    expect(screen.getByText("Se convocará a todo el equipo")).toBeTruthy();
    expect(screen.queryByText("Seleccionar todos")).toBeNull();
    expect(screen.queryByText("Luis Jugador")).toBeNull();
  });

  test.each(["OTHER", "TRIP"])("%s también muestra el texto", (type) => {
    setup();
    changeType(type);
    expect(screen.getByText("Se convocará a todo el equipo")).toBeTruthy();
  });

  test.each(["MATCH", "TOURNAMENT"])("%s muestra el editor de alineación", (type) => {
    setup();
    changeType(type);
    expect(screen.queryByText("Se convocará a todo el equipo")).toBeNull();
    expect(screen.getByText("1 · Pilar izquierdo")).toBeTruthy();
    expect(screen.getByLabelText("Luis Jugador")).toBeTruthy(); // casilla «sin dorsal»
    expect(screen.queryByText("Ana Coach")).toBeNull(); // los coaches no se convocan
  });

  test("volver a entrenamiento sustituye otra vez la selección por el texto", () => {
    setup();
    changeType("MATCH");
    fireEvent.change(screen.getByDisplayValue("Partido"), { target: { value: "TRAINING" } });
    expect(screen.getByText("Se convocará a todo el equipo")).toBeTruthy();
  });
});

describe("EventForm — envío de formato y dorsales", () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({}) });
    (global as any).fetch = fetchMock;
  });
  const submit = () => fireEvent.submit(document.querySelector("form")!);
  const body = () => JSON.parse(fetchMock.mock.calls[0][1].body);

  test("partido: envía format y callups con shirtNumber", async () => {
    render(<EventForm teamId="t1" timezone="Europe/Madrid" members={members} defaultFormat="FIFTEENS" />);
    changeType("MATCH");
    fireEvent.change(screen.getByLabelText("Dorsal 10"), { target: { value: "u1" } });
    submit();
    await screen.findByText("Crear Evento y Notificar");
    expect(body().format).toBe("FIFTEENS");
    expect(body().callups).toEqual([{ userId: "u1", isStarter: true, position: null, shirtNumber: 10 }]);
  });

  test("partido: convocado sin dorsal viaja con shirtNumber null y como suplente", async () => {
    setup();
    changeType("TOURNAMENT");
    fireEvent.click(screen.getByLabelText("Luis Jugador"));
    submit();
    await screen.findByText("Crear Evento y Notificar");
    expect(body().format).toBe("SEVENS");
    expect(body().callups).toEqual([{ userId: "u1", isStarter: false, position: null, shirtNumber: null }]);
  });

  test("entrenamiento: sin format ni convocados", async () => {
    setup();
    submit();
    await screen.findByText("Crear Evento y Notificar");
    expect(body().format).toBeUndefined();
    expect(body().callups).toEqual([]);
  });
});
