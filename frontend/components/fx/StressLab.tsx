"use client";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { ratio } from "@/lib/api";
import { CALM, room, stress, verdict, type Base, type Knob, type Limits, type Shock } from "@/lib/stress";
import { cx } from "../ui";
import River from "./River";

export const RATIO_NAMES: Record<string, [string, string]> = {
  interest_cover: ["Interest cover", "x"], dscr: ["Debt service cover", "x"], debt_to_equity: ["Debt to equity", "x"], leverage: ["Liabilities to equity", "x"],
  current_ratio: ["Current ratio", "x"], quick_ratio: ["Quick ratio", "x"], net_margin: ["Net margin", "%"], receivable_days: ["Receivable days", "days"],
};
const KNOBS: { k: Knob; name: string; min: number; max: number; step: number; far: number; show: (v: number) => string; room: (v: number) => string }[] = [
  { k: "sales", name: "Sales", min: -0.4, max: 0.2, step: 0.001, far: -0.4, show: (v) => (v === 0 ? "as reported" : `${v > 0 ? "up" : "down"} ${Math.abs(v * 100).toFixed(1)}%`), room: (v) => `can fall ${Math.abs(v * 100).toFixed(1)}%` },
  { k: "rate", name: "Borrowing rate", min: -0.03, max: 0.1, step: 0.0005, far: 0.1, show: (v) => (v === 0 ? "as reported" : `${v > 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(2)} points`), room: (v) => `can rise ${(v * 100).toFixed(2)} points` },
  { k: "days", name: "Customers pay", min: -30, max: 120, step: 1, far: 120, show: (v) => (v === 0 ? "as reported" : `${Math.abs(v)} days ${v > 0 ? "later" : "sooner"}`), room: (v) => `can slip ${Math.floor(v)} days` },
];
const PRESETS: [string, Partial<Shock>][] = [["Slow year", { sales: -0.1 }], ["Rates jump", { rate: 0.02 }], ["Late payers", { days: 30 }], ["All three", { sales: -0.1, rate: 0.02, days: 30 }]];

export default function StressLab({ base, limits, onPick, policy }: { base: Base; limits: Limits; onPick?: (code: string) => void; policy?: string }) {
  const [s, setS] = useState<Shock>(CALM);
  const calm = useMemo(() => stress(base, { ...CALM, vary: s.vary }), [base, s.vary]);
  const now = useMemo(() => stress(base, s), [base, s]);
  const rooms = useMemo(() => Object.fromEntries(KNOBS.map((k) => [k.k, room(base, limits, k.k, k.far, s.vary)])) as Record<Knob, ReturnType<typeof room>>, [base, limits, s.vary]);
  const keys = Object.keys(RATIO_NAMES).filter((k) => limits[k] && now.ratios[k] !== null);
  const broken = keys.filter((k) => verdict(now.ratios[k], limits[k], k) === "breach");
  const set = (p: Partial<Shock>) => setS((o) => ({ ...o, ...p }));
  const touched = s.sales !== 0 || s.rate !== 0 || s.days !== 0;
  const first = KNOBS.find((k) => rooms[k.k].at !== null && !rooms[k.k].already);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] text-ink">
      <section className={cx("glass p-6 transition-shadow duration-500", broken.length > 0 && "!shadow-[0_0_0_3px_#b82e54,0_30px_70px_-30px_rgba(184,46,84,0.8)]")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-h-[64px] max-w-[560px]" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <motion.h3 key={touched ? (broken.length ? "bad" : "ok") : "calm"} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }} className="font-display text-[26px] leading-[1.2]">
                {!touched && (first ? `${first.name} ${first.room(rooms[first.k].at!)} before ${RATIO_NAMES[rooms[first.k].ratio!][0].toLowerCase()} breaks the limit.` : keys.length && broken.length ? "A limit is already broken before any stress." : "No single shock in this range breaks a limit.")}
                {touched && (broken.length ? `${broken.length} limit${broken.length > 1 ? "s" : ""} broken: ${broken.map((k) => RATIO_NAMES[k][0].toLowerCase()).join(", ")}.` : "Every limit still holds.")}
              </motion.h3>
            </AnimatePresence>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(([n, p]) => <button key={n} onClick={() => setS({ ...CALM, vary: s.vary, ...p })} className="rounded-[10px] bg-white/80 border border-line px-3.5 py-2 text-[15px] font-semibold hover:bg-blue hover:text-white hover:border-blue transition-colors">{n}</button>)}
            <button onClick={() => setS({ ...CALM, vary: s.vary })} disabled={!touched} className="rounded-[10px] px-3.5 py-2 text-[15px] font-semibold text-teal enabled:hover:bg-white disabled:text-muted">Reset</button>
          </div>
        </div>
        <div className="mt-4"><River flow={now} base={base.rev + base.oi} onPick={onPick} onDragSales={(v) => set({ sales: v })} sales={s.sales} /></div>
        <p className="mt-1 text-[15px] text-ink-2">Drag the yellow handle to change sales.{onPick ? " Click a stream to see its source page." : ""}</p>
      </section>

      <div className="grid gap-4 content-start">
        <section className="glass p-6">
          {KNOBS.map((k) => {
            const r = rooms[k.k], at = r.at !== null && !r.already ? ((r.at - k.min) / (k.max - k.min)) * 100 : null;
            return (
              <label key={k.k} className="block mb-5 last:mb-0">
                <span className="flex justify-between items-baseline gap-3"><span className="text-[17px] font-bold">{k.name}</span><span className="num text-[16px]">{k.show(s[k.k])}</span></span>
                <span className="relative block mt-1">
                  <input type="range" min={k.min} max={k.max} step={k.step} value={s[k.k]} onChange={(e) => set({ [k.k]: Number(e.target.value) })} aria-valuetext={k.show(s[k.k])} className="knob" style={{ "--p": `${((s[k.k] - k.min) / (k.max - k.min)) * 100}%` } as React.CSSProperties} />
                  {at !== null && <span aria-hidden className="absolute top-[3px] h-[30px] w-[3px] rounded bg-magenta pointer-events-none" style={{ left: `calc(${at}% + ${(50 - at) * 0.26}px - 1px)` }} />}
                </span>
                <span className="block text-[15px] text-ink-2">{r.already ? "A limit is already broken" : r.at === null ? "No limit breaks in this range" : `${k.room(r.at)} (${RATIO_NAMES[r.ratio!][0].toLowerCase()})`}</span>
              </label>
            );
          })}
          <label className="block mt-5 pt-4 border-t border-line">
            <span className="flex justify-between items-baseline text-[15px]"><span>Share of cost of sales that moves with sales</span><span className="num">{Math.round(s.vary * 100)}%</span></span>
            <input type="range" min={0.5} max={1} step={0.01} value={s.vary} onChange={(e) => set({ vary: Number(e.target.value) })} className="knob" style={{ "--p": `${(s.vary - 0.5) * 200}%` } as React.CSSProperties} />
          </label>
        </section>
        <section className="glass p-6">
          <ul className="grid gap-3">
            {keys.map((k) => {
              const v = verdict(now.ratios[k], limits[k], k), [name, unit] = RATIO_NAMES[k], moved = Math.abs(now.ratios[k]! - calm.ratios[k]!) > 1e-6;
              return (
                <li key={k} className="flex items-center justify-between gap-3 text-[16px]">
                  <span>{name}</span>
                  <span className="flex items-center gap-2.5 num">
                    {moved && <span className="text-muted">{ratio(calm.ratios[k], unit)}</span>}
                    <motion.span key={v} initial={{ scale: 1.35 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 14 }} className="font-semibold">{ratio(now.ratios[k], unit)}</motion.span>
                    <span className={cx("w-[68px] text-center rounded-md py-0.5 text-[14px] font-semibold", v === "pass" ? "bg-green-soft text-green" : v === "watch" ? "bg-amber-soft text-amber" : "bg-red text-white")}>{v}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
      <p className="xl:col-span-2 text-[15px] text-ink-2 max-w-[900px]">A scenario, not a forecast. Other running costs stay fixed, late payments are funded by borrowing at today&apos;s average rate, and tax stays in proportion. Nothing here changes the case or the memo.{policy ? ` Limits: ${policy}.` : ""}</p>
    </div>
  );
}
