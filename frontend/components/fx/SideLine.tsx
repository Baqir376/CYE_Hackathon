"use client";
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring, useTransform } from "motion/react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { cx } from "../ui";

export type Stop = { id: string; label: string };

function strand(H: number, phase: number, amp = 8) {
  let s = "";
  for (let y = 0; y <= H; y += 4) s += `${y ? "L" : "M"}${(26 + Math.sin(y * 0.05 + phase) * amp).toFixed(1)} ${y}`;
  return s;
}
const xAt = (y: number) => 26 + Math.sin(y * 0.05) * 8;
const sub = (cb: () => void) => { window.addEventListener("resize", cb); return () => window.removeEventListener("resize", cb); };
const height = () => Math.round(Math.min(680, window.innerHeight * 0.66));

/** Three woven threads that draw themselves as you scroll, with a bead at the tip and a stop for every section. */
export default function SideLine({ stops }: { stops: Stop[] }) {
  const H = useSyncExternalStore(sub, height, () => 520);
  const strands = useMemo(() => [0, 2.1, 4.2].map((p) => strand(H, p)), [H]);
  const { scrollYProgress } = useScroll();
  const p = useSpring(scrollYProgress, { stiffness: 90, damping: 24, restDelta: 0.0005 });
  const cy = useTransform(p, (v) => Math.max(0, Math.min(1, v)) * H);
  const cx_ = useTransform(cy, xAt);
  const [marks, setMarks] = useState<number[]>([]);
  const [now, setNow] = useState(-1);

  useEffect(() => {
    const measure = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      setMarks(stops.map((s) => { const e = document.getElementById(s.id); return e ? Math.min(1, Math.max(0, (e.getBoundingClientRect().top + window.scrollY) / max)) : 0; }));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    return () => ro.disconnect();
  }, [stops]);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    let i = -1;
    marks.forEach((m, k) => { if (v >= m - 0.035) i = k; });
    setNow(i);
  });

  return (
    <>
      <nav aria-label="Page sections" className="no-print hidden lg:block fixed left-3 xl:left-5 top-1/2 -translate-y-1/2 z-30">
        <div className="relative rounded-full bg-white/85 backdrop-blur-md border border-white px-0 py-6 w-[54px] shadow-[0_16px_40px_-18px_rgba(43,26,61,0.5)]">
          <svg width="52" height={H} viewBox={`0 0 52 ${H}`} className="block overflow-visible" aria-hidden>
            {strands.map((d, i) => <path key={i} d={d} fill="none" stroke="rgba(43,26,61,0.2)" strokeWidth="1.2" />)}
            {strands.map((d, i) => <motion.path key={i} d={d} fill="none" stroke={["#1F3C88", "#B82E54", "#17684C"][i]} strokeWidth="3" strokeLinecap="round" style={{ pathLength: p }} />)}
            <motion.circle r="18" fill="#E9B44C" opacity="0.35" style={{ cx: cx_, cy }} />
            <motion.circle r="8" fill="#FFF8E7" stroke="#B82E54" strokeWidth="3.5" style={{ cx: cx_, cy }} />
          </svg>
          {marks.map((m, i) => {
            const on = i === now;
            return (
              <a key={stops[i].id} href={`#${stops[i].id}`} aria-current={on ? "true" : undefined} className="group absolute left-0 flex items-center h-6 -mt-3" style={{ top: 24 + m * H }}>
                <span className={cx("ml-[20px] h-[12px] w-[12px] rounded-full border-2 transition-all duration-300", i <= now ? "bg-[#E9B44C] border-[#E9B44C]" : "bg-white border-[#b7abc3]", on && "scale-125")} />
                <span className={cx("absolute left-[64px] whitespace-nowrap rounded-full bg-white text-ink shadow-md text-[15px] font-semibold px-3 py-1 transition-all duration-300", on ? "opacity-0 translate-x-0" : "opacity-0 -translate-x-2", "group-hover:opacity-100 group-hover:translate-x-0 group-focus-visible:opacity-100 group-focus-visible:translate-x-0")}>{stops[i].label}</span>
              </a>
            );
          })}
          <div className="absolute left-[64px] pointer-events-none" style={{ top: 24 + (marks[now] ?? 0) * H }} aria-hidden>
            <AnimatePresence mode="wait">
              {now >= 0 && <motion.span key={now} initial={{ opacity: 0, x: -10 }} animate={{ opacity: [0, 1, 1, 0], x: 0 }} transition={{ duration: 2.2, times: [0, 0.15, 0.75, 1] }}
                className="absolute -translate-y-1/2 whitespace-nowrap rounded-full bg-white text-magenta shadow-md text-[15px] font-semibold px-3 py-1">{stops[Math.max(0, now)].label}</motion.span>}
            </AnimatePresence>
          </div>
        </div>
      </nav>
      <div aria-hidden className="no-print lg:hidden fixed right-[3px] top-20 bottom-6 w-[5px] rounded-full bg-[#2b1a3d]/15 z-30 overflow-hidden">
        <motion.div className="h-full w-full origin-top rounded-full bg-[linear-gradient(#1F3C88,#B82E54,#17684C)]" style={{ scaleY: p }} />
      </div>
    </>
  );
}
