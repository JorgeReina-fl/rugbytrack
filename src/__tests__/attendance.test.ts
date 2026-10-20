/**
 * @jest-environment node
 */

import {
  attendanceRate,
  attendanceState,
  canSubmitRpe,
  countsForEvent,
  isRsvpOpen,
  listTaken,
  type AttendanceRowLike,
  type EventTimesLike,
} from "@/lib/attendance";

const H = 60 * 60 * 1000;
const START = new Date("2026-10-20T18:00:00Z");
const at = (ms: number) => new Date(START.getTime() + ms);

const event: EventTimesLike = { startDate: START, endDate: at(2 * H) };
const row = (status: AttendanceRowLike["status"], checkedIn = false): AttendanceRowLike => ({
  status,
  checkedIn,
});

describe.each(["UTC", "America/Los_Angeles"])("attendance (TZ=%s)", (tz) => {
  const originalTz = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = tz;
  });
  afterAll(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  describe("R1 isRsvpOpen", () => {
    test("plazo antes del inicio: manda el plazo", () => {
      const e = { ...event, rsvpDeadline: at(-2 * H) };
      expect(isRsvpOpen(e, at(-3 * H))).toBe(true);
      expect(isRsvpOpen(e, at(-1 * H))).toBe(false);
    });

    test("sin plazo: manda el inicio", () => {
      expect(isRsvpOpen(event, at(-1))).toBe(true);
      expect(isRsvpOpen(event, at(1))).toBe(false);
    });

    test("plazo después del inicio: manda el inicio", () => {
      const e = { ...event, rsvpDeadline: at(H) };
      expect(isRsvpOpen(e, at(-1))).toBe(true);
      expect(isRsvpOpen(e, at(30 * 60 * 1000))).toBe(false);
    });

    test("justo en el límite: cerrado (now < límite estricto)", () => {
      expect(isRsvpOpen(event, START)).toBe(false);
      const e = { ...event, rsvpDeadline: at(-H) };
      expect(isRsvpOpen(e, at(-H))).toBe(false);
      expect(isRsvpOpen(e, at(-H - 1))).toBe(true);
    });
  });

  describe("R2/R3 attendanceState", () => {
    test("DECLINED + checkedIn → present (el check-in manda, status es histórico)", () => {
      const r = row("DECLINED", true);
      expect(attendanceState(r, event, at(H), listTaken([r]))).toBe("present");
      expect(r.status).toBe("DECLINED");
    });

    test("CONFIRMED + lista tomada sin check-in → absent", () => {
      const rows = [row("CONFIRMED"), row("PENDING", true)];
      expect(attendanceState(rows[0]!, event, at(H), listTaken(rows))).toBe("absent");
    });

    test("la presencia solo depende de checkedIn: desmarcar no cambia status ni lo lee", () => {
      for (const status of ["PENDING", "CONFIRMED", "DECLINED"] as const) {
        const marked = attendanceState(row(status, true), event, at(3 * H), true);
        const unmarked = attendanceState(row(status, false), event, at(3 * H), true);
        expect(marked).toBe("present");
        expect(unmarked).toBe("absent");
      }
    });

    test("antes de terminar y sin lista: estado del RSVP", () => {
      expect(attendanceState(row("PENDING"), event, at(-H), false)).toBe("pending");
      expect(attendanceState(row("CONFIRMED"), event, at(H), false)).toBe("confirmed");
      expect(attendanceState(row("DECLINED"), event, at(-H), false)).toBe("declined");
    });
  });

  describe("R4 not_taken", () => {
    test("evento terminado sin lista → not_taken, sea cual sea el RSVP", () => {
      for (const status of ["PENDING", "CONFIRMED", "DECLINED"] as const) {
        expect(attendanceState(row(status), event, at(2 * H), false)).toBe("not_taken");
      }
    });

    test("sin endDate se asume una duración por defecto", () => {
      const e = { startDate: START };
      expect(attendanceState(row("CONFIRMED"), e, at(H), false)).toBe("confirmed");
      expect(attendanceState(row("CONFIRMED"), e, at(4 * H), false)).toBe("not_taken");
    });

    test("countsForEvent cuenta notTaken y no present/absent", () => {
      const rows = [row("CONFIRMED"), row("DECLINED"), row("PENDING")];
      expect(countsForEvent(rows, event, at(3 * H))).toEqual({
        present: 0, absent: 0, confirmed: 0, declined: 0, pending: 0, notTaken: 3,
      });
    });

    test("countsForEvent con lista tomada", () => {
      const rows = [row("DECLINED", true), row("CONFIRMED"), row("PENDING", true), row("PENDING")];
      expect(countsForEvent(rows, event, at(3 * H))).toEqual({
        present: 2, absent: 2, confirmed: 0, declined: 0, pending: 0, notTaken: 0,
      });
    });

    test("countsForEvent en curso, sin lista: RSVP", () => {
      const rows = [row("CONFIRMED"), row("DECLINED"), row("PENDING")];
      expect(countsForEvent(rows, event, at(-H))).toEqual({
        present: 0, absent: 0, confirmed: 1, declined: 1, pending: 1, notTaken: 0,
      });
    });
  });

  describe("attendanceRate", () => {
    test("present / (present + absent), excluyendo eventos sin lista", () => {
      const taken = { event, rows: [row("CONFIRMED", true), row("CONFIRMED", true), row("CONFIRMED"), row("DECLINED")] };
      const notTaken = { event, rows: [row("CONFIRMED"), row("CONFIRMED")] };
      expect(attendanceRate([taken, notTaken])).toBe(0.5);
    });

    test("null sin denominador", () => {
      expect(attendanceRate([])).toBeNull();
      expect(attendanceRate([{ event, rows: [row("CONFIRMED")] }])).toBeNull();
    });

    test("filter limita a un jugador tras decidir si hubo lista", () => {
      const rows = [row("PENDING", true), row("CONFIRMED")];
      expect(attendanceRate([{ event, rows }], (r) => r === rows[1])).toBe(0);
      expect(attendanceRate([{ event, rows }], (r) => r === rows[0])).toBe(1);
    });
  });

  describe("canSubmitRpe", () => {
    test("con lista tomada solo checkedIn", () => {
      expect(canSubmitRpe(row("CONFIRMED"), true)).toBe(false);
      expect(canSubmitRpe(row("DECLINED", true), true)).toBe(true);
    });
    test("sin lista, solo CONFIRMED", () => {
      expect(canSubmitRpe(row("CONFIRMED"), false)).toBe(true);
      expect(canSubmitRpe(row("PENDING"), false)).toBe(false);
      expect(canSubmitRpe(row("DECLINED"), false)).toBe(false);
    });
  });
});
