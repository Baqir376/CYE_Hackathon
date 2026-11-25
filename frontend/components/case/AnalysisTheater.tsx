"use client";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, Case, TraceStep } from "@/lib/api";
import { cx } from "../ui";
import Backdrop from "../fx/Backdrop";
import { CountUp, EASE } from "../motion/primitives";

const STAGES = [
  { k: "read", t: "Read", d: "Locating statements" },
  { k: "extract", t: "Extract", d: "Figures + coordinates" },
  { k: "map", t: "Classify", d: "Rules × AI" },
  { k: "spread", t: "Verify", d: "Tie-outs · ratios · policy" },
  { k: "memo", t: "Draft", d: "Memo + number guard" },
];

function stageState(trace: TraceStep[], k: string): "pending" | "running" | "done" | "warn" | "error" {
  const s = trace.filter((t) => t.key.replace(/\d+$/, "") === k);
  if (!s.length) return "pending";
  if (s.some((x) => x.status === "running")) return "running";
  if (s.some((x) => x.status === "error")) return "error";
  return s.some((x) => x.status === "warn") ? "warn" : "done";
}
const num = (trace: TraceStep[], re: RegExp) => {
  for (const t of trace) { const m = t.detail?.match(re); if (m) return Number(m[1]); }
  return null;
};

export default function AnalysisTheater({ c, complete }: { c: Case; complete: boolean }) {
  const trace = c.trace || [];
  const counters = [
    { l: "Pages scanned", v: num(trace, /(\d+) pages/) },
    { l: "Figures extracted", v: num(trace, /(\d+) figures;/) },
    { l: "Totals re-computed", v: num(trace, /(\d+) printed totals/) },
    { l: "Rows classified", v: num(trace, /(\d+)\/\d+ rows mapped/) },
    { l: "Checks passed", v: num(trace, /(\d+) checks passed/) },
    { l: "Figures guarded", v: num(trace, /(\d+) figures checked/) },
  ];
  const pages = c.documents.flatMap((d) => (d.statement_pages || []).map((p) => ({ doc: d.id, ...p })));
  const failed = c.status === "failed";

  return (
    <div className="relative min-h-screen text-ink overflow-hidden md:-ml-[96px] md:pl-[96px]">
      <Backdrop theme="sky" />
      <div className="relative mx-auto max-w-[1200px] px-6 pt-12 pb-16">
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[13px] text-blue font-semibold flex items-center gap-2">
          {failed ? <span className="text-red">Analysis stopped</span> : complete ? "Analysis complete" : <><span className="h-1.5 w-1.5 rounded-full bg-teal-300 animate-pulse" />Analysing live</>}
        </motion.p>
        <AnimatePresence mode="wait">
          <motion.h1 key={c.borrower} initial={{ opacity: 0, y: 12, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            className="mt-2 font-display text-[clamp(34px,4.4vw,58px)] leading-[1.02]">
            {c.borrower === "auto" ? "Reading the statements…" : c.borrower}
          </motion.h1>
        </AnimatePresence>
        <p className="mt-2 text-ink-2 text-sm">{c.documents.map((d) => d.filename).join(" · ")}</p>

        {/* stage rail */}
        <div className="mt-10 grid grid-cols-5 gap-2">
          {STAGES.map((s, i) => {
            const st = stageState(trace, s.k);
            return (
              <div key={s.k} className="relative">
                <div className="h-1 rounded-full bg-ink/10 overflow-hidden">
                  <motion.div className={cx("h-full", st === "error" ? "bg-red-400" : st === "warn" ? "bg-amber-300" : "bg-gradient-to-r from-blue to-magenta")}
                    initial={{ width: "0%" }} animate={{ width: st === "done" || st === "warn" || st === "error" ? "100%" : st === "running" ? "60%" : "0%" }}
                    transition={{ duration: st === "running" ? 2.5 : 0.5, ease: EASE }} />
                </div>
                <div className="mt-3 flex items-center gap-2.5">
                  <motion.span animate={st === "running" ? { scale: [1, 1.15, 1] } : { scale: 1 }} transition={{ repeat: st === "running" ? Infinity : 0, duration: 1.2 }}
                    className={cx("relative h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-[12px] font-semibold border",
                      st === "pending" ? "border-line text-ink-2" : st === "running" ? "border-mustard text-blue bg-teal-300/10" :
                        st === "error" ? "border-red-400 bg-red-400 text-white" : st === "warn" ? "border-amber-300 bg-amber-300 text-ink" : "border-mustard bg-teal-300 text-[#2b1a3d]")}>
                    {st === "running" && <span className="absolute inset-0 rounded-full border border-mustard animate-ping" />}
                    {st === "done" ? "✓" : st === "error" ? "!" : i + 1}
                  </motion.span>
                  <div className="min-w-0">
                    <p className={cx("text-[14px] font-medium", st === "pending" ? "text-ink-2" : "text-ink")}>{s.t}</p>
                    <p className="text-[13px] text-ink-2 truncate">{s.d}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 grid lg:grid-cols-[1.15fr_1fr] gap-6">
          {/* document pane */}
          <div className="glass p-5 min-h-[360px]">
            <p className="text-[13px] text-ink-2">Statement pages located</p>
            {pages.length === 0 ? <ScanningPages /> : (
              <div className="mt-5 flex gap-4 flex-wrap">
                {pages.map((p, i) => (
                  <motion.div key={`${p.doc}-${p.page}`} initial={{ opacity: 0, y: 30, rotate: -4 }} animate={{ opacity: 1, y: 0, rotate: 0 }}
                    transition={{ delay: i * 0.15, type: "spring", stiffness: 160, damping: 18 }}
                    whileHover={{ scale: 1.12, rotateY: 14, z: 40 }} style={{ transformPerspective: 700 }} className="relative w-[132px] rounded-md overflow-hidden bg-white shadow-[0_26px_40px_-16px_rgba(43,26,61,0.5)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`${api.pageUrl(c.id, p.doc, p.page)}?scale=0.5`} alt={`Page ${p.page}`} className="block w-full" />
                    {!complete && <motion.div className="absolute inset-x-0 h-10" initial={{ top: "-20%" }} animate={{ top: "110%" }}
                      transition={{ repeat: Infinity, duration: 1.6, delay: i * 0.3, ease: "linear" }}
                      style={{ background: "linear-gradient(180deg,transparent,rgba(233,180,76,0.35),transparent)" }} />}
                    <span className="absolute top-1.5 left-1.5 rounded bg-white/95 text-blue text-[12px] font-semibold px-1.5 py-0.5">
                      {p.statement} · p.{p.page}</span>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* counters + log */}
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {counters.map((x) => (
                <div key={x.l} className="glass p-3">
                  <p className="font-display text-[30px] leading-none">{x.v === null ? <span className="text-ink-2">—</span> : <CountUp to={x.v} duration={1} />}</p>
                  <p className="mt-1.5 text-[13px] text-ink-2 leading-tight">{x.l}</p>
                </div>
              ))}
            </div>
            <div className="glass p-4 font-mono text-[12px] leading-relaxed h-[206px] overflow-hidden">
              <p className="text-ink-2">$ crediq analyse --case {c.id}</p>
              {trace.map((t, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="mt-1">
                  <span className={t.status === "running" ? "text-amber" : t.status === "error" ? "text-red" : t.status === "warn" ? "text-amber" : "text-blue"}>
                    {t.status === "running" ? "›" : t.status === "error" ? "✕" : "✓"}</span>{" "}
                  <span className="text-ink-2">{t.title}</span>
                  {t.detail && <TypeLine text={t.detail} />}
                </motion.div>
              ))}
              {!complete && !failed && <span className="inline-block w-2 h-3.5 bg-teal-300/80 animate-pulse align-middle mt-1" />}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {complete && !failed && (
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="mt-8 inline-flex items-center gap-3 rounded-full bg-teal-300 text-[#2b1a3d] px-5 py-2.5 font-semibold shadow-[0_0_60px_-10px_rgba(244,211,94,0.8)]">
              ✓ Draft ready: {c.signals?.length ?? 0} risk signals · {c.checks?.filter((x) => x.status === "fail").length ?? 0} exceptions. Opening workspace…
            </motion.div>
          )}
        </AnimatePresence>
        {failed && (
          <div className="mt-8 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
            {c.error} <Link href="/app" className="underline ml-2">Try another document</Link>
          </div>
        )}
      </div>
    </div>
  );
}

function TypeLine({ text }: { text: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((x) => (x >= text.length ? x : x + 3)), 12);
    return () => clearInterval(t);
  }, [text]);
  return <p className="text-ink-2 pl-4">{text.slice(0, n)}</p>;
}

function ScanningPages() {
  return (
    <div className="mt-8 relative h-[240px] flex items-center justify-center">
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.div key={i} className="absolute h-[200px] w-[150px] rounded-md bg-white/90 shadow-2xl p-3"
          initial={{ x: 0, rotate: 0, opacity: 0 }}
          animate={{ x: [(i - 2) * 6, (i - 2) * 46], rotate: [(i - 2) * 1, (i - 2) * 5], opacity: 1 }}
          transition={{ repeat: Infinity, repeatType: "reverse", duration: 1.8, delay: i * 0.08, ease: "easeInOut" }}>
          {Array.from({ length: 10 }).map((_, j) => <div key={j} className="h-[4px] rounded bg-ink/15 mb-[11px]" style={{ width: `${45 + ((i * 13 + j * 29) % 50)}%` }} />)}
        </motion.div>
      ))}
      <p className="absolute -bottom-2 text-[12px] text-ink-2 font-mono">searching the annual report for statements…</p>
    </div>
  );
}
