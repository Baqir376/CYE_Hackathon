"use client";
import { ratio } from "@/lib/api";
import { ratioEvidence } from "@/lib/evidence";
import { Badge, Card, cx, statusTone } from "../ui";
import { Evi, useCase } from "./shared";
import { motion } from "motion/react";

function Bullet({ v, rule, unit }: { v: number | null; rule: Record<string, number>; unit: string }) {
  const lowerBad = rule.min !== undefined || rule.warn_min !== undefined;
  const a = lowerBad ? (rule.min ?? rule.warn_min) : (rule.warn_max ?? rule.max);
  const b = lowerBad ? (rule.warn_min ?? rule.min) : (rule.max ?? rule.warn_max);
  const top = Math.max((v ?? 0) * 1.25, b * 1.6, a * 1.6, 0.0001);
  const pct = (x: number) => `${Math.min(100, Math.max(0, (x / top) * 100))}%`;
  const zones = lowerBad ? ["bg-red/45", "bg-amber/45", "bg-green/35"] : ["bg-green/35", "bg-amber/45", "bg-red/45"];
  return (
    <div className="w-40" title={`policy: ${JSON.stringify(rule)}`}>
      <div className="relative h-2 rounded-full overflow-hidden flex bg-paper">
        <span className={zones[0]} style={{ width: pct(a) }} />
        <span className={zones[1]} style={{ width: `calc(${pct(b)} - ${pct(a)})` }} />
        <span className={`flex-1 ${zones[2]}`} />
      </div>
      {v !== null && <motion.span className="relative block -mt-[11px] h-[14px] w-[3px] rounded bg-ink"
        initial={{ left: "0%" }} animate={{ left: pct(v) }} transition={{ type: "spring", stiffness: 140, damping: 14, delay: 0.2 }} />}
      <p className="text-[12px] text-muted num mt-1">{ruleText(rule, unit)}</p>
    </div>
  );
}

const GROUPS: [string, string[]][] = [
  ["Liquidity", ["current_ratio", "quick_ratio"]],
  ["Leverage & debt service", ["debt_to_equity", "leverage", "gearing", "interest_cover", "dscr", "cfo_to_debt"]],
  ["Profitability", ["gross_margin", "ebit_margin", "net_margin", "roa", "roe"]],
  ["Efficiency & cash conversion", ["receivable_days", "inventory_days", "payable_days", "cash_conversion"]],
  ["Growth", ["revenue_growth", "profit_growth"]],
];

function ruleText(rule: Record<string, number>, unit: string) {
  const f = (v: number) => ratio(v, unit);
  const parts = [];
  if (rule.min !== undefined) parts.push(`min ${f(rule.min)}`);
  if (rule.max !== undefined) parts.push(`max ${f(rule.max)}`);
  if (rule.warn_min !== undefined) parts.push(`watch < ${f(rule.warn_min)}`);
  if (rule.warn_max !== undefined) parts.push(`watch > ${f(rule.warn_max)}`);
  return parts.join(" · ");
}

export default function Ratios() {
  const { c, flash } = useCase();
  const [cur, prev] = c.periods;
  const pol = Object.fromEntries(c.policy_results.map((p) => [p.ratio, p]));
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[13px]r text-muted">Credit policy applied</p>
            <p className="font-serif text-lg font-semibold">{c.policy_name}</p>
            <p className="text-xs text-muted mt-0.5 max-w-2xl">{c.policy_description}</p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            {(["pass", "watch", "breach"] as const).map((s) => (
              <Badge key={s} tone={statusTone(s)}>{c.policy_results.filter((p) => p.status === s).length} {s}</Badge>
            ))}
          </div>
        </div>
      </Card>
      {GROUPS.map(([g, keys]) => (
        <Card key={g} className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-paper/70 text-xs text-muted">
                <th className="text-left px-4 py-2 font-semibold text-ink">{g}</th>
                {c.periods.map((p) => <th key={p} className="text-right px-4 py-2 font-medium num w-28">{p}</th>)}
                <th className="text-left px-4 py-2 font-medium">Formula</th>
                <th className="text-left px-4 py-2 font-medium w-60">Policy</th>
              </tr>
            </thead>
            <tbody>
              {keys.filter((k) => c.ratios[k]).map((k) => {
                const r = c.ratios[k];
                const p = pol[k];
                const v0 = r.values[cur], v1 = prev ? r.values[prev] : undefined;
                const trend = v0 !== undefined && v1 !== undefined ? (v0 > v1 ? "▲" : v0 < v1 ? "▼" : "•") : "";
                const good = r.higher_is_better === null || v0 === undefined || v1 === undefined ? null : (v0 > v1) === r.higher_is_better;
                return (
                  <tr key={k} className="border-t border-line/70">
                    <td className="px-4 py-2">{r.name}</td>
                    {c.periods.map((per, i) => (
                      <td key={per} className="px-4 py-2 text-right num">
                        {r.values[per] !== undefined ? <motion.span key={r.values[per]} className="inline-block rounded px-1 -mx-1" initial={flash.has(`r:${k}:${per}`) ? { backgroundColor: "rgba(244,211,94,1)" } : false}
                          animate={{ backgroundColor: "rgba(244,211,94,0)" }} transition={{ duration: 2.2 }}><Evi ev={ratioEvidence(c, k, per)}>{ratio(r.values[per], r.unit)}</Evi></motion.span>
                          : <span className="text-muted text-xs" title={r.notes[per]}>{r.notes[per] ? "n/m" : "—"}</span>}
                        {i === 0 && trend && <span className={cx("ml-1.5 text-[12px]", good === null ? "text-muted" : good ? "text-green" : "text-red")}>{trend}</span>}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-xs text-muted">{r.formula}</td>
                    <td className="px-4 py-2">
                      {p ? <div className="flex items-center gap-3"><Badge tone={statusTone(p.status)} className="w-14 justify-center">{p.status}</Badge>
                        <Bullet v={p.value} rule={p.rule} unit={p.unit} /></div>
                        : <span className="text-xs text-muted">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}
