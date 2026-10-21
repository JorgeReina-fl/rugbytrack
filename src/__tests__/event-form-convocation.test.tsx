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

  test.each(["MATCH", "TOURNAMENT"])("%s muestra la selección de jugadores como hoy", (type) => {
    setup();
    changeType(type);
    expect(screen.queryByText("Se convocará a todo el equipo")).toBeNull();
    expect(screen.getByText("Seleccionar todos")).toBeTruthy();
    expect(screen.getByText("Luis Jugador")).toBeTruthy();
    expect(screen.queryByText("Ana Coach")).toBeNull(); // los coaches no se convocan
  });

  test("volver a entrenamiento sustituye otra vez la selección por el texto", () => {
    setup();
    changeType("MATCH");
    fireEvent.change(screen.getByDisplayValue("Partido"), { target: { value: "TRAINING" } });
    expect(screen.getByText("Se convocará a todo el equipo")).toBeTruthy();
  });
});
