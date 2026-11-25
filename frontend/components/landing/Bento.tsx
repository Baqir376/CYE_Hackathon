"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ReactNode, useEffect, useState } from "react";
import { cx } from "../ui";
import { EASE, Reveal } from "../motion/primitives";
import { Tilt } from "../motion/pointer";
import { Edge, Ribbon } from "../fx/Engrave";

const BAND = [["#FFE4DE", "#A8274A"], ["#E3ECFC", "#1F3C88"], ["#DFF1E6", "#17684C"], ["#FCEBC2", "#6B4700"], ["#EFE6F6", "#55307A"], ["#FFE4DE", "#A8274A"]];
function Tile({ children, className, title, i }: { children: ReactNode; className?: string; title: string; i: number }) {
  return (
    <Reveal delay={i * 0.06} className={className}>
      <Tilt className="h-full" max={5}><div className="relative h-full rounded-[14px] bg-card overflow-hidden shadow-[0_30px_60px_-44px_rgba(43,26,61,0.9)]">
        <div className="relative overflow-hidden px-7 py-5" style={{ background: BAND[i][0], color: BAND[i][1] }}>
          <Ribbon color={BAND[i][1] + "40"} className="absolute inset-x-0 bottom-0 w-full h-full" />
          <h3 className="relative font-note text-[32px] leading-[1.02] max-w-[85%]">{title}</h3>
        </div>
        <div className="p-7">{children}</div>
      </div></Tilt>
    </Reveal>
  );
}

export default function Bento() {
  return (
    <section id="features" className="relative bg-paper pb-32 overflow-hidden">
      <Edge from="#FDF4DA" />
      <div className="mx-auto max-w-[1280px] px-6 lg:pl-24 2xl:pl-6 pt-44">
        <Reveal>
          <h2 className="font-note text-[clamp(46px,6vw,92px)] leading-[0.95] max-w-4xl">
            Not a summary bot. <span className="text-magenta">A second pair of eyes.</span>
          </h2>
        </Reveal>
        <div className="mt-12 grid md:grid-cols-6 gap-4 auto-rows-[minmax(300px,auto)]">
          <Tile i={0} className="md:col-span-4" title="Click any number. Land on the exact cell."><EvidenceDemo /></Tile>
          <Tile i={1} className="md:col-span-2" title="Invented figures are blocked."><GuardDemo /></Tile>
          <Tile i={2} className="md:col-span-3" title="Your policy, not a black-box score."><PolicyDemo /></Tile>
          <Tile i={3} className="md:col-span-3" title="Catches what tired eyes miss."><ExceptionDemo /></Tile>
          <Tile i={4} className="md:col-span-3" title="Every change goes on the record."><AuditDemo /></Tile>
          <Tile i={5} className="md:col-span-3" title="Questions for the borrower, drafted."><QuestionsDemo /></Tile>
        </div>
      </div>
    </section>
  );
}

const FIGS = [
  { l: "Trade debts", v: "1,420,000", y: 54 },
  { l: "Short term borrowings", v: "1,580,000", y: 96 },
  { l: "Total assets", v: "5,377,000", y: 138 },
];
function EvidenceDemo() {
  const [a, setA] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => { if (reduce) return; const t = setInterval(() => setA((x) => (x + 1) % 3), 2600); return () => clearInterval(t); }, [reduce]);
  return (
    <div className="relative grid sm:grid-cols-[1fr_1.1fr] gap-6 sm:gap-10 items-center">
      <div className="space-y-2">
        {FIGS.map((f, i) => (
          <button key={f.l} onMouseEnter={() => setA(i)} onClick={() => setA(i)}
            className={cx("w-full flex justify-between rounded-xl border px-4 py-3 text-left transition-colors", a === i ? "border-magenta bg-red-soft" : "border-line hover:border-ink-2/30")}>
            <span className="text-[14px]">{f.l}</span><span className="font-mono text-[14px] border-b border-dotted border-teal">{f.v}</span>
          </button>
        ))}
        <p className="text-[14px] text-muted pt-1">Hover a figure. In the app, the real PDF page opens with the cell highlighted.</p>
      </div>
      <div className="relative h-[200px] rounded-lg bg-[#fff8e7] border border-line shadow-inner p-4 overflow-hidden">
        <p className="text-[8px] font-bold tracking-wide">STATEMENT OF FINANCIAL POSITION · p.3</p>
        {Array.from({ length: 8 }).map((_, j) => (
          <div key={j} className="flex justify-between mt-[9px]"><span className="h-[4px] rounded bg-ink/15" style={{ width: `${40 + (j * 17) % 30}%` }} /><span className="h-[4px] w-14 rounded bg-ink/20" /></div>
        ))}
        <motion.div className="absolute right-3 h-6 w-[74px] rounded border-2 border-amber-400 bg-amber-200/40"
          animate={{ top: FIGS[a].y }} transition={{ type: "spring", stiffness: 260, damping: 22 }}>
          <AnimatePresence mode="wait">
            <motion.span key={a} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex items-center justify-center font-mono text-[10px] text-ink">{FIGS[a].v}</motion.span>
          </AnimatePresence>
        </motion.div>
      </div>
      <svg className="absolute left-[46%] top-0 h-full w-[8%] overflow-visible pointer-events-none hidden sm:block" viewBox="0 0 40 200" preserveAspectRatio="none">
        <motion.path key={a} d={`M0 ${30 + a * 50} C 20 ${30 + a * 50}, 20 ${FIGS[a].y + 12}, 40 ${FIGS[a].y + 12}`} stroke="#b82e54" strokeWidth="1.5" fill="none"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, ease: EASE }} />
      </svg>
    </div>
  );
}

const SENTS = [
  { t: "Gross margin fell to 16.0% from 19.0%.", ok: true },
  { t: "Debt/Equity rose to 1.38x.", ok: true },
  { t: "Sales should double to Rs 9,700 mn.", ok: false },
];
function GuardDemo() {
  const [n, setN] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => { if (reduce) return; const t = setInterval(() => setN((x) => (x + 1) % 4), 1300); return () => clearInterval(t); }, [reduce]);
  return (
    <div className="space-y-2.5">
      {SENTS.map((s, i) => (
        <motion.div key={i} animate={{ y: i < n || n === 0 ? 0 : 8, x: !s.ok && n === 3 ? [0, -5, 5, -3, 0] : 0 }} transition={{ duration: 0.35 }}
          className={cx("rounded-xl border px-3 py-2.5 text-[13px] flex items-start gap-2",
            !s.ok && (n === 3 || n === 0) ? "border-red/30 bg-red-soft text-red" : "border-line")}>
          <span className={cx("mt-0.5 h-4 w-4 shrink-0 rounded-full text-[9px] font-bold flex items-center justify-center text-white", s.ok ? "bg-green" : "bg-red")}>{s.ok ? "✓" : "✕"}</span>
          <span className={cx(!s.ok && (n === 3 || n === 0) && "line-through")}>{s.t}</span>
        </motion.div>
      ))}
      <p className="text-[14px] text-muted">9,700 has no source, so the sentence is blocked and left out of the printed memo.</p>
    </div>
  );
}

const POLICIES = {
  "Corporate": { ic: [1.5, 2.5], cr: [1.0, 1.2] },
  "SME conservative": { ic: [2.0, 3.0], cr: [1.2, 1.5] },
} as const;
function PolicyDemo() {
  const [p, setP] = useState<keyof typeof POLICIES>("Corporate");
  const rows = [{ k: "ic", n: "Interest cover", v: 1.58, max: 4 }, { k: "cr", n: "Current ratio", v: 1.21, max: 2.4 }] as const;
  return (
    <div>
      <div className="inline-flex rounded-full border border-line bg-paper p-1 text-[12px]">
        {(Object.keys(POLICIES) as (keyof typeof POLICIES)[]).map((k) => (
          <button key={k} onClick={() => setP(k)} className="relative px-3 py-1 rounded-full">
            {p === k && <motion.span layoutId="pol" className="absolute inset-0 rounded-full bg-ink" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
            <span className={cx("relative", p === k ? "text-white" : "text-ink-2")}>{k}</span>
          </button>
        ))}
      </div>
      <div className="mt-5 space-y-5">
        {rows.map((r) => {
          const [min, warn] = POLICIES[p][r.k];
          const status = r.v < min ? "breach" : r.v < warn ? "watch" : "pass";
          return (
            <div key={r.k}>
              <div className="flex justify-between text-[13px]"><span>{r.n}</span>
                <span className="flex items-center gap-2"><span className="font-mono">{r.v.toFixed(2)}x</span>
                  <AnimatePresence mode="wait"><motion.span key={status} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    className={cx("rounded px-1.5 text-[11px] font-medium", status === "pass" ? "bg-green-soft text-green" : status === "watch" ? "bg-amber-soft text-amber" : "bg-red-soft text-red")}>{status}</motion.span></AnimatePresence>
                </span>
              </div>
              <div className="relative mt-2 h-2.5 rounded-full flex overflow-hidden bg-paper">
                <motion.span animate={{ width: `${(min / r.max) * 100}%` }} className="bg-red/50" transition={{ type: "spring", stiffness: 200, damping: 25 }} />
                <motion.span animate={{ width: `${((warn - min) / r.max) * 100}%` }} className="bg-amber/50" transition={{ type: "spring", stiffness: 200, damping: 25 }} />
                <span className="flex-1 bg-green/40" />
                <span className="absolute top-[-3px] h-4 w-[3px] rounded bg-ink" style={{ left: `${(r.v / r.max) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-[14px] text-muted">Same borrower, different bank policy, different verdict. SBP sets no universal ratio, so each bank configures its own.</p>
    </div>
  );
}

function ExceptionDemo() {
  const lines = [["Trade and other payables", "760,000"], ["Accrued mark-up", "58,000"], ["Short term borrowings", "1,580,000"], ["Current portion of LT financing", "205,000"], ["Current portion of lease liabilities", "26,000"]];
  return (
    <div className="grid grid-cols-[1fr_auto] gap-x-6 items-end">
      <div className="text-[13px]">
        {lines.map(([l, v], i) => (
          <Reveal key={l} delay={i * 0.05} y={6}><div className="flex justify-between py-1 border-b border-line/60"><span className="text-ink-2">{l}</span><span className="font-mono">{v}</span></div></Reveal>
        ))}
        <div className="flex justify-between pt-2 font-semibold"><span>Printed subtotal</span><span className="font-mono text-red line-through">2,639,000</span></div>
      </div>
      <motion.div initial={{ scale: 0.6, opacity: 0, rotate: -6 }} whileInView={{ scale: 1, opacity: 1, rotate: -4 }} viewport={{ once: true }}
        transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.5 }}
        className="rounded-xl border-2 border-red bg-red-soft px-3 py-2 text-red text-center">
        <p className="text-[10px] uppercase tracking-[0.15em] font-bold">Σ mismatch</p>
        <p className="font-mono text-[18px] font-semibold">+10,000</p>
        <p className="text-[10px]">lines add to 2,629,000</p>
      </motion.div>
    </div>
  );
}

const AUDIT = [
  ["14:02", "System", "Analysis completed · 60 rows · 16 checks"],
  ["14:05", "Analyst", "Subtotal corrected 2,639,000 → 2,629,000 · casting error"],
  ["14:06", "Analyst", "Confirmed classification: Development costs → Other NCA"],
  ["14:09", "Analyst", "Memo edited · Liquidity section · re-verified"],
  ["14:11", "Analyst", "Submitted to approver"],
];
function AuditDemo() {
  return (
    <><ol className="relative space-y-3 before:absolute before:left-[5px] before:top-1 before:bottom-1 before:w-px before:bg-line">
      {AUDIT.map(([t, a, d], i) => (
        <motion.li key={i} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12, ease: EASE }}
          className="relative pl-6 text-[13px]">
          <span className={cx("absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full border-2 border-card", i === 4 ? "bg-green" : "bg-teal")} />
          <span className="font-mono text-[13px] text-muted mr-2">{t}</span><span className="font-medium mr-1.5">{a}</span><span className="text-ink-2">{d}</span>
        </motion.li>
      ))}
    </ol>
      <p className="mt-3 text-[14px] text-muted pl-6">Example entries. A case can&apos;t be submitted with blocked sentences or undecided lines.</p></>
  );
}

function QuestionsDemo() {
  const q = ["Provide an ageing analysis of trade debts and explain why receivables grew 47.9% against 9.0% sales growth.",
    "Explain the negative operating cash flow and share a 12-month cash-flow projection.",
    "Clarify the Rs 10 mn difference in the current-liabilities subtotal."];
  return (
    <div className="rounded-xl border border-line bg-paper p-4 text-[13px] leading-relaxed">
      <p className="text-ink-2">Dear Sir/Madam, to complete our assessment please provide:</p>
      <ol className="mt-2 space-y-1.5 list-decimal pl-5">
        {q.map((x, i) => (
          <motion.li key={i} initial={{ opacity: 0, y: 6 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.25 }}>{x}</motion.li>
        ))}
      </ol>
      <p className="mt-2 text-[13px] text-muted">Generated from the risk signals and failed checks. One click copies it as a letter.</p>
    </div>
  );
}
