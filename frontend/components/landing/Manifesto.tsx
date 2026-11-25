"use client";
import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef } from "react";
import data from "@/lib/ledger.json";
import type { Base, Limits } from "@/lib/stress";
import { Edge, Weave } from "../fx/Engrave";
import StressLab from "../fx/StressLab";
import { Reveal } from "../motion/primitives";

const TEXT = "A credit analyst opens a 227-page report, finds the four pages that matter, retypes every figure and adds it all up by hand. Credence does that part. The judgement stays yours.";

function Word({ w, i, n, p }: { w: string; i: number; n: number; p: MotionValue<number> }) {
  const at = i / n;
  const color = useTransform(p, [at, at + 0.1], ["#766a82", "#2b1a3d"]);
  return <motion.span style={{ color }}>{w} </motion.span>;
}

/** The sentence lights up word by word as it is read. */
export function Manifesto() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 60%"] });
  const words = TEXT.split(" ");
  return (
    <section id="why" ref={ref} className="relative bg-paper overflow-hidden">
      <Weave bands={4} lines={9} alpha={0.5} />
      <p className="relative mx-auto max-w-[1120px] px-6 lg:pl-24 2xl:pl-6 py-40 lg:py-56 font-note text-[clamp(34px,4.9vw,76px)] leading-[1.1]">
        {words.map((w, i) => <Word key={i} w={w} i={i} n={words.length} p={scrollYProgress} />)}
      </p>
    </section>
  );
}

export function StressTeaser() {
  return (
    <section id="stress" className="relative bg-[#f1e9f7] text-ink overflow-hidden">
      <Weave bands={6} lines={9} alpha={0.5} />
      <Edge from="#FFE9E1" />
      <div className="relative mx-auto max-w-[1360px] px-6 lg:pl-24 2xl:pl-6 pt-44 pb-32">
        <Reveal><h2 className="font-note text-[clamp(44px,6vw,96px)] leading-[0.95] max-w-4xl">Now lean on it until it breaks.</h2>
          <p className="mt-5 text-[20px] max-w-xl leading-relaxed">The sample company&apos;s money, drawn as a river. Pull sales down and watch what reaches the bank&apos;s limits first.</p></Reveal>
        <div className="mt-12"><StressLab base={data.base as Base} limits={data.limits as Limits} policy="Sample Corporate Credit Policy" /></div>
      </div>
    </section>
  );
}
