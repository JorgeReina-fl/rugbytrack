import { render, screen } from "@testing-library/react";
import { AttendanceBoard } from "@/components/event/AttendanceBoard";

jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: jest.fn() }) }));
jest.mock("@/hooks/useVisibleRefresh", () => ({ useVisibleRefresh: jest.fn() }));
jest.mock("@/components/event/PlayerRpeControl", () => ({ PlayerRpeControl: () => null }));

const HOUR = 3600_000;
const T0 = new Date("2026-10-22T12:00:00Z").getTime();
const iso = (offsetH: number) => new Date(T0 + offsetH * HOUR).toISOString();

const p = (name: string, status: string, checkedIn = false) => ({
  userId: name, name, image: null, position: null, jerseyNumber: null,
  status, checkedIn, checkedInAt: null, rpe: null,
});

/** start/end relativos a "ahora" (nowIso = T0). */
const setup = (players: ReturnType<typeof p>[], start: number, end: number | null = null) =>
  render(
    <AttendanceBoard
      eventId="e1"
      initialAttendances={players}
      event={{ startDate: iso(start), endDate: end === null ? null : iso(end), rsvpDeadline: null }}
      nowIso={iso(0)}
    />
  );
// Los contadores van antes que la lista, así que el primer texto coincidente es el contador
const counter = (label: string) => screen.getAllByText(label)[0]!.parentElement!.querySelector("div")!.textContent;
const badge = (name: string) =>
  screen.getByText(name).closest("[class*='hover:bg-secondary']")!.querySelector("span[class*='border'][class*='tracking-widest']")!.textContent;

describe("AttendanceBoard — estados y contadores", () => {
  test("antes del evento: confirmado → «Confirmado» y cuenta en Confirmados, no en Sin respuesta", () => {
    setup([p("Ana", "CONFIRMED"), p("Beto", "PENDING")], 24);
    expect(badge("Ana")).toBe("Confirmado");
    expect(counter("Confirmados")).toBe("1");
    expect(counter("Sin respuesta")).toBe("1");
  });

  test("durante el evento: confirmado sigue «Confirmado»", () => {
    setup([p("Ana", "CONFIRMED")], -1);
    expect(badge("Ana")).toBe("Confirmado");
    expect(counter("Confirmados")).toBe("1");
    expect(counter("Sin respuesta")).toBe("0");
  });

  test("pending → «Sin respuesta»; declined → «No asistirá» y cuenta en No asisten", () => {
    setup([p("Ana", "PENDING"), p("Beto", "DECLINED")], 24);
    expect(badge("Ana")).toBe("Sin respuesta");
    expect(badge("Beto")).toBe("No asistirá");
    expect(counter("No asisten / Ausentes")).toBe("1");
  });

  test("presente → «Presente»", () => {
    setup([p("Ana", "CONFIRMED", true)], -1);
    expect(badge("Ana")).toBe("Presente");
    expect(counter("Presentes")).toBe("1");
    expect(counter("Confirmados")).toBe("0");
  });

  test("tras el fin con lista: confirmado sin check-in → «Ausente»; declinado → «Ausente (no asistirá)»", () => {
    setup([p("Ana", "CONFIRMED", true), p("Beto", "CONFIRMED"), p("Cris", "DECLINED")], -10, -5);
    expect(badge("Beto")).toBe("Ausente");
    expect(badge("Cris")).toBe("Ausente (no asistirá)");
    expect(counter("No asisten / Ausentes")).toBe("2");
    expect(screen.queryByText("Sin pasar lista")).toBeNull();
  });

  test("tras el fin sin lista: «Sin pasar lista», con su contador aparte", () => {
    setup([p("Ana", "CONFIRMED"), p("Beto", "PENDING")], -10, -5);
    expect(badge("Ana")).toBe("Sin pasar lista");
    expect(counter("Sin pasar lista")).toBe("2");
  });

  test("el contador «Sin pasar lista» no aparece si no hay ninguno", () => {
    setup([p("Ana", "CONFIRMED")], 24);
    expect(screen.queryByText("Sin pasar lista")).toBeNull();
  });

  test("orden: presentes, confirmados, sin respuesta, no asisten; alfabético dentro de cada grupo", () => {
    setup(
      [p("Zoe", "PENDING"), p("Dani", "DECLINED"), p("Carlos", "CONFIRMED"), p("Álvaro", "CONFIRMED"), p("Eva", "CONFIRMED", true), p("Bea", "PENDING")],
      24
    );
    const names = ["Eva", "Álvaro", "Carlos", "Bea", "Zoe", "Dani"];
    const order = screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent);
    expect(order).toEqual(names);
  });
});

describe("AttendanceBoard — marcar confirmados como presentes", () => {
  const { fireEvent, waitFor } = jest.requireActual("@testing-library/react");
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
  });

  const setupCoach = (players: ReturnType<typeof p>[], isCoach = true) =>
    render(
      <AttendanceBoard
        eventId="e1"
        initialAttendances={players}
        event={{ startDate: iso(-10), endDate: iso(-5), rsvpDeadline: null }}
        nowIso={iso(0)}
        isCoach={isCoach}
      />
    );
  const BTN = "Marcar confirmados como presentes";

  test("evento terminado, 1 presente y 3 confirmados: tras la acción 4 Presente y 0 Ausente", async () => {
    setupCoach([p("Ana", "CONFIRMED", true), p("Beto", "CONFIRMED"), p("Cris", "CONFIRMED"), p("Dani", "CONFIRMED")]);
    expect(badge("Beto")).toBe("Ausente");
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          marked: 3,
          attendances: ["Beto", "Cris", "Dani"].map((u) => ({ userId: u, status: "CONFIRMED", checkedIn: true, checkedInAt: iso(0) })),
        },
      }),
    });
    fireEvent.click(screen.getByText(BTN));
    expect(screen.getByRole("dialog").textContent).toContain("Marcar 3 confirmados como presentes");
    fireEvent.click(screen.getByText("Confirmar"));
    await waitFor(() => expect(counter("Presentes")).toBe("4"));
    expect(counter("No asisten / Ausentes")).toBe("0");
    expect(screen.queryByText(BTN)).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/api/events/e1/attendance/confirmed-present", { method: "POST" });
  });

  test("el botón del modal queda deshabilitado mientras la petición está en curso", async () => {
    setupCoach([p("Ana", "CONFIRMED", true), p("Beto", "CONFIRMED")]);
    fetchMock.mockReturnValue(new Promise(() => {}));
    fireEvent.click(screen.getByText(BTN));
    fireEvent.click(screen.getByText("Confirmar"));
    await waitFor(() => expect((screen.getByText("Marcando…") as HTMLButtonElement).disabled).toBe(true));
    expect((screen.getByText("Cancelar") as HTMLButtonElement).disabled).toBe(true);
  });

  test("error de la API: muestra el mensaje y no cambia estados", async () => {
    setupCoach([p("Ana", "CONFIRMED", true), p("Beto", "CONFIRMED")]);
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "No tienes permisos para realizar esta acción" }) });
    fireEvent.click(screen.getByText(BTN));
    fireEvent.click(screen.getByText("Confirmar"));
    await waitFor(() => screen.getByText(/No tienes permisos/));
    expect(badge("Beto")).toBe("Ausente");
  });

  test("botón oculto si N=0 o si el usuario no es coach", () => {
    setupCoach([p("Ana", "CONFIRMED", true), p("Beto", "DECLINED"), p("Cris", "PENDING")]);
    expect(screen.queryByText(BTN)).toBeNull();
  });
  test("botón oculto si no es coach aunque haya confirmados sin marca", () => {
    setupCoach([p("Ana", "CONFIRMED", true), p("Beto", "CONFIRMED")], false);
    expect(screen.queryByText(BTN)).toBeNull();
  });
});
