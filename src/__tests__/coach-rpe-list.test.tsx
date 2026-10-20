import { render, screen } from "@testing-library/react";
import { CoachRpeList, type CoachRpeRow } from "@/components/training/CoachRpeList";

jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: jest.fn() }) }));

const entry = { rpe: 7, duration: 60, workload: 420, recordedById: "coach-1", updatedAt: "2026-10-20T10:00:00.000Z" };
const row = (over: Partial<CoachRpeRow>): CoachRpeRow => ({
  userId: "p1",
  name: "Ana",
  checkedIn: true,
  notes: null,
  entry: null,
  ...over,
});

describe("CoachRpeList", () => {
  test("título con presentes con RPE de presentes y controles por jugador", () => {
    render(
      <CoachRpeList
        eventId="ev1"
        started
        rows={[row({ userId: "p1", name: "Ana", entry }), row({ userId: "p2", name: "Beto" }), row({ userId: "p3", name: "Cris", checkedIn: false, entry })]}
      />
    );
    // Y = presentes (Ana, Beto), X = presentes con RPE (Ana); Cris no cuenta
    expect(screen.getByText("Respuestas de Jugadores (1 de 2 presentes)")).toBeInTheDocument();
    expect(screen.getByText("Anotar RPE")).toBeInTheDocument(); // Beto
    expect(screen.getAllByText("Borrar")).toHaveLength(2); // Ana y Cris
    expect(screen.getAllByText("Editar")).toHaveLength(1); // solo Ana (presente)
    expect(screen.queryByText(/Pasa lista/)).not.toBeInTheDocument();
  });

  test("la nota del jugador se muestra en solo lectura", () => {
    render(<CoachRpeList eventId="ev1" started rows={[row({ notes: "Me dolía la rodilla", entry })]} />);
    expect(screen.getByText(/Me dolía la rodilla/)).toBeInTheDocument();
  });

  test("sin presentes: aviso con enlace al Panel de Asistencia", () => {
    render(<CoachRpeList eventId="ev1" started rows={[]} />);
    expect(screen.getByText("Respuestas de Jugadores (0 de 0 presentes)")).toBeInTheDocument();
    const link = screen.getByText("Pasa lista en el Panel de Asistencia para anotar el RPE");
    expect(link.closest("a")).toHaveAttribute("href", "/events/ev1/attendance");
  });

  test("sin presentes pero con un RPE previo de un no presente: aviso y fila de solo lectura", () => {
    render(<CoachRpeList eventId="ev1" started rows={[row({ checkedIn: false, entry })]} />);
    expect(screen.getByText(/Pasa lista/)).toBeInTheDocument();
    expect(screen.getByText("Borrar")).toBeInTheDocument();
    expect(screen.queryByText("Anotar RPE")).not.toBeInTheDocument();
  });

  test("evento sin empezar: sin controles de RPE", () => {
    render(<CoachRpeList eventId="ev1" started={false} rows={[row({})]} />);
    expect(screen.queryByText("Anotar RPE")).not.toBeInTheDocument();
  });
});
