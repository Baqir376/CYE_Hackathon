"use client";
import { ratio } from "@/lib/api";
import { factEvidence, ratioEvidence, rowEvidence, rowById, spreadEvidence } from "@/lib/evidence";
import { Badge, Card, cx, statusTone } from "../ui";
import Trace from "./Trace";
import { motion } from "motion/react";
import { CountUp, EASE } from "../motion/primitives";
import { Glass, PolicyDial } from "../fx/Glass";
import River from "../fx/River";
import { RATIO_NAMES } from "../fx/StressLab";
import { baseOf, CALM, limitsOf, room, stress } from "@/lib/stress";
import { Evi, press, useCase } from "./shared";

export default function Overview({ goto }: { goto: (tab: string) => void }) {
  const { c, open } = useCase();
  const [cur, prev] = c.periods;
  const sv = (code: string, p?: string) => (p ? c.spread[code]?.values[p]?.value : undefined);
  const rv = (k: string, p?: string) => (p ? c.ratios[k]?.values[p] : undefined);

  const tiles: { label: string; kind: "f" | "r"; key: string; unit?: string; good?: boolean | null }[] = [
    { label: "Net revenue", kind: "f", key: "IS.REVENUE", good: true },
    { label: "Net profit", kind: "f", key: "IS.NET_PROFIT", good: true },
    { label: "Operating cash flow", kind: "f", key: "CF.CFO", good: true },
    { label: "Current ratio", kind: "r", key: "current_ratio", unit: "x", good: true },
    { label: "Debt / Equity", kind: "r", key: "debt_to_equity", unit: "x", good: false },
    { label: "Interest cover", kind: "r", key: "interest_cover", unit: "x", good: true },
  ];
  const fails = c.checks.filter((x) => x.status === "fail");
  const warns = c.checks.filter((x) => x.status === "warn");
  const passes = c.checks.filter((x) => x.status === "pass");
  const breaches = c.policy_results.filter((p) => p.status === "breach");
  const watches = c.policy_results.filter((p) => p.status === "watch");

  const dial = <PolicyDial pass={c.policy_results.filter((p) => p.status === "pass").length} watch={watches.length} breach={breaches.length} />;
  const base = baseOf(c);
  const slack = base ? room(base, limitsOf(c), "sales", -0.4) : null;
  const pulse = !base || !slack ? null : slack.already ? "At least one policy limit is already broken." : slack.at === null ? "A 40% fall in sales would not break a policy limit." : `Sales can fall ${Math.abs(slack.at * 100).toFixed(1)}% before ${RATIO_NAMES[slack.ratio!][0].toLowerCase()} breaks the limit.`;

  return (
    <div className="space-y-4">
      {base && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]">
        <Glass delay={0.05} className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <h2 className="font-display text-[clamp(22px,2vw,30px)] leading-[1.2] max-w-[620px]">{pulse}</h2>
            <button onClick={() => goto("stress")} className="rounded-[10px] bg-ink text-white px-4 py-2.5 text-[15px] font-bold hover:bg-blue transition-colors">Stress test it</button>
          </div>
          <div className="mt-3"><River flow={stress(base, CALM)} base={base.rev + base.oi} onPick={(code) => cur && c.spread[code] && open(spreadEvidence(c, code, cur))} /></div>
        </Glass>
        <Glass delay={0.14} tilt={6} className="p-6">
          <h2 className="text-[17px] font-bold">Policy limits</h2>
          <div className="mt-4">{dial}</div>
          <ul className="mt-5 grid gap-2.5 text-[15px]">
            {[...breaches, ...watches].slice(0, 5).map((p) => <li key={p.ratio} className="flex justify-between gap-3"><span {...press(() => { if (cur) open(ratioEvidence(c, p.ratio, cur)); })} onClick={() => cur && open(ratioEvidence(c, p.ratio, cur))} className="cursor-pointer hover:underline">{p.name}</span><span className="num font-semibold">{ratio(p.value, p.unit)}</span></li>)}
          </ul>
        </Glass>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {tiles.map((t) => {
          const v = t.kind === "f" ? sv(t.key, cur) : rv(t.key, cur);
          const pv = t.kind === "f" ? sv(t.key, prev) : rv(t.key, prev);
          const delta = v !== undefined && pv !== undefined && pv !== 0 ? (t.kind === "f" ? (v - pv) / Math.abs(pv) : v - pv) : null;
          const better = delta === null || t.good === null ? null : t.good ? delta > 0 : delta < 0;
          const ev = t.kind === "f" ? (cur ? spreadEvidence(c, t.key, cur) : null) : cur ? ratioEvidence(c, t.key, cur) : null;
          return (
            <Glass key={t.key} tilt={9} delay={0.15 + tiles.indexOf(t) * 0.07} className="p-4">
              <p className="text-[13px] text-muted">{t.label}</p>
              <p className="num text-[28px] font-semibold mt-1.5 leading-none">
                {v === undefined ? <span className="text-muted text-base">n/a</span> : (
                  <Evi ev={ev}>{t.kind === "f" ? <CountUp to={Math.abs(v / 1e6)} decimals={Math.abs(v / 1e6) >= 1000 ? 0 : 1} prefix={v < 0 ? "(" : ""} suffix={v < 0 ? ")" : ""} className="" /> : <CountUp to={v} decimals={t.unit === "x" ? 2 : 0} suffix={t.unit === "x" ? "x" : ""} />}</Evi>
                )}
                {t.kind === "f" && v !== undefined && <span className="text-xs text-muted font-normal ml-1">mn</span>}
              </p>
              {delta !== null && (
                <p className={cx("text-xs mt-1.5 num", better === null ? "text-muted" : better ? "text-green" : "text-red")}>
                  {delta > 0 ? "▲" : "▼"} {t.kind === "f" ? `${Math.abs(delta * 100).toFixed(1)}%` : Math.abs(delta).toFixed(2)} vs {prev}
                </p>
              )}
              {v !== undefined && pv !== undefined && (
                <div className="mt-3 flex items-end gap-1.5 h-9" aria-hidden>
                  {[pv, v].map((n, i) => <motion.span key={i} className={cx("w-8 rounded-[4px] origin-bottom", i ? (better === false ? "bg-magenta" : "bg-green") : "bg-ink/20")} style={{ height: `${Math.max(8, (Math.abs(n) / Math.max(Math.abs(v), Math.abs(pv), 1e-9)) * 100)}%` }} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ type: "spring", stiffness: 120, damping: 14, delay: 0.5 + tiles.indexOf(t) * 0.07 + i * 0.12 }} />)}
                </div>
              )}
            </Glass>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card title={`Risk signals (${c.signals.length})`} right={<button onClick={() => goto("memo")} className="text-xs text-teal hover:underline">In memo →</button>}>
          <ul className="px-4 pb-4 space-y-2">
            {c.signals.length === 0 && <li className="text-sm text-muted">No trend-based risk signals triggered.</li>}
            {c.signals.map((s, si) => (
              <motion.li initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + si * 0.08, ease: EASE }} whileHover={{ x: 3 }} key={s.id}
                onClick={() => open(factEvidence(c, `S:${s.id}:${cur}`))}
                className={`rounded-lg border p-3 cursor-pointer hover:border-ink-2/40 transition-colors ${s.severity === "high" ? "border-red/25 bg-red-soft/80" : "border-white bg-white/60"}`}>
                <div className="flex items-center gap-2">
                  <Badge tone={statusTone(s.severity)}>{s.severity}</Badge>
                  <span {...press(() => open(factEvidence(c, `S:${s.id}:${cur}`)))} className="font-medium text-sm hover:underline">{s.title}</span>
                </div>
                <p className="text-[13px] text-ink-2 mt-1">{s.detail}</p>
              </motion.li>
            ))}
          </ul>
        </Card>

        <div className="space-y-5">
          <Card title="Verification" right={<button onClick={() => goto("checks")} className="text-xs text-teal hover:underline">All checks →</button>}>
            <div className="px-4 pb-4">
              <div className="flex gap-2 flex-wrap">
                <Badge tone="green">{passes.length} passed</Badge>
                <Badge tone="red">{fails.length} failed</Badge>
                <Badge tone="amber">{warns.length} need attention</Badge>
              </div>
              <ul className="mt-3 space-y-1.5">
                {[...fails, ...warns].slice(0, 5).map((ch) => (
                  <li key={ch.id} className="text-[13px] flex items-start gap-2 cursor-pointer hover:text-teal"
                    onClick={() => {
                      if (ch.rows?.length) { const r = rowById(c, ch.rows[0]); if (r) open(rowEvidence(c, r, ch.period || undefined)); }
                      else goto("checks");
                    }}>
                    <span className={ch.status === "fail" ? "text-red" : "text-amber"}>{ch.status === "fail" ? "✕" : "!"}</span>
                    <span>{ch.check}{ch.period ? ` · ${ch.period}` : ""}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
          <Card title={`Policy · ${c.policy_name}`} right={<button onClick={() => goto("ratios")} className="text-xs text-teal hover:underline">Ratios →</button>}>
            {!base && <div className="pb-3">{dial}</div>}
            <div className="px-4 pb-4 flex gap-2 flex-wrap">
              {c.policy_results.map((p) => (
                <span key={p.ratio} {...press(() => { if (cur) open(ratioEvidence(c, p.ratio, cur)); })} onClick={() => cur && open(ratioEvidence(c, p.ratio, cur))} className="cursor-pointer">
                  <Badge tone={statusTone(p.status)} title={JSON.stringify(p.rule)}>{p.name}: {ratio(p.value, p.unit)}</Badge>
                </span>
              ))}
            </div>
            {(breaches.length > 0 || watches.length > 0) && (
              <p className="px-4 pb-4 -mt-1 text-xs text-muted">{breaches.length} breach(es), {watches.length} on watch. Thresholds come from the selected bank policy, not from SBP.</p>
            )}
          </Card>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card title="How this analysis was produced">
          <div className="px-4 pb-4"><Trace c={c} compact /></div>
        </Card>
        <Card title="Documents">
          <ul className="px-4 pb-4 space-y-3">
            {c.documents.map((d) => (
              <li key={d.id} className="text-sm">
                <p className="font-medium">{d.filename}</p>
                <p className="text-xs text-muted mt-0.5">
                  {d.pages} pages · {d.basis} statements · {d.unit === 1000 ? "Rs '000" : d.unit === 1_000_000 ? "Rs mn" : "Rs"} · {d.periods?.join(", ")}
                  {d.scanned_pages ? ` · ${d.scanned_pages} scanned pages skipped` : ""}
                </p>
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  {(d.statement_pages || []).map((sp) => (
                    <span key={sp.page} onClick={() => open({ key: `pg:${d.id}:${sp.page}`, title: sp.title, subtitle: `${d.filename} · page ${sp.page}`, targets: [{ doc_id: d.id, page: sp.page, boxes: [] }] })}
                      className="cursor-pointer"><Badge tone="teal">{sp.statement} · p.{sp.page}</Badge></span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
