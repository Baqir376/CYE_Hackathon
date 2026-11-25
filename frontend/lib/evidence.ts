import { Case, Row, rawThousands } from "./api";

export type Box = { bbox: number[]; kind: "value" | "label" | "flag"; text?: string };
export type Target = { doc_id: string; page: number; boxes: Box[]; caption?: string };
export type Evidence = {
  key: string;
  title: string;
  subtitle?: string;
  formula?: string;
  lines?: { label: string; value: string; onClickKey?: string }[];
  targets: Target[];
};

export function rowById(c: Case, id: string): Row | undefined {
  return c.rows.find((r) => r.id === id);
}

export function rowTargets(rows: Row[], period?: string): Target[] {
  const map = new Map<string, Target>();
  for (const r of rows) {
    const k = `${r.doc_id}:${r.page}`;
    if (!map.has(k)) map.set(k, { doc_id: r.doc_id, page: r.page, boxes: [] });
    const t = map.get(k)!;
    if (r.label_bbox) t.boxes.push({ bbox: r.label_bbox, kind: "label" });
    const ps = period ? [period] : Object.keys(r.values);
    for (const p of ps) {
      const cell = r.values[p];
      if (cell) t.boxes.push({ bbox: cell.bbox, kind: "value", text: cell.raw });
    }
  }
  return [...map.values()];
}

export function rowEvidence(c: Case, r: Row, period?: string): Evidence {
  const unitTxt = r.unit === 1000 ? "Rs '000" : r.unit === 1_000_000 ? "Rs mn" : "Rs";
  const doc = c.documents.find((d) => d.id === r.doc_id);
  return {
    key: `row:${r.id}:${period || ""}`,
    title: r.label || "Row",
    subtitle: `${doc?.filename || ""} · page ${r.page}${r.note ? ` · note ${r.note}` : ""}`,
    lines: Object.entries(r.values).map(([p, cell]) => ({
      label: `${p} as printed (${unitTxt})`,
      value: cell.overridden ? `${cell.raw} → ${rawThousands(cell.value)} (analyst)` : cell.raw,
    })),
    targets: rowTargets([r], period),
  };
}

export function spreadEvidence(c: Case, code: string, period: string): Evidence | null {
  const item = c.spread[code];
  const v = item?.values[period];
  if (!item || !v) return null;
  if (v.derived) {
    const inputs = (v.inputs || []).filter((i) => c.spread[i]?.values[period]);
    const rows = inputs.flatMap((i) => c.spread[i].values[period].rows).map((id) => rowById(c, id)).filter(Boolean) as Row[];
    return {
      key: `sp:${code}:${period}`,
      title: `${item.name} · ${period}`,
      subtitle: "Derived figure: calculated by CredIQ, not printed in the statements",
      formula: v.formula,
      lines: inputs.map((i) => ({ label: c.spread[i].name, value: fmtM(c.spread[i].values[period].value), onClickKey: `sp:${i}:${period}` })),
      targets: rowTargets(rows, period),
    };
  }
  const rows = v.rows.map((id) => rowById(c, id)).filter(Boolean) as Row[];
  return {
    key: `sp:${code}:${period}`,
    title: `${item.name} · ${period}`,
    subtitle: rows.length > 1 ? `Sum of ${rows.length} statement lines` : `From ${c.documents.find((d) => d.id === rows[0]?.doc_id)?.filename || "document"}, page ${rows[0]?.page}`,
    lines: rows.map((r) => ({ label: r.label, value: r.values[period]?.raw || "—" })),
    targets: rowTargets(rows, period),
  };
}

export function ratioEvidence(c: Case, key: string, period: string): Evidence | null {
  const r = c.ratios[key];
  if (!r) return null;
  const inputs = r.inputs.filter((i) => c.spread[i]);
  const periods = key.endsWith("_growth") ? c.periods.slice(c.periods.indexOf(period), c.periods.indexOf(period) + 2) : [period];
  const rows: Row[] = [];
  const lines: Evidence["lines"] = [];
  for (const p of periods) {
    for (const i of inputs) {
      const v = c.spread[i].values[p];
      if (!v) continue;
      lines.push({ label: `${c.spread[i].name}${periods.length > 1 ? ` (${p})` : ""}`, value: fmtM(v.value), onClickKey: `sp:${i}:${p}` });
      const src = v.derived ? (v.inputs || []).flatMap((x) => c.spread[x]?.values[p]?.rows || []) : v.rows;
      src.forEach((id) => {
        const row = rowById(c, id);
        if (row) rows.push(row);
      });
    }
  }
  return {
    key: `r:${key}:${period}`,
    title: `${r.name} · ${period}`,
    subtitle: "Ratio computed deterministically from spread figures",
    formula: r.formula,
    lines,
    targets: rowTargets(rows, periods.length > 1 ? undefined : period),
  };
}

export function factEvidence(c: Case, fid: string): Evidence | null {
  const [kind, code, period] = fid.split(":");
  if (kind === "F") return spreadEvidence(c, code, period);
  if (kind === "R") return ratioEvidence(c, code, period);
  if (kind === "S") {
    const s = c.signals.find((x) => x.id === code);
    if (!s) return null;
    const subs = s.facts.map((f) => factEvidence(c, f)).filter(Boolean) as Evidence[];
    return {
      key: `s:${code}`,
      title: s.title,
      subtitle: s.detail,
      lines: subs.map((e) => ({ label: e.title, value: e.lines?.[0]?.value || "", onClickKey: e.key })),
      targets: mergeTargets(subs.flatMap((e) => e.targets)),
    };
  }
  return null;
}

export function evidenceByKey(c: Case, key: string): Evidence | null {
  const [k, a, b] = key.split(":");
  if (k === "sp") return spreadEvidence(c, a, b);
  if (k === "r") return ratioEvidence(c, a, b);
  if (k === "row") {
    const id = key.slice(4).split(":").slice(0, 2).join(":");
    const r = rowById(c, id);
    return r ? rowEvidence(c, r) : null;
  }
  return null;
}

export function mergeTargets(ts: Target[]): Target[] {
  const m = new Map<string, Target>();
  for (const t of ts) {
    const k = `${t.doc_id}:${t.page}`;
    if (!m.has(k)) m.set(k, { ...t, boxes: [] });
    m.get(k)!.boxes.push(...t.boxes);
  }
  return [...m.values()];
}

export function fmtM(v: number) {
  const mn = v / 1_000_000;
  const a = Math.abs(mn);
  const s = a >= 1000 ? a.toLocaleString("en-US", { maximumFractionDigits: 0 }) : a.toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  return `${mn < 0 ? "-" : ""}Rs ${s} mn`;
}
