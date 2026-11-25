"use client";
import { useState } from "react";
import { Check, Row } from "@/lib/api";
import { Evidence, fmtM, mergeTargets, rowById, rowTargets, spreadEvidence } from "@/lib/evidence";
import { Badge, Card, cx, statusTone } from "../ui";
import { EditRow } from "./Spread";
import { press, useCase } from "./shared";

export default function Checks() {
  const { c, open, activeKey } = useCase();
  const [fix, setFix] = useState<{ r: Row; period: string; value: number } | null>(null);
  const order = { fail: 0, warn: 1, info: 2, pass: 3 } as Record<string, number>;
  const list = [...c.checks].sort((a, b) => order[a.status] - order[b.status]);

  function evidenceFor(ch: Check): Evidence | null {
    if (ch.page && ch.bbox) {
      const doc = c.documents.find((d) => d.id === ch.doc_id) || c.documents[0];
      return { key: `ck:${ch.id}`, title: ch.check, subtitle: `Auditor's report · page ${ch.page}`, targets: [{ doc_id: doc.id, page: ch.page, boxes: [{ bbox: ch.bbox, kind: "flag" }] }] };
    }
    if (ch.rows?.length) {
      const rows = ch.rows.map((id) => rowById(c, id)).filter(Boolean) as Row[];
      return { key: `ck:${ch.id}`, title: ch.check, subtitle: ch.note, targets: rowTargets(rows, ch.period || undefined),
        lines: ch.expected != null ? [{ label: "Sum of component lines", value: fmtM(ch.expected) }, { label: "Printed / used", value: fmtM(ch.actual!) }] : undefined };
    }
    if (ch.inputs?.length && ch.period) {
      const evs = ch.inputs.map((i) => spreadEvidence(c, i, ch.period!)).filter(Boolean) as Evidence[];
      return { key: `ck:${ch.id}`, title: `${ch.check} · ${ch.period}`, subtitle: ch.note,
        lines: evs.map((e) => ({ label: e.title, value: e.lines?.length === 1 ? e.lines[0].value : "", onClickKey: e.key })),
        targets: mergeTargets(evs.flatMap((e) => e.targets)) };
    }
    return null;
  }

  const counts = { pass: 0, fail: 0, warn: 0, info: 0 } as Record<string, number>;
  c.checks.forEach((x) => counts[x.status]++);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[["pass", "Passed", "green"], ["fail", "Failed", "red"], ["warn", "Needs attention", "amber"]].map(([k, l, t]) => (
          <Card key={k} className="p-3.5 flex items-center justify-between">
            <span className="text-sm text-ink-2">{l}</span><Badge tone={t} className="text-sm px-2">{counts[k]}</Badge>
          </Card>
        ))}
      </div>
      <Card className="overflow-x-auto">
        <ul>
          {list.map((ch) => {
            const ev = evidenceFor(ch);
            const arith = ch.id.startsWith("ARITH:") && ch.expected != null && ch.period;
            const sub = arith ? rowById(c, ch.rows![0]) : null;
            return (
              <li key={ch.id} onClick={() => ev && open(ev)}
                className={cx("border-t border-line/70 first:border-0 px-4 py-3 flex gap-3", ev && "cursor-pointer hover:bg-paper/60", activeKey === ev?.key && "bg-amber-soft/60")}>
                <span className={cx("mt-0.5 h-5 w-5 shrink-0 rounded-full text-[13px] flex items-center justify-center text-white",
                  ch.status === "pass" ? "bg-green" : ch.status === "fail" ? "bg-red" : ch.status === "warn" ? "bg-amber" : "bg-muted")}>
                  {ch.status === "pass" ? "✓" : ch.status === "fail" ? "✕" : "!"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {ev ? <span {...press(() => open(ev))} className="text-[15px] font-medium hover:underline">{ch.check}</span> : <span className="text-[15px] font-medium">{ch.check}</span>}
                    {ch.period && <Badge>{ch.period}</Badge>}
                    {ch.severity && <Badge tone={statusTone(ch.severity)}>{ch.severity}</Badge>}
                  </div>
                  {ch.expected != null && ch.actual != null && ch.status !== "pass" && (
                    <p className="text-xs num text-ink-2 mt-1">
                      expected {fmtM(ch.expected)} · found {fmtM(ch.actual)} · difference <span className="text-red font-semibold">{fmtM(ch.difference || 0)}</span>
                    </p>
                  )}
                  {ch.missing && <p className="text-xs text-ink-2 mt-1">Missing: {ch.missing.join(", ")}</p>}
                  {ch.note && <p className="text-xs text-muted mt-1">{ch.note}</p>}
                  {arith && sub && !c.overrides[sub.id] && (
                    <button onClick={(e) => { e.stopPropagation(); setFix({ r: sub, period: ch.period!, value: ch.expected! / (sub.unit || 1) }); }}
                      className="mt-2 text-xs rounded border border-teal/40 text-teal px-2 py-1 hover:bg-teal-soft">
                      Use re-computed sum ({(ch.expected! / (sub.unit || 1)).toLocaleString()}) …
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
      {fix && <EditRow r={fix.r} onClose={() => setFix(null)}
        preset={{ period: fix.period, value: fix.value, reason: "Printed subtotal does not cast; replaced with the sum of its component lines. Borrower to confirm." }} />}
    </div>
  );
}
