/** @jest-environment node */
import { gmtLabel, tzOptionsFor, TZ_OPTIONS } from "./timezones";

const OCT = new Date("2026-10-20T12:00:00Z");
const NOV = new Date("2026-11-20T12:00:00Z");

describe("gmtLabel", () => {
  test("Madrid: GMT+2 en octubre, GMT+1 en noviembre", () => {
    expect(gmtLabel("Europe/Madrid", OCT)).toBe("GMT+2");
    expect(gmtLabel("Europe/Madrid", NOV)).toBe("GMT+1");
  });
  test("Canarias: GMT+1 / GMT", () => {
    expect(gmtLabel("Atlantic/Canary", OCT)).toBe("GMT+1");
    expect(gmtLabel("Atlantic/Canary", NOV)).toBe("GMT");
  });
  test("Nueva York: GMT-4 / GMT-5", () => {
    expect(gmtLabel("America/New_York", OCT)).toBe("GMT-4");
    expect(gmtLabel("America/New_York", NOV)).toBe("GMT-5");
  });
  test("UTC → GMT; zona con media hora → GMT+5:30", () => {
    expect(gmtLabel("UTC", OCT)).toBe("GMT");
    expect(gmtLabel("Asia/Kolkata", OCT)).toBe("GMT+5:30");
  });
});

describe("tzOptionsFor", () => {
  test("etiqueta con ciudad", () => {
    const o = tzOptionsFor(OCT, "Europe/Madrid");
    expect(o.find((x) => x.tz === "Europe/Madrid")?.label).toBe("GMT+2 · Madrid");
    expect(o.find((x) => x.tz === "Atlantic/Canary")?.label).toBe("GMT+1 · Canarias");
  });
  test("tz fuera de lista se añade con ciudad del nombre IANA", () => {
    const o = tzOptionsFor(OCT, "America/Sao_Paulo");
    expect(o).toHaveLength(TZ_OPTIONS.length + 1);
    expect(o.find((x) => x.tz === "America/Sao_Paulo")?.label).toBe("GMT-3 · Sao Paulo");
  });
  test("tz en lista no se duplica", () => {
    expect(tzOptionsFor(OCT, "Europe/Madrid")).toHaveLength(TZ_OPTIONS.length);
  });
  test("ordenadas por offset ascendente", () => {
    const offs = tzOptionsFor(OCT, "Europe/Madrid").map((x) => {
      const m = /^GMT(?:([+-])(\d+)(?::(\d+))?)?/.exec(x.label)!;
      const v = m[1] ? Number(m[2]) * 60 + Number(m[3] ?? 0) : 0;
      return m[1] === "-" ? -v : v;
    });
    expect(offs).toEqual([...offs].sort((a, b) => a - b));
  });
  test("resultados idénticos con TZ del proceso distinta", () => {
    const run = (tz: string) =>
      require("child_process")
        .execFileSync(process.execPath, ["-e", `
          const f=new Intl.DateTimeFormat("en-US",{timeZone:"Europe/Madrid",timeZoneName:"shortOffset"});
          process.stdout.write(f.formatToParts(new Date("2026-10-20T12:00:00Z")).find(p=>p.type==="timeZoneName").value)`],
          { env: { ...process.env, TZ: tz } })
        .toString();
    expect(run("UTC")).toBe(run("America/Los_Angeles"));
    const a = JSON.stringify(tzOptionsFor(OCT, "Europe/Madrid"));
    const prev = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    const b = JSON.stringify(tzOptionsFor(OCT, "Europe/Madrid"));
    process.env.TZ = "UTC";
    const c = JSON.stringify(tzOptionsFor(OCT, "Europe/Madrid"));
    process.env.TZ = prev;
    expect(b).toBe(a);
    expect(c).toBe(a);
  });
});
