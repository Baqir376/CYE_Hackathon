"use client";
import { motion, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { CountUp, Reveal } from "../motion/primitives";
import { Magnetic, useFinePointer } from "../motion/pointer";
import { cx } from "../ui";
import { Edge, Ribbon, Weave } from "../fx/Engrave";

const NOTES = [
  { n: 227, t: "pages read", l: "A real annual report. It found the statements by itself.", bg: "#E9B44C", fg: "#2B1A3D", ln: "rgba(43,26,61,.34)", r: -5 },
  { n: 20, t: "totals re-added", l: "Every printed total in that report, checked against its own lines.", bg: "#FFE9D6", fg: "#A8274A", ln: "rgba(168,39,74,.32)", r: 3 },
  { n: 19, t: "lies blocked", l: "Wrong memo sentences in our tests. None get through.", bg: "#BFE3CD", fg: "#0F4D38", ln: "rgba(15,77,56,.3)", r: -2 },
  { n: 5, t: "thousand tokens", l: "All the AI needs for a whole case. The rest is plain arithmetic.", bg: "#C9D4F2", fg: "#1F3C88", ln: "rgba(31,60,136,.3)", r: 5 },
];

export function Proof() {
  const ref = useRef<HTMLDivElement>(null);
  const fine = useFinePointer();
  return (
    <section id="proof" className="relative bg-[#fffdf7] text-ink overflow-hidden">
      <Weave bands={4} lines={9} alpha={0.6} />
      <Edge from="#E6EEFC" />
      <div ref={ref} className="relative mx-auto max-w-[1280px] px-6 lg:pl-24 2xl:pl-6 pt-44 pb-36">
        <Reveal><h2 className="font-note text-[clamp(42px,5.6vw,84px)] leading-[0.96] max-w-4xl">Tested on real paper, not on a slide.</h2></Reveal>
        {fine && <p className="mt-5 text-[18px]">Drag the notes around.</p>}
        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4">
          {NOTES.map((x, i) => (
            <motion.div key={x.t} initial={{ opacity: 0, y: 80, rotate: x.r * 4 }} whileInView={{ opacity: 1, y: 0, rotate: x.r }} viewport={{ once: true, margin: "-40px" }}
              transition={{ type: "spring", stiffness: 120, damping: 13, delay: i * 0.1 }} drag={fine} dragConstraints={ref} dragElastic={0.35}
              whileHover={fine ? { scale: 1.05, rotate: 0, zIndex: 5 } : undefined} whileDrag={{ scale: 1.1, zIndex: 10, cursor: "grabbing" }}
              className={cx("relative overflow-hidden rounded-[10px] p-3 shadow-[0_26px_50px_-18px_rgba(43,26,61,0.6)] select-none", fine && "cursor-grab")} style={{ background: x.bg, color: x.fg }}>
              <Ribbon color={x.ln} className="absolute inset-x-0 top-0 w-full h-[58%]" />
              <div className="relative rounded-[6px] border-[1.5px] px-4 pt-4 pb-5 min-h-[216px] flex flex-col" style={{ borderColor: x.fg }}>
                <p className="font-note text-[78px] leading-[0.8] mt-2"><CountUp to={x.n} /></p>
                <p className="mt-3 text-[20px] font-semibold leading-tight">{x.t}</p>
                <p className="mt-auto pt-4 text-[16px] leading-snug">{x.l}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

const USE = [
  ["Drop it in", "One PDF. A whole annual report is fine."],
  ["Clear the list", "A guide shows what needs you, most important first."],
  ["Send the memo", "Click any figure to see its page, then submit."],
];
export function UseIt() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const p = useSpring(scrollYProgress, { stiffness: 120, damping: 28 });
  const rotateX = useTransform(p, [0, 1], [reduce ? 0 : 38, 0]), scale = useTransform(p, [0, 1], [reduce ? 1 : 0.84, 1]);
  return (
    <section id="steps" className="relative bg-paper text-ink overflow-hidden">
      <Edge from="#F1E9F7" />
      <div className="mx-auto max-w-[1180px] px-6 lg:pl-24 2xl:pl-6 pt-44 pb-28">
        <Reveal><h2 className="font-note text-[clamp(46px,6.4vw,100px)] leading-[0.94] text-center">Three steps. <span className="text-magenta">That&apos;s it.</span></h2></Reveal>
        <div ref={ref} className="mt-14 [perspective:1400px]">
          <motion.div style={{ rotateX, scale, transformOrigin: "50% 100%" }} className="rounded-[20px] bg-white p-2.5 shadow-[0_60px_110px_-50px_rgba(43,26,61,0.8)]">
            <Image src="/workspace-spiral.png" alt="The Credence workspace: next steps, key figures, risk signals and the source page with a highlighted cell" width={1440} height={900} className="rounded-[12px] w-full h-auto" />
          </motion.div>
        </div>
        <ol className="mt-16 grid md:grid-cols-3 gap-8">
          {USE.map(([t, d], i) => (
            <li key={t}><Reveal delay={i * 0.1}><span className={cx("font-note text-[64px] leading-none", ["text-magenta", "text-blue", "text-green"][i])}>{i + 1}</span>
              <h3 className="mt-2 text-[26px] font-bold">{t}</h3><p className="mt-1 text-[18px] text-ink-2 leading-relaxed">{d}</p></Reveal></li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section id="start" className="relative bg-[#fbe5a6] text-ink overflow-hidden">
      <Weave bands={4} lines={10} alpha={0.95} />
      <Edge from="#E1F1E8" />
      <FloatingFigures />
      <div className="relative z-10 mx-auto max-w-[900px] px-6 py-48 text-center pt-60">
        <Reveal><h2 className="font-note text-[clamp(56px,9vw,140px)] leading-[0.88]">Check our numbers.</h2>
          <p className="mt-7 text-[21px] font-medium">Please do. Run the sample company and click any figure.</p>
          <div className="mt-10"><Magnetic><Link href="/app" className="shine note-btn bg-ink text-lemon text-[20px]">Open the app</Link></Magnetic></div>
        </Reveal>
      </div>
    </section>
  );
}

const FLOAT = [["4,850,000", 8, 20, 60], ["(396,000)", 80, 16, 110], ["1,420,000", 4, 66, 130], ["5,377,000", 82, 62, 70], ["125,000", 20, 84, 95], ["(342,000)", 70, 86, 140]] as const;
/** Figure slips that drift at different depths as the page scrolls. */
function FloatingFigures() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  return (
    <div ref={ref} className="absolute inset-0 hidden md:block" aria-hidden>
      {FLOAT.map(([v, x, y, depth], i) => <Slip key={v} v={v} x={x} y={y} depth={depth} i={i} p={scrollYProgress} />)}
    </div>
  );
}
function Slip({ v, x, y, depth, i, p }: { v: string; x: number; y: number; depth: number; i: number; p: MotionValue<number> }) {
  const dy = useTransform(p, [0, 1], [depth, -depth]), rot = useTransform(p, [0, 1], [i % 2 ? 10 : -10, i % 2 ? -8 : 8]);
  return <motion.span style={{ left: `${x}%`, top: `${y}%`, y: dy, rotate: rot }} className="num absolute rounded-full border-2 border-magenta bg-cream px-5 py-2 text-[20px] font-semibold shadow-[0_20px_34px_-16px_rgba(43,26,61,0.7)]">{v}</motion.span>;
}
