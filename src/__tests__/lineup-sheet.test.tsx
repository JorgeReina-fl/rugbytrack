import { render, screen } from "@testing-library/react";
import { LineupSheet } from "@/components/event/LineupSheet";

const callups = [
  { userId: "u1", name: "Luis", shirtNumber: 5 },
  { userId: "u2", name: "Marta", shirtNumber: 17 },
  { userId: "u3", name: "Pablo", shirtNumber: null },
];
const view = (currentUserId: string) => render(<LineupSheet format="FIFTEENS" callups={callups} currentUserId={currentUserId} />);

describe("Vista del jugador — hoja de alineación", () => {
  test("titular: frase con etiqueta y dorsal, y su fila destacada", () => {
    view("u1");
    expect(screen.getByText("Eres titular · Segunda línea (n.º 5)")).toBeTruthy();
    const mine = screen.getByTestId("my-lineup-row");
    expect(mine.textContent).toContain("5 · Segunda línea");
    expect(mine.textContent).toContain("Luis");
    expect(mine.getAttribute("aria-current")).toBe("true");
  });

  test("suplente: «Eres suplente (n.º X)»", () => {
    view("u2");
    expect(screen.getByText("Eres suplente (n.º 17)")).toBeTruthy();
    expect(screen.getByTestId("my-lineup-row").textContent).toContain("Marta");
  });

  test("sin dorsal: «Estás convocado» y fila destacada en la lista sin dorsal", () => {
    view("u3");
    expect(screen.getByText("Estás convocado")).toBeTruthy();
    expect(screen.getByTestId("my-lineup-row").textContent).toContain("Pablo");
  });

  test("no convocado: sin frase ni fila destacada, pero ve la hoja completa", () => {
    view("otro");
    expect(screen.queryByText(/Eres |Estás convocado/)).toBeNull();
    expect(screen.queryByTestId("my-lineup-row")).toBeNull();
    expect(screen.getByText("Luis")).toBeTruthy();
    expect(screen.getByText("Marta")).toBeTruthy();
    expect(screen.getByText("Convocados sin dorsal")).toBeTruthy();
    expect(screen.getByText("Pablo")).toBeTruthy();
  });

  test("hoja completa: 15 filas de titulares con etiqueta aunque estén vacías", () => {
    view("otro");
    expect(screen.getByText("15 · Zaguero")).toBeTruthy();
    expect(screen.getByText("1 · Pilar izquierdo")).toBeTruthy();
  });
});
