import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import NextSteps from "@/components/app/NextSteps";
import { GROUPS, sumOf } from "@/components/landing/SpotIt";
import { money, ratio, rawThousands, type Case } from "@/lib/api";
import { factEvidence, fmtM, mergeTargets, spreadEvidence } from "@/lib/evidence";

afterEach(cleanup);

const row = { id: "D1:BS3-1", statement: "BS", page: 3, section: "", label: "Trade debts", note: null, values: { FY2026: { value: 1420000, raw: "1,420,000", bbox: [1, 2, 3, 4] } }, label_bbox: [0, 2, 1, 4],
  is_subtotal: false, verified_sum_of: [], doc_id: "d", unit: 1000, code: "BS.TRADE_RECEIVABLES", confidence: "high", map_source: null, rule_code: null, ai_code: null };
const base = { id: "x", status: "ready", documents: [{ id: "d", filename: "a.pdf", periods: ["FY2026"], unit: 1000, size: 1 }], rows: [row], overrides: {}, checks: [], signals: [], ratios: {}, periods: ["FY2026"],
  spread: { "BS.TRADE_RECEIVABLES": { code: "BS.TRADE_RECEIVABLES", name: "Trade receivables", statement: "BS", values: { FY2026: { value: 1.42e9, rows: ["D1:BS3-1"], derived: false } } } },
  memo: { stats: { unverified: 0, verified: 1, sentences: 1, numbers_checked: 1 }, sections: [] } } as unknown as Case;

describe("formatting", () => {
  it.each([[4_850_000_000, "4,850"], [125_000_000, "125.0"], [-396_000_000, "(396.0)"], [null, "—"], [Number.NaN, "—"]])("money %s", (v, s) => expect(money(v as number)).toBe(s));
  it.each([[0.16, "%", "16.0%"], [1.2149, "x", "1.21x"], [106.9, "days", "107d"], [undefined, "x", "—"]])("ratio %s", (v, u, s) => expect(ratio(v as number, u as string)).toBe(s));
  it("brackets negatives", () => expect(rawThousands(-342000)).toBe("(342,000)"));
  it("keeps the minus outside the currency", () => expect(fmtM(-396e6)).toBe("-Rs 396.0 mn"));
});

describe("evidence", () => {
  it("points a figure at its exact cell", () => {
    const e = spreadEvidence(base, "BS.TRADE_RECEIVABLES", "FY2026")!;
    expect(e.targets).toEqual([{ doc_id: "d", page: 3, boxes: [{ bbox: [0, 2, 1, 4], kind: "label" }, { bbox: [1, 2, 3, 4], kind: "value", text: "1,420,000" }] }]);
  });
  it("returns nothing for unknown facts instead of crashing", () => {
    for (const f of ["F:NOPE:FY2026", "R:nope:FY2026", "S:NOPE:FY2026", "", "x"]) expect(factEvidence(base, f)).toBeNull();
  });
  it("merges boxes on the same page", () => expect(mergeTargets([{ doc_id: "d", page: 1, boxes: [{ bbox: [], kind: "value" }] }, { doc_id: "d", page: 1, boxes: [{ bbox: [], kind: "label" }] }])[0].boxes).toHaveLength(2));
});

describe("what to do next", () => {
  const show = (c: Partial<Case>, seen: string[] = []) => {
    const goto = vi.fn(), submit = vi.fn(), redraft = vi.fn();
    render(<NextSteps c={{ ...base, ...c } as Case} seen={new Set(seen)} goto={goto} onSubmit={submit} redraft={redraft} busy={false} />);
    return { goto, submit, redraft };
  };
  it("starts with failed checks", () => {
    const { goto } = show({ checks: [{ id: "a", check: "", period: null, status: "fail", severity: null }] });
    fireEvent.click(screen.getByText("Open checks"));
    expect(goto).toHaveBeenCalledWith("checks");
  });
  it("offers submit only once everything is done", () => {
    const { submit } = show({}, ["memo"]);
    fireEvent.click(screen.getByText("Submit"));
    expect(submit).toHaveBeenCalled();
  });
  it("asks for a redraft when figures changed", () => {
    const { redraft } = show({ memo: { ...base.memo!, stale: true } }, ["memo"]);
    fireEvent.click(screen.getByText("Redraft now"));
    expect(redraft).toHaveBeenCalled();
  });
});

describe("spot the mistake", () => {
  it("has exactly one wrong total, off by 10,000", () => expect(GROUPS.map((g) => g.printed - sumOf(g))).toEqual([0, 0, 0, 10000]));
});
