import { render, screen, fireEvent } from "@testing-library/react";
import { LineupEditor } from "@/components/event/LineupEditor";

const members = [
  { userId: "u1", name: "Luis" },
  { userId: "u2", name: "Marta" },
  { userId: "u3", name: "Pablo" },
];

const setup = (props: Partial<React.ComponentProps<typeof LineupEditor>> = {}) => {
  const onChange = jest.fn();
  render(<LineupEditor members={members} initialFormat="SEVENS" onChange={onChange} {...props} />);
  return onChange;
};
const pick = (n: number, userId: string) => fireEvent.change(screen.getByLabelText(`Dorsal ${n}`), { target: { value: userId } });
const last = (fn: jest.Mock) => fn.mock.calls[fn.mock.calls.length - 1][0];

describe("LineupEditor", () => {
  test("7s: filas 1–7 de titulares con etiqueta y 8–12 de suplentes", () => {
    setup();
    expect(screen.getByText("1 · Pilar izquierdo")).toBeTruthy();
    expect(screen.getByText("7 · Ala")).toBeTruthy();
    expect(screen.getByText("8 · Suplente")).toBeTruthy();
    expect(screen.getByText("12 · Suplente")).toBeTruthy();
    expect(screen.queryByLabelText("Dorsal 13")).toBeNull();
  });

  test("15s inicial: filas 1–15 y 16–23", () => {
    setup({ initialFormat: "FIFTEENS" });
    expect(screen.getByText("15 · Zaguero")).toBeTruthy();
    expect(screen.getByLabelText("Dorsal 23")).toBeTruthy();
    expect(screen.queryByLabelText("Dorsal 24")).toBeNull();
  });

  test("asignar un jugador devuelve format y dorsal", () => {
    const onChange = setup();
    pick(5, "u2");
    expect(last(onChange)).toEqual({ format: "SEVENS", players: [{ userId: "u2", shirtNumber: 5 }] });
  });

  test("un jugador no puede estar en dos filas: su opción queda deshabilitada en las demás", () => {
    setup();
    pick(5, "u2");
    const other = screen.getByLabelText("Dorsal 6") as HTMLSelectElement;
    expect((Array.from(other.options).find((o) => o.value === "u2") as HTMLOptionElement).disabled).toBe(true);
    const same = screen.getByLabelText("Dorsal 5") as HTMLSelectElement;
    expect((Array.from(same.options).find((o) => o.value === "u2") as HTMLOptionElement).disabled).toBe(false);
  });

  test("convocados sin dorsal: casillas con el resto de miembros", () => {
    const onChange = setup();
    pick(1, "u1");
    expect(screen.queryByLabelText("Luis")).toBeNull();
    fireEvent.click(screen.getByLabelText("Marta"));
    expect(last(onChange).players).toEqual([
      { userId: "u1", shirtNumber: 1 },
      { userId: "u2", shirtNumber: null },
    ]);
  });

  test("contador X titulares · Y suplentes · Z sin dorsal", () => {
    setup();
    expect(screen.getByText("0 titulares · 0 suplentes · 0 sin dorsal")).toBeTruthy();
    pick(1, "u1");
    pick(8, "u2");
    fireEvent.click(screen.getByLabelText("Pablo"));
    expect(screen.getByText("1 titulares · 1 suplentes · 1 sin dorsal")).toBeTruthy();
  });

  test("15s → 7s conserva los dorsales válidos, descoloca el resto y avisa", () => {
    const onChange = setup({
      initialFormat: "FIFTEENS",
      initialPlayers: [
        { userId: "u1", shirtNumber: 4 },
        { userId: "u2", shirtNumber: 14 },
      ],
    });
    fireEvent.change(screen.getByLabelText("Formato"), { target: { value: "SEVENS" } });
    expect(last(onChange)).toEqual({
      format: "SEVENS",
      players: [
        { userId: "u1", shirtNumber: 4 },
        { userId: "u2", shirtNumber: null },
      ],
    });
    expect(screen.getByText(/Marta pasa a «sin dorsal»/)).toBeTruthy();
  });

  test("una alineación inicial con jugador repetido se normaliza y no muestra errores", () => {
    const onChange = setup({
      initialPlayers: [
        { userId: "u1", shirtNumber: 3 },
        { userId: "u1", shirtNumber: null },
      ],
    });
    expect(screen.queryByRole("alert")).toBeNull();
    pick(4, "u2");
    expect(last(onChange).players).toEqual([
      { userId: "u1", shirtNumber: 3 },
      { userId: "u2", shirtNumber: 4 },
    ]);
  });
});
