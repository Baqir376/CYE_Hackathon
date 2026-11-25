"use client";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { EASE } from "../motion/primitives";


const LINES = Array.from({ length: 12 }, (_, i) => { let s = ""; for (let x = 0; x <= 1440; x += 12) s += `${x ? "L" : "M"}${x} ${(150 + Math.sin(x * 0.0105 + i * 0.52) * 95 * (0.35 + 0.65 * Math.sin((x / 1440) * Math.PI))).toFixed(1)}`; return s; });

/**
 * Opening sequence: the mark draws itself, the wordmark rises, a ledger line fills, then the curtain lifts.
 * Plays once per browser session (so live demos aren't slowed down) and can be skipped with a click.
 */
export default function IntroLoader() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (sessionStorage.getItem("credence-intro") || params.has("nointro")) return;
    sessionStorage.setItem("credence-intro", "1");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off read of sessionStorage after mount
    setShow(true);
  }, []);
  // exit timer lives in its own effect so a StrictMode double-run can't leave the curtain stuck
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => setShow(false), 1500);
    return () => clearTimeout(t);
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div key="intro" onClick={() => setShow(false)}
          className="fixed inset-0 z-[100] bg-[#f4faf2] flex items-center justify-center cursor-pointer"
          exit={{ clipPath: "inset(0 0 100% 0)" }} initial={{ clipPath: "inset(0 0 0% 0)" }}
          transition={{ duration: 0.9, ease: EASE }}>
          <motion.svg initial={{ clipPath: "inset(0 100% 0 0)" }} animate={{ clipPath: "inset(0 0% 0 0)" }} transition={{ duration: 1.2, ease: EASE }} viewBox="0 0 1440 300" preserveAspectRatio="none" className="absolute inset-x-0 w-full h-[300px]" fill="none" aria-hidden>
            {LINES.map((d, i) => <path key={i} d={d} stroke={["#1F3C88", "#B82E54", "#17684C", "#D9982B"][i % 4]} strokeOpacity="0.55" strokeWidth="1.3" vectorEffect="non-scaling-stroke" />)}
          </motion.svg>
          <div className="relative flex flex-col items-center">
            <svg width="88" height="88" viewBox="0 0 32 32" aria-hidden>
              <motion.rect x="1.5" y="1.5" width="29" height="29" rx="7.5" fill="none" stroke="#2B1A3D" strokeWidth="1.4"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: EASE }} />
              <motion.path d="M21.5 11.2A7 7 0 1 0 21.5 20.8" stroke="#B82E54" strokeWidth="2.4" fill="none" strokeLinecap="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: EASE, delay: 0.25 }} />
              <motion.circle cx="21.6" cy="16" r="2.1" fill="#E9B44C" initial={{ scale: 0 }} animate={{ scale: [0, 1.6, 1] }}
                transition={{ duration: 0.5, delay: 1.05 }} style={{ transformOrigin: "21.6px 16px" }} />
            </svg>
            <div className="overflow-hidden mt-6">
              <motion.p className="font-note text-ink text-6xl leading-none" initial={{ y: "110%" }} animate={{ y: 0 }}
                transition={{ duration: 0.8, ease: EASE, delay: 0.55 }}>Credence</motion.p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
