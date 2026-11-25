"use client";
import { AnimatePresence, motion, useInView, useReducedMotion, useScroll, useTransform } from "motion/react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Edge, Weave } from "../fx/Engrave";
import { Reveal } from "../motion/primitives";
import { use3D } from "../motion/pointer";
import { cx } from "../ui";

const LedgerScene = dynamic(() => import("../three/LedgerScene"), { ssr: false });

// Each chapter is a different note colour. `at` is where the 3D scene should be, `ms` how long it stays.
const CHAPTERS = [
  { k: "Pages", t: "It starts with real pages from a borrower's accounts.", at: 0, ms: 3000 },
  { k: "Read", t: "Every statement is found, and every figure is read.", at: 0.3, ms: 4200 },
  { k: "Trace", t: "Each figure lifts off, still tied to its own cell.", at: 0.49, ms: 4600 },
  { k: "Memo", t: "Python places the figures. The AI writes the words around them.", at: 0.96, ms: 6200 },
];

export default function Story() {
  const delay = 0;
  const mode = use3D();
  const reduce = useReducedMotion();
  const [failed, setFailed] = useState(false);
  const webgl = mode === "webgl" && !failed;
  const ref = useRef<HTMLElement>(null);
  const progress = useRef(0);
  const seen = useInView(ref, { amount: 0.25 });
  const near = useInView(ref);
  const [chapter, setChapter] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const playing = seen && !paused && !hidden && !reduce;

  useEffect(() => {
    const h = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", h);
    return () => document.removeEventListener("visibilitychange", h);
  }, []);
  useEffect(() => { progress.current = CHAPTERS[chapter].at; }, [chapter]);
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => setChapter((c) => (c + 1) % CHAPTERS.length), CHAPTERS[chapter].ms + (chapter === 0 ? delay * 1000 : 0));
    return () => clearTimeout(t);
  }, [playing, chapter, delay]);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const sceneY = useTransform(scrollYProgress, [0, 1], [0, 160]), sceneScale = useTransform(scrollYProgress, [0, 1], [1, 0.82]), fade = useTransform(scrollYProgress, [0.2, 0.9], [1, 0]);
  const c = CHAPTERS[chapter];

  return (
    <section id="story" ref={ref} className="relative overflow-hidden bg-[#e6eefc] text-ink">
      <Edge from="#F4FAF2" />
      <Weave bands={5} lines={9} alpha={0.7} />
      <div className="relative min-h-[100svh] flex flex-col lg:block">
        {webgl && (
          <motion.div className="absolute inset-0" style={{ y: sceneY, scale: sceneScale }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.2, delay: delay + 0.1 }}>
            <LedgerScene progress={progress} active={near && !hidden} onFail={() => setFailed(true)} />
          </motion.div>
        )}
        <motion.div style={{ opacity: webgl ? fade : 1 }} className="relative mx-auto w-full max-w-[1320px] px-6 lg:pl-24 2xl:pl-6 pt-32 lg:pt-0 lg:min-h-[100svh] grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-10 items-center pointer-events-none">
          <div className="pointer-events-auto max-w-[680px] lg:pb-16">
            <Reveal><h2 className="font-note text-[clamp(50px,5.7vw,104px)] leading-[0.94]">From paper to memo. Nothing gets lost.</h2>
              <p className="mt-7 max-w-[440px] text-[20px] leading-[1.45] font-medium">Four moments, playing by themselves. Pick one to stay on it.</p></Reveal>
          </div>
          {!webgl && <FlatScene chapter={chapter} delay={delay} />}
        </motion.div>

        <motion.div style={{ opacity: webgl ? fade : 1 }} className="relative lg:absolute lg:inset-x-0 lg:bottom-[84px] pointer-events-none pb-28 lg:pb-0 pt-8 lg:pt-0">
          <div className="mx-auto max-w-[1320px] px-6 lg:pl-24 2xl:pl-6 grid lg:grid-cols-2 gap-x-10">
            <div className="hidden lg:block" />
            <div className="pointer-events-auto flex flex-col items-start lg:items-center gap-3">
              <div className="min-h-[64px] lg:min-h-[44px] flex items-center" aria-live="off">
                <AnimatePresence mode="wait">
                  <motion.p key={chapter} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.4 }} className="rounded-[14px] lg:rounded-full bg-white text-ink px-5 py-2 text-[17px] font-semibold shadow-[0_14px_30px_-14px_rgba(43,26,61,0.6)]">{c.t}</motion.p>
                </AnimatePresence>
              </div>
              <div className="flex items-center gap-2">
                {CHAPTERS.map((x, i) => (
                  <button key={x.k} onClick={() => { setChapter(i); setPaused(true); }} aria-label={`Show ${x.k}`} aria-current={i === chapter} className="group py-3">
                    <span className={cx("block h-[6px] rounded-full overflow-hidden transition-all duration-500", i === chapter ? "w-16" : "w-6")} style={{ background: "color-mix(in srgb, currentColor 35%, transparent)" }}>
                      {i === chapter && <motion.span key={`${chapter}-${playing}`} className="block h-full bg-current origin-left" initial={{ scaleX: playing ? 0 : 1 }} animate={{ scaleX: 1 }} transition={{ duration: playing ? x.ms / 1000 : 0, ease: "linear" }} />}
                    </span>
                  </button>
                ))}
                <button onClick={() => setPaused((p) => !p)} aria-label={paused ? "Play animation" : "Pause animation"} className="ml-1 h-11 w-11 rounded-full flex items-center justify-center hover:bg-black/10">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>{paused ? <path d="M7 4v16l13-8z" /> : <path d="M6 4h4v16H6zM14 4h4v16h-4z" />}</svg>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

const CHIPS = [["Net revenue", "4,850,000"], ["Trade debts", "1,420,000"], ["Operating cash flow", "(396,000)"]];

/** Phones and software rendering: the same self-playing story in CSS 3D. */
function FlatScene({ chapter, delay }: { chapter: number; delay: number }) {
  const fan = chapter >= 1, lift = chapter >= 2, memo = chapter === 3;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: delay + 0.2, duration: 0.8 }} className="relative h-[400px] sm:h-[480px] [perspective:1200px]" aria-hidden>
      {["p4", "p3", "p5"].map((p, i) => (
        <motion.div key={p} className="absolute left-1/2 top-2 -ml-[105px] sm:-ml-[140px] w-[210px] sm:w-[280px] rounded-[4px] overflow-hidden shadow-[0_30px_50px_-18px_rgba(20,5,30,0.7)]"
          animate={{ x: `${(i - 1) * (fan ? 42 : 4)}%`, y: i * 6, rotateY: fan ? (1 - i) * 22 : -16, rotateZ: fan ? 0 : (i - 1) * 3, scale: memo ? 0.9 : 1 }} transition={{ type: "spring", stiffness: 60, damping: 15 }}>
          <Image src={`/ledger/${p}.png`} alt="" width={1310} height={1853} className="block w-full h-auto" priority sizes="280px" />
        </motion.div>
      ))}
      <motion.div className="absolute left-1/2 -ml-[140px] w-[280px] rounded-[12px] bg-[#2b1a3d] p-5 text-[#fff8e7] shadow-[0_40px_60px_-20px_rgba(20,5,30,0.8)]" initial={false} animate={{ top: memo ? 90 : 300, opacity: memo ? 1 : 0, rotateX: memo ? 0 : 50 }} transition={{ type: "spring", stiffness: 70, damping: 15 }}>
        <p className="text-[15px] text-[#f4d35e] font-semibold">Credit memo, draft</p>
        {CHIPS.map(([l]) => <p key={l} className="mt-4 text-[15px] h-7">{l}</p>)}
      </motion.div>
      {CHIPS.map(([l, v], i) => (
        <motion.span key={l} className="num absolute left-1/2 rounded-full border-2 border-[#b82e54] bg-[#fff8e7] text-[#2b1a3d] px-2.5 text-[14px] font-semibold" initial={false}
          animate={memo ? { x: 24, top: 141 + i * 44, opacity: 1, scale: 1 } : { x: [-110, 20, 60][i], top: [90, 150, 210][i], opacity: lift ? 1 : 0, scale: lift ? 1 : 0.3 }} transition={{ type: "spring", stiffness: 70, damping: 14, delay: i * 0.08 }}>{v}</motion.span>
      ))}
    </motion.div>
  );
}
