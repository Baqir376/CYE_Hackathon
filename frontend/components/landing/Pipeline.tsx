"use client";
import { AnimatePresence, motion, useInView, useMotionValueEvent, useScroll, useSpring, useReducedMotion } from "motion/react";
import { ReactNode, useEffect, useRef, useState } from "react";
import { EASE } from "../motion/primitives";
import { Edge, Ribbon, Weave } from "../fx/Engrave";

const STEPS = [
  { t: "Locate", k: "PyMuPDF · deterministic", d: "Finds the balance sheet, profit & loss and cash-flow statements inside a 200-page annual report, picks standalone over consolidated, and skips the contents page, five-year summaries and notes." },
  { t: "Extract", k: "No AI · coordinates kept", d: "Reads every line item and figure from the PDF text layer, with its exact position. It understands Rupees in '000, bracketed negatives, note columns and unlabelled subtotals." },
  { t: "Re-compute", k: "Arithmetic verification", d: "Re-adds every printed subtotal and grand total from its component lines. A total that doesn't cast is flagged before anyone builds a ratio on it." },
  { t: "Classify", k: "Rules engine × LLM", d: "Two independent classifiers map each line to your template: a rules engine fluent in Pakistani terms, and a Groq-hosted LLM. When they disagree, the analyst decides." },
  { t: "Tie-out", k: "Deterministic checks", d: "Assets = equity + liabilities, gross and net profit, CFO + CFI + CFF, and closing cash reconciled to the balance sheet, including the running-finance netting common in Pakistan." },
  { t: "Draft", k: "LLM + number guard", d: "The AI writes sentences with placeholders, and Python fills in each figure with its source. If a figure, name, year or direction doesn't match that source, the sentence is blocked." },
];

export default function Pipeline() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 60%", "end 70%"] });
  const beam = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });
  const [step, setStep] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => setStep(Math.min(STEPS.length - 1, Math.max(0, Math.floor(v * STEPS.length)))));
  const reduce = useReducedMotion();
  const [replay, setReplay] = useState(0);
  const seen = useInView(ref, { margin: "-20% 0px" });
  useEffect(() => {
    if (!seen || reduce) return;
    const t = setInterval(() => setReplay((r) => r + 1), 5200);
    return () => clearInterval(t);
  }, [seen, step, reduce]);

  return (
    <section id="how" className="relative bg-butter text-ink overflow-clip">
      <Weave bands={9} lines={8} alpha={0.45} />
      <Edge from="#F4FAF2" />
      <div className="mx-auto max-w-[1280px] relative px-6 lg:pl-24 2xl:pl-6 pt-44">
        <h2 className="relative font-note text-[clamp(46px,6vw,92px)] leading-[0.95] max-w-4xl">
          Python handles the numbers. <span className="text-magenta">The AI writes the words.</span>
        </h2>
      </div>
      <div ref={ref} className="mx-auto max-w-[1280px] px-6 lg:pl-24 2xl:pl-6 pb-28 mt-14 grid lg:grid-cols-[1fr_1.1fr] gap-12">
        <div className="relative pl-10">
          <div className="absolute left-[11px] top-2 bottom-2 w-px bg-line" />
          <motion.div className="absolute left-[11px] top-2 w-px origin-top bg-magenta" style={{ scaleY: beam, height: "calc(100% - 16px)" }} />
          {STEPS.map((s, i) => (
            <div key={s.t} className="relative min-h-[46vh] lg:min-h-[52vh] pt-1">
              <motion.span animate={{ scale: step === i ? 1.15 : 1, backgroundColor: step >= i ? "#b82e54" : "#fff8e7" }}
                className="absolute -left-10 top-1 h-[23px] w-[23px] rounded-full border-2 border-magenta flex items-center justify-center text-[12px] font-semibold"
                style={{ color: step >= i ? "#ffffff" : "#b82e54" }}>{i + 1}</motion.span>
              <motion.div animate={{ x: step === i ? 10 : 0 }} transition={{ duration: 0.4 }}>
                <span className="text-[15px] font-semibold text-magenta">{s.k}</span>
                <h3 className="mt-1 font-note text-[46px] leading-none">{s.t}</h3>
                <p className="mt-3 text-[18px] text-ink-2 leading-relaxed max-w-md">{s.d}</p>
              </motion.div>
              <div className="lg:hidden mt-6"><Panel step={i} /></div>
            </div>
          ))}
        </div>
        <div className="hidden lg:block">
          <div className="sticky top-28"><Panel step={step} replay={replay} /></div>
        </div>
      </div>
    </section>
  );
}

function Panel({ step, replay = 0 }: { step: number; replay?: number }) {
  return (
    <div className="relative h-[440px] rounded-3xl bg-stage border border-ink/10 overflow-hidden shadow-[0_30px_80px_-30px_rgba(15,31,51,0.5)]">
      <Ribbon className="absolute inset-x-0 bottom-0 w-full h-[34%] opacity-40" />
      <div className="absolute top-4 left-5 text-[13px] font-mono text-ink-2">step {step + 1}/6 · {STEPS[step].t.toLowerCase()}</div>
      <AnimatePresence mode="wait">
        <motion.div key={`${step}-${replay}`} className="absolute inset-0 flex items-center justify-center p-8"
          initial={{ opacity: 0, y: 20, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -20, filter: "blur(6px)" }} transition={{ duration: 0.45, ease: EASE }}>
          {[<Locate key={0} />, <Extract key={1} />, <Recompute key={2} />, <Classify key={3} />, <TieOut key={4} />, <Draft key={5} />][step]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

const pop = (i: number, base = 0) => ({ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { delay: base + i * 0.08, duration: 0.4, ease: EASE } });

function Locate() {
  const pages = [96, 97, 98, 99, 100, 101, 102, 103, 104, 105];
  const hit = [100, 101, 102, 105];
  return (
    <div className="w-full">
      <div className="flex gap-2 justify-center flex-wrap max-w-md mx-auto">
        {pages.map((p, i) => (
          <motion.div key={p} {...pop(i)} className={`relative h-24 w-[68px] rounded-md border p-1.5 ${hit.includes(p) ? "border-teal-300 bg-white" : "border-line bg-paper"}`}>
            {Array.from({ length: 7 }).map((_, j) => <div key={j} className={`h-[3px] rounded mb-[5px] ${hit.includes(p) ? "bg-ink/25" : "bg-ink/10"}`} style={{ width: `${55 + ((j * 37 + p) % 40)}%` }} />)}
            <span className={`absolute bottom-1 right-1.5 text-[13px] font-mono ${hit.includes(p) ? "text-teal" : "text-ink-2"}`}>p.{p}</span>
            {hit.includes(p) && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.9 + hit.indexOf(p) * 0.15, type: "spring" }}
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-teal-300 text-[#2b1a3d] text-[12px] font-bold flex items-center justify-center">✓</motion.span>}
          </motion.div>
        ))}
      </div>
      <motion.p {...pop(0, 1.4)} className="mt-6 text-center text-[13px] text-ink-2 font-mono">227 pages → BS p.100–101 · P&amp;L p.102 · CF p.105 · standalone</motion.p>
    </div>
  );
}

function Extract() {
  const rows = [["Trade debts", "22,940,913"], ["Stock in trade", "664,799"], ["Cash and bank balances", "86,263,250"], ["Trade and other payables", "57,878,641"]];
  return (
    <div className="w-full max-w-md rounded-lg bg-[#fff8e7] p-5">
      {rows.map(([l, v], i) => (
        <div key={l} className="relative flex justify-between py-2 text-[13px] border-b border-ink/5">
          <span className="text-ink-2">{l}</span><span className="font-mono text-ink relative">{v}
            <motion.span initial={{ opacity: 0, scale: 1.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 + i * 0.25, type: "spring", stiffness: 300, damping: 18 }}
              className="absolute -inset-x-1 -inset-y-0.5 rounded border-2 border-amber-400 bg-amber-200/30" />
          </span>
          <motion.span {...pop(i, 0.5)} className="absolute -right-2 translate-x-full top-2 text-[12px] font-mono text-blue whitespace-nowrap pl-3">
            p.101 [{445 + i * 18}, {230 + i * 22}]</motion.span>
        </div>
      ))}
    </div>
  );
}

function Recompute() {
  const lines = ["8,924,973", "664,799", "22,940,913", "12,648,280", "30,851,361", "86,263,250"];
  return (
    <div className="font-mono text-[15px] text-ink-2 text-right w-56">
      {lines.map((l, i) => <motion.p key={i} {...pop(i)}>{l}</motion.p>)}
      <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.6, duration: 0.4 }} className="h-px bg-ink/10 my-2 origin-right" />
      <motion.p {...pop(0, 0.8)} className="text-ink font-semibold">162,293,576</motion.p>
      <motion.p initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.2, type: "spring" }}
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-teal-300/15 text-blue px-3 py-1 text-[12px]">Σ verified · 20 totals match</motion.p>
    </div>
  );
}

function Classify() {
  const items = [["Trade debts", "Trade receivables", "agree"], ["Stock in trade", "Inventory", "agree"], ["Accrued mark-up", "Accrued interest", "agree"], ["Development costs", "Other NCA ⟷ Intangible", "dispute"]];
  return (
    <div className="w-full max-w-lg space-y-2.5">
      <div className="flex justify-between text-[12px] text-ink-2 px-1"><span>Statement line</span><span>Rules · AI → template</span></div>
      {items.map(([a, b, s], i) => (
        <motion.div key={a} {...pop(i)} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${s === "agree" ? "border-line bg-paper" : "border-amber-300/50 bg-amber-300/10"}`}>
          <span className="text-[13px] text-ink-2 w-36">{a}</span>
          <motion.span initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.3 + i * 0.1 }} className="flex-1 h-px bg-gradient-to-r from-white/10 to-teal-300/60 origin-left" />
          <span className={`text-[12px] ${s === "agree" ? "text-blue" : "text-amber"}`}>{b}</span>
          <span className={`text-[12px] rounded px-1.5 py-0.5 ${s === "agree" ? "bg-teal-300/15 text-blue" : "bg-amber-300/20 text-amber-100"}`}>{s === "agree" ? "both agree" : "→ analyst"}</span>
        </motion.div>
      ))}
    </div>
  );
}

function TieOut() {
  const checks = ["Assets = Equity + Liabilities", "Gross profit = Revenue − COGS", "Net profit = PBT − Tax", "CFO + CFI + CFF = Δ cash", "Closing cash ↔ balance sheet (running finance netted)"];
  return (
    <div className="space-y-2.5 w-full max-w-md">
      {checks.map((c, i) => (
        <motion.div key={c} {...pop(i)} className="flex items-center gap-3 text-[14px] text-ink-2">
          <motion.span initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.3 + i * 0.14, type: "spring", stiffness: 300 }}
            className="h-6 w-6 shrink-0 rounded-full bg-teal-300 text-[#2b1a3d] text-[12px] font-bold flex items-center justify-center">✓</motion.span>{c}
        </motion.div>
      ))}
    </div>
  );
}

function Draft() {
  return (
    <div className="w-full max-w-lg rounded-xl bg-[#fff8e7] p-5 text-[14px] leading-relaxed text-ink">
      <Line i={0}>Net revenue was Rs 4,850 mn<Cite /> against Rs 4,450 mn<Cite /> in FY2025.</Line>
      <Line i={1}>Interest cover fell to 1.58x<Cite c="calc" /> from 2.72x<Cite c="calc" />.</Line>
      <Line i={2} bad>Revenue will reach Rs 6,200 mn next year.</Line>
      <motion.p {...pop(0, 1.6)} className="mt-3 text-[13px] font-mono text-ink-2">each figure compared with the source it cites</motion.p>
    </div>
  );
}
function Line({ children, i, bad }: { children: ReactNode; i: number; bad?: boolean }) {
  return (
    <motion.p {...pop(i, 0.1)} className="mt-1.5">
      <motion.span animate={bad ? { x: [0, -4, 4, -2, 0] } : {}} transition={{ delay: 1.1, duration: 0.4 }}
        className={bad ? "line-through decoration-red text-red bg-red-soft" : ""}>{children}</motion.span>
      {bad && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }} className="ml-1.5 rounded bg-red text-cream px-1 text-[13px] font-bold align-middle">BLOCKED</motion.span>}
    </motion.p>
  );
}
function Cite({ c = "src" }: { c?: string }) {
  return <sup className="mx-0.5 rounded bg-teal-soft text-teal px-1 text-[8.5px] font-bold">{c}</sup>;
}
