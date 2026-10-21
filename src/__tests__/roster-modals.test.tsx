import { render, screen, fireEvent } from "@testing-library/react";
import { TeamRosterClient } from "@/components/teams/TeamRosterClient";
import { LEAVE_DATA_WARNING, kickDataWarning } from "@/lib/member-leave-messages";
import { authorInitial } from "@/lib/forum-author";

jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }) }));

const members = [
  { memberId: "m1", userId: "coach", name: "Ana Coach", jerseyNumber: null, position: null, isCoach: true },
  { memberId: "m2", userId: "p1", name: "Luis Jugador", jerseyNumber: 7, position: null, isCoach: false },
];

describe("modales de salida", () => {
  test("abandonar: texto exacto", () => {
    render(<TeamRosterClient teamId="t" currentUserId="p1" isCoach={false} isOnlyCoach={false} members={members} />);
    fireEvent.click(screen.getByRole("button", { name: /Abandonar equipo/ }));
    expect(
      screen.getByText(
        "Al salir se borrarán tus datos en este equipo: asistencia, RPE, molestias, votos y apoyos. Tus mensajes del foro quedarán como «Ex-miembro». No se puede deshacer."
      )
    ).toBeTruthy();
    expect(LEAVE_DATA_WARNING).toContain("No se puede deshacer.");
  });

  test("expulsar: texto exacto con el nombre", () => {
    render(<TeamRosterClient teamId="t" currentUserId="coach" isCoach isOnlyCoach members={members} />);
    fireEvent.click(screen.getByRole("button", { name: "Expulsar" }));
    expect(
      screen.getByText(
        "Se borrarán los datos de Luis Jugador en este equipo: asistencia, RPE, molestias, votos y apoyos. Sus mensajes del foro quedarán como «Ex-miembro». No se puede deshacer."
      )
    ).toBeTruthy();
    expect(kickDataWarning("X")).toMatch(/^Se borrarán los datos de X /);
  });
});

describe("autoría del foro", () => {
  test("ex-miembro: inicial neutra «?»; un autor normal, su inicial", () => {
    expect(authorInitial("ex-member", "Ex-miembro")).toBe("?");
    expect(authorInitial(null, "Ex-miembro")).toBe("?");
    expect(authorInitial("user-1", "marta")).toBe("M");
  });
});
