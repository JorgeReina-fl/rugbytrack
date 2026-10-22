import { assign, changeFormat, counts, fromValue, toggleUnnumbered, toValue } from "@/components/event/lineup-state";

const empty = (format: "SEVENS" | "FIFTEENS" = "SEVENS") => fromValue({ format, players: [] });

describe("lineup-state", () => {
  test("asignar un jugador a un dorsal y liberarlo", () => {
    const s = assign(empty(), 3, "u1");
    expect(toValue(s).players).toEqual([{ userId: "u1", shirtNumber: 3 }]);
    expect(toValue(assign(s, 3, null)).players).toEqual([]);
  });

  test("un jugador no puede estar en dos dorsales: la segunda asignación se ignora", () => {
    const s = assign(empty(), 3, "u1");
    expect(assign(s, 5, "u1")).toBe(s);
  });

  test("al asignar dorsal deja de estar en «sin dorsal»", () => {
    const s = assign(toggleUnnumbered(empty(), "u1"), 2, "u1");
    expect(s.unnumbered).toEqual([]);
  });

  test("toggleUnnumbered marca y desmarca; no afecta a quien ya tiene dorsal", () => {
    const s = toggleUnnumbered(empty(), "u1");
    expect(s.unnumbered).toEqual(["u1"]);
    expect(toggleUnnumbered(s, "u1").unnumbered).toEqual([]);
    const withSlot = assign(empty(), 1, "u2");
    expect(toggleUnnumbered(withSlot, "u2")).toBe(withSlot);
  });

  test("15s → 7s conserva dorsales 1–12 y descoloca el resto a sin dorsal", () => {
    let s = empty("FIFTEENS");
    s = assign(s, 4, "u4");
    s = assign(s, 12, "u12");
    s = assign(s, 13, "u13");
    s = assign(s, 20, "u20");
    const { state, demoted } = changeFormat(s, "SEVENS");
    expect(state.slots).toEqual({ 4: "u4", 12: "u12" });
    expect(demoted).toEqual(["u13", "u20"]);
    expect(state.unnumbered).toEqual(["u13", "u20"]);
  });

  test("7s → 15s conserva todo y no descoloca a nadie", () => {
    const s = assign(empty(), 7, "u7");
    const { state, demoted } = changeFormat(s, "FIFTEENS");
    expect(state.slots).toEqual({ 7: "u7" });
    expect(demoted).toEqual([]);
  });

  test("contador de titulares, suplentes y sin dorsal", () => {
    let s = empty();
    s = assign(s, 1, "a");
    s = assign(s, 7, "b");
    s = assign(s, 8, "c");
    s = toggleUnnumbered(s, "d");
    expect(counts(s)).toEqual({ starters: 2, substitutes: 1, unnumbered: 1 });
  });

  test("fromValue/toValue: ida y vuelta, dorsales ordenados y sin dorsal al final", () => {
    const value = { format: "FIFTEENS" as const, players: [{ userId: "a", shirtNumber: null }, { userId: "b", shirtNumber: 10 }, { userId: "c", shirtNumber: 2 }] };
    expect(toValue(fromValue(value)).players).toEqual([
      { userId: "c", shirtNumber: 2 },
      { userId: "b", shirtNumber: 10 },
      { userId: "a", shirtNumber: null },
    ]);
  });
});

test("fromValue no duplica a un jugador repetido ni lo deja a la vez con dorsal y sin dorsal", () => {
  const s = fromValue({ format: "SEVENS", players: [{ userId: "a", shirtNumber: 2 }, { userId: "a", shirtNumber: null }, { userId: "b", shirtNumber: 99 }] });
  expect(s.slots).toEqual({ 2: "a" });
  expect(s.unnumbered).toEqual(["b"]);
});
