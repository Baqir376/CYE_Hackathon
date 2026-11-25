import { describe, expect, it } from "vitest";
import data from "@/lib/ledger.json";
import { CALM, room, stress, verdict, type Base, type Limits } from "@/lib/stress";

const b = data.base as Base, limits = data.limits as Limits;

describe("stress test", () => {
  it("changes nothing when nothing is stressed: matches the Python engine", () => {
    const r = stress(b, CALM);
    expect(r.np).toBeCloseTo(b.np, 2);
    for (const [k, v] of Object.entries(r.ratios)) expect(v, k).toBeCloseTo((data.ratios as Record<string, number>)[k], 6);
  });
  it("money in always equals money out", () => {
    for (const s of [CALM, { ...CALM, sales: -0.2 }, { sales: 0.1, rate: 0.05, days: 60, vary: 0.7 }]) {
      const r = stress(b, s);
      expect(r.rev + r.oi - r.cogs - r.opex - r.fc - r.tax - r.np).toBeCloseTo(0, 1);
    }
  });
  it("every shock hurts in the right direction", () => {
    const calm = stress(b, CALM).ratios;
    expect(stress(b, { ...CALM, sales: -0.1 }).ratios.interest_cover!).toBeLessThan(calm.interest_cover!);
    expect(stress(b, { ...CALM, rate: 0.03 }).ratios.interest_cover!).toBeLessThan(calm.interest_cover!);
    expect(stress(b, { ...CALM, days: 30 }).ratios.debt_to_equity!).toBeGreaterThan(calm.debt_to_equity!);
  });
  it("finds the exact point where a limit breaks", () => {
    for (const [k, far] of [["sales", -0.5], ["rate", 0.2], ["days", 200]] as const) {
      const r = room(b, limits, k, far);
      expect(r.at).not.toBeNull();
      const before = stress(b, { ...CALM, [k]: r.at! * 0.999 }).ratios, after = stress(b, { ...CALM, [k]: r.at! * 1.001 }).ratios;
      expect(verdict(before[r.ratio!], limits[r.ratio!], r.ratio!)).not.toBe("breach");
      expect(verdict(after[r.ratio!], limits[r.ratio!], r.ratio!)).toBe("breach");
    }
  });
  it("copes with no debt, losses and empty figures", () => {
    const zero = Object.fromEntries(Object.keys(b).map((k) => [k, 0])) as Base;
    expect(stress(zero, CALM).ratios.current_ratio).toBeNull();
    expect(stress({ ...b, debt: 0, fc: 0, recv: 0 }, { ...CALM, rate: 0.1 }).fc).toBe(0);
    const loss = stress(b, { ...CALM, sales: -0.4 });
    expect(loss.np).toBeLessThan(0);
    expect(loss.tax).toBe(0);
    expect(room({ ...b, ebit: 1 }, limits, "sales", -0.5).already).toBe(true);
    expect(verdict(-3, { max: 2 }, "debt_to_equity")).toBe("breach");
  });
});
