/**
 * @jest-environment node
 */

import { computeAcwr, weeklyLoads, weekKeyOffset, acwrZone } from "@/lib/acwr";
import { isoWeekKeyInTz } from "@/lib/week";

const TZ = "Europe/Madrid";

describe("weekKeyOffset", () => {
  test("semanas dentro del año y cruces de año (incluida la semana 53)", () => {
    expect(weekKeyOffset("2026-W43", 1)).toBe("2026-W42");
    expect(weekKeyOffset("2026-W43", 4)).toBe("2026-W39");
    expect(weekKeyOffset("2026-W02", 3)).toBe("2025-W51");
    expect(weekKeyOffset("2021-W01", 1)).toBe("2020-W53"); // 2020 tiene 53 semanas ISO
    expect(weekKeyOffset("2026-W43", -1)).toBe("2026-W44");
    expect(weekKeyOffset("2025-W52", -1)).toBe("2026-W01");
  });

  test("clave inválida → error", () => {
    expect(() => weekKeyOffset("2026-43", 1)).toThrow();
  });
});

describe("computeAcwr", () => {
  test("semanas completas: aguda = actual; crónica = media de las 4 anteriores (la aguda no entra)", () => {
    const loads = { "2026-W39": 400, "2026-W40": 400, "2026-W41": 400, "2026-W42": 400, "2026-W43": 500 };
    expect(computeAcwr(loads, "2026-W43")).toEqual({ acute: 500, chronic: 400, ratio: 1.25, zone: "sweet" });
  });

  test("la semana sin carga cuenta como 0 en la crónica", () => {
    const loads = { "2026-W40": 400, "2026-W41": 400, "2026-W43": 300 }; // W39 y W42 sin datos
    const r = computeAcwr(loads, "2026-W43");
    expect(r.chronic).toBe(200); // (0+400+400+0)/4
    expect(r.ratio).toBe(1.5);
  });

  test("aguda 0 con crónica > 0 → ratio 0 (zona low)", () => {
    expect(computeAcwr({ "2026-W42": 400 }, "2026-W43")).toMatchObject({ acute: 0, chronic: 100, ratio: 0, zone: "low" });
  });

  test("crónica 0 → ratio null y sin zona (la UI muestra «—»)", () => {
    expect(computeAcwr({ "2026-W43": 500 }, "2026-W43")).toEqual({ acute: 500, chronic: 0, ratio: null, zone: null });
    expect(computeAcwr({}, "2026-W43").ratio).toBeNull();
  });

  test("la carga anterior a 4 semanas no cuenta", () => {
    expect(computeAcwr({ "2026-W38": 9999, "2026-W43": 100 }, "2026-W43").chronic).toBe(0);
  });

  test("redondeo a 2 decimales", () => {
    expect(computeAcwr({ "2026-W39": 100, "2026-W40": 100, "2026-W41": 100, "2026-W42": 100, "2026-W43": 133 }, "2026-W43").ratio).toBe(1.33);
    expect(computeAcwr({ "2026-W39": 300, "2026-W40": 0, "2026-W41": 0, "2026-W42": 0, "2026-W43": 100 }, "2026-W43").ratio).toBe(1.33);
  });
});

describe("zonas en los límites", () => {
  test.each([
    [0.79, "low"],
    [0.8, "sweet"],
    [1.3, "sweet"],
    [1.31, "caution"],
    [1.5, "caution"],
    [1.51, "danger"],
    [0, "low"],
  ])("ratio %s → %s", (ratio, zone) => {
    expect(acwrZone(ratio)).toBe(zone);
  });

  test("null → null", () => {
    expect(acwrZone(null)).toBeNull();
  });
});

describe("weeklyLoads", () => {
  test("suma por semana ISO del calendario del equipo (domingo 23:30 UTC ya es lunes en Madrid)", () => {
    const entries = [
      { startDate: new Date("2026-10-18T10:00:00Z"), workload: 100 }, // domingo W42
      { startDate: new Date("2026-10-18T23:30:00Z"), workload: 50 }, // lunes 01:30 en Madrid → W43
      { startDate: new Date("2026-10-20T18:00:00Z"), workload: 70 }, // W43
    ];
    expect(weeklyLoads(entries, TZ)).toEqual({ "2026-W42": 100, "2026-W43": 120 });
    expect(weeklyLoads(entries, "UTC")).toEqual({ "2026-W42": 150, "2026-W43": 70 });
  });
});

// ---------------------------------------------------------------------------------------------
// Paridad con las fórmulas previas (copiadas tal cual del commit 1065324)
// ---------------------------------------------------------------------------------------------

const NOW = new Date("2026-10-21T10:00:00Z");

function weekSeries(count: number): string[] {
  const labels: string[] = [];
  for (let i = count - 1; i >= 0; i--) labels.push(isoWeekKeyInTz(new Date(NOW.getTime() - i * 7 * 86_400_000), TZ));
  return Array.from(new Set(labels)).slice(-count);
}

// Semilla fija: 30 casos reproducibles
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(1664525, s) + 1013904223) >>> 0) / 0xffffffff);
}

function buildCase(seed: number, weeksToFetch: number) {
  const rnd = lcg(seed);
  const uniqueWeeks = weekSeries(weeksToFetch);
  const dropProb = [0, 0.2, 0.5, 0.8][seed % 4]!;
  const loads: Record<string, number> = {};
  for (const w of uniqueWeeks) if (rnd() > dropProb) loads[w] = Math.round(rnd() * 900) + 50;
  return { uniqueWeeks, loads };
}

// Fórmula previa de api/analytics/rpe
function oldApi(uniqueWeeks: string[], loads: Record<string, number>, weeks: number) {
  const all = uniqueWeeks.map((week) => ({ week, workload: loads[week] ?? 0 }));
  const active = uniqueWeeks.slice(-weeks);
  const weeklyData = active.map((week) => {
    const indexInAll = uniqueWeeks.indexOf(week);
    const acute = all[indexInAll]!.workload;
    let sum = 0;
    let count = 0;
    for (let j = 1; j <= 4; j++) {
      const idx = indexInAll - j;
      if (idx >= 0) {
        sum += all[idx]!.workload;
        count++;
      }
    }
    const chronic = count > 0 ? sum / count : 0;
    return { week, workload: acute, acwr: chronic > 0 && acute > 0 ? Math.round((acute / chronic) * 100) / 100 : 0 };
  });
  let latest = { workload: 0, acwr: 0 };
  for (let i = weeklyData.length - 1; i >= 0; i--) {
    if (weeklyData[i]!.workload > 0) {
      latest = weeklyData[i]!;
      break;
    }
  }
  return { weeklyData, latestACWR: latest.acwr };
}

// Fórmula previa de lib/profile.ts
function oldProfile(uniqueWeeks: string[], loads: Record<string, number>, display: number) {
  const all = uniqueWeeks.map((week) => ({ week, workload: loads[week] ?? 0 }));
  const displayWeeks = uniqueWeeks.slice(-display);
  let acwr: number | null = null;
  for (let i = displayWeeks.length - 1; i >= 0; i--) {
    const indexInAll = uniqueWeeks.indexOf(displayWeeks[i]!);
    const acute = all[indexInAll]?.workload ?? 0;
    if (acute === 0) continue;
    let sum = 0;
    let count = 0;
    for (let j = 1; j <= 4; j++) {
      const idx = indexInAll - j;
      if (idx >= 0) {
        sum += all[idx]?.workload ?? 0;
        count++;
      }
    }
    const chronic = count > 0 ? sum / count : 0;
    acwr = chronic > 0 ? Math.round((acute / chronic) * 100) / 100 : null;
    break;
  }
  return acwr;
}

// Nueva forma de usarlo (misma que la API y el perfil tras el cambio)
function newApi(uniqueWeeks: string[], loads: Record<string, number>, weeks: number) {
  const active = uniqueWeeks.slice(-weeks);
  const weeklyData = active.map((week) => {
    const { acute, ratio } = computeAcwr(loads, week);
    return { week, workload: acute, acwr: ratio ?? 0 };
  });
  let latest = { workload: 0, acwr: 0 };
  for (let i = weeklyData.length - 1; i >= 0; i--) {
    if (weeklyData[i]!.workload > 0) {
      latest = weeklyData[i]!;
      break;
    }
  }
  return { weeklyData, latestACWR: latest.acwr };
}

function newProfile(uniqueWeeks: string[], loads: Record<string, number>, display: number) {
  const displayWeeks = uniqueWeeks.slice(-display);
  for (let i = displayWeeks.length - 1; i >= 0; i--) {
    const r = computeAcwr(loads, displayWeeks[i]!);
    if (r.acute === 0) continue;
    return r.ratio;
  }
  return null;
}

describe("paridad con las fórmulas previas de la API y del perfil (30 casos)", () => {
  const seeds = Array.from({ length: 30 }, (_, i) => i + 1);

  test.each(seeds)("caso %i: API (8 semanas) idéntica semana a semana y en «latest»", (seed) => {
    const { uniqueWeeks, loads } = buildCase(seed, 12);
    expect(newApi(uniqueWeeks, loads, 8)).toEqual(oldApi(uniqueWeeks, loads, 8));
  });

  test.each(seeds)("caso %i: perfil (4+4 semanas) idéntico", (seed) => {
    const { uniqueWeeks, loads } = buildCase(seed, 8);
    expect(newProfile(uniqueWeeks, loads, 4)).toBe(oldProfile(uniqueWeeks, loads, 4));
  });

  test("también con ventanas de la API de 1 y 16 semanas", () => {
    for (const weeks of [1, 16]) {
      const { uniqueWeeks, loads } = buildCase(7, weeks + 4);
      expect(newApi(uniqueWeeks, loads, weeks)).toEqual(oldApi(uniqueWeeks, loads, weeks));
    }
  });

  test("la serie de semanas es consecutiva y termina en la semana actual", () => {
    const series = weekSeries(12);
    expect(series).toHaveLength(12);
    expect(series[11]).toBe("2026-W43");
    series.forEach((w, i) => expect(weekKeyOffset("2026-W43", 11 - i)).toBe(w));
  });
});
