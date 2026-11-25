"use client";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cx } from "../ui";
import { Edge, Weave } from "../fx/Engrave";

// Real rows from the fictional sample (Rupees in '000). Exactly one printed subtotal is wrong.
export const GROUPS = [
  { h: "Current assets", rows: [["Stores and spares", 120000], ["Stock in trade", 1310000], ["Trade debts", 1420000], ["Advances and other", 185000], ["Taxation, net", 95000], ["Cash and bank", 62000]] as [string, number][], printed: 3192000 },
  { h: "Equity", rows: [["Paid up capital", 600000], ["Unappropriated profit", 1265000]] as [string, number][], printed: 1865000 },
  { h: "Non-current liabilities", rows: [["Long term financing", 720000], ["Lease liabilities", 45000], ["Deferred taxation", 118000]] as [string, number][], printed: 883000 },
  { h: "Current liabilities", rows: [["Trade payables", 760000], ["Accrued mark-up", 58000], ["Short term borrowings", 1580000], ["Current part of financing", 205000], ["Current part of leases", 26000]] as [string, number][], printed: 2639000 },
];
export const sumOf = (g: (typeof GROUPS)[number]) => g.rows.reduce((a, r) => a + r[1], 0);
const fmt = (n: number) => n.toLocaleString("en-US");

export default function SpotIt() {
  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const t = useRef(0);
  const [wrong, setWrong] = useState<number[]>([]);
  const [won, setWon] = useState<number | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const running = started && won === null;
  useEffect(() => {
    if (!running) return;
    const t0 = t.current;
    tick.current = setInterval(() => setElapsed(performance.now() - t0), 100);
    return () => { if (tick.current) clearInterval(tick.current); };
  }, [running]);

  function start(at: number) { t.current = at; setElapsed(0); setStarted(true); setWrong([]); setWon(null); }
  function pick(i: number, at: number) {
    if (!running) return;
    if (sumOf(GROUPS[i]) !== GROUPS[i].printed) setWon(at - t.current);
    else setWrong((w) => (w.includes(i) ? w : [...w, i]));
  }
  const secs = ((running ? elapsed : (won ?? 0)) / 1000).toFixed(1);

  return (
    <section id="game" className="relative bg-[#ffe9e1] text-ink overflow-hidden scroll-mt-0">
      <Weave bands={5} lines={9} alpha={0.6} />
      <Edge from="#FFFDF7" />
      <div className="relative mx-auto max-w-[1240px] px-6 lg:pl-24 2xl:pl-6 pt-44 pb-32 grid lg:grid-cols-[0.8fr_1.2fr] gap-12 items-start">
        <div className="lg:sticky lg:top-28">
          <h2 className="font-note text-magenta text-[clamp(46px,6vw,88px)] leading-[0.95]">One total here is wrong. Find it.</h2>
          <p className="mt-6 text-[19px] leading-relaxed max-w-md">This is what a credit analyst does by hand, for every borrower, before any real analysis starts. Pick the subtotal that doesn&apos;t add up.</p>
          <div className="mt-8 flex items-center gap-5 min-h-[60px]" aria-live="polite">
            {!started && <button onClick={(e) => start(e.timeStamp)} className="note-btn bg-mustard text-ink">Start the clock</button>}
            {running && <p className="font-note text-[54px] leading-none tabular-nums">{secs}<span className="text-[24px] ml-1">s</span></p>}
            {won !== null && <button onClick={(e) => start(e.timeStamp)} className="note-btn bg-mustard text-ink">Play again</button>}
          </div>
          <AnimatePresence>
            {won !== null && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-6 max-w-md">
                <p className="text-[19px] leading-relaxed"><b>You took {secs} seconds{wrong.length ? `, with ${wrong.length} wrong ${wrong.length > 1 ? "guesses" : "guess"}` : ""}.</b> CredIQ reads this six-page file, extracts 120 figures and re-adds every total in about a tenth of a second.</p>
                <Link href="/app" className="inline-block mt-4 underline underline-offset-4 decoration-2 text-[18px] font-semibold">See it in the app</Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="note-sheet grid sm:grid-cols-2 gap-x-10 gap-y-6 text-ink">
          {GROUPS.map((g, i) => {
            const hit = won !== null && sumOf(g) !== g.printed, miss = wrong.includes(i);
            return (
              <div key={g.h} className="relative">
                <h3 className="font-semibold text-[16px]">{g.h}</h3>
                {g.rows.map(([l, v]) => <p key={l} className="flex justify-between gap-3 text-[15px] py-[3px]"><span>{l}</span><span className="num">{fmt(v)}</span></p>)}
                <motion.button type="button" disabled={!running || miss} onClick={(e) => pick(i, e.timeStamp)} animate={miss ? { x: [0, -7, 7, -4, 4, 0] } : { x: 0 }} transition={{ duration: 0.4 }}
                  aria-label={`${g.h} subtotal ${fmt(g.printed)}`}
                  className={cx("num relative w-full mt-1 border-t-2 border-ink pt-1.5 pb-1 px-2 -mx-2 text-right text-[18px] font-semibold rounded-b-md transition-colors",
                    running && !miss && "hover:bg-mustard cursor-pointer", miss && "text-muted", hit && "text-red")}>
                  {fmt(g.printed)}{hit && <svg viewBox="0 0 130 46" className="absolute -right-3 -top-2 h-[46px] w-[130px] overflow-visible pointer-events-none" fill="none" aria-hidden><motion.path d="M112 10C86 1 30 1 12 15C-2 27 20 43 66 43C112 43 130 31 122 17C116 8 96 4 78 5" stroke="#B82E54" strokeWidth="3.5" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, ease: "easeInOut" }} /></svg>}{miss && <span className="float-left text-[14px] font-normal">adds up fine</span>}
                </motion.button>
                <AnimatePresence>
                  {hit && (
                    <motion.div initial={{ scale: 2.6, opacity: 0, rotate: -40 }} animate={{ scale: 1, opacity: 1, rotate: -11 }} transition={{ type: "spring", stiffness: 380, damping: 15 }}
                      className="absolute right-0 top-full mt-2 z-10 pointer-events-none">
                      <span className="bg-cream border-2 border-red text-red rounded-md px-2.5 py-1 font-semibold text-[16px] leading-tight">Off by {fmt(g.printed - sumOf(g))}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
          <p className="sm:col-span-2 text-[14px] text-ink-2 pt-16 sm:pt-10">Fictional company. Rupees in &apos;000.</p>
        </div>
      </div>
    </section>
  );
}
