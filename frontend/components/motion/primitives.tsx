"use client";
import { animate, motion, MotionConfig, useInView, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { ReactNode, useEffect, useRef } from "react";

export const EASE = [0.22, 1, 0.36, 1] as const;
export const SPRING = { type: "spring", stiffness: 260, damping: 26 } as const;

export function MotionRoot({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/** Fade + rise when scrolled into view. */
export function Reveal({ children, delay = 0, y = 18, className, once = true }: {
  children: ReactNode; delay?: number; y?: number; className?: string; once?: boolean;
}) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }} viewport={{ once, margin: "-60px" }}
      transition={{ duration: 0.7, ease: EASE, delay }}>
      {children}
    </motion.div>
  );
}

/** Headline that reveals word by word with a soft blur. */
export function WordReveal({ text, className, delay = 0, stagger = 0.06, italic = [] as string[] }: {
  text: string; className?: string; delay?: number; stagger?: number; italic?: string[];
}) {
  const words = text.split(" ");
  return (
    <span className={className}><span className="sr-only">{text}</span>
      {words.map((w, i) => (
        <span key={i} aria-hidden>{i > 0 && " "}<span className="inline-block overflow-hidden align-bottom pb-[0.08em] -mb-[0.08em]" aria-hidden>
          <motion.span className={`inline-block ${italic.includes(w.replace(/[.,]/g, "")) ? "font-display italic text-teal-300" : ""}`}
            initial={{ y: "105%", opacity: 0, filter: "blur(8px)" }} animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.8, ease: EASE, delay: delay + i * stagger }}>
            {w}
          </motion.span>
        </span></span>
      ))}
    </span>
  );
}

/** Number that counts up when it enters the viewport. */
export function CountUp({ to, decimals = 0, duration = 1.4, prefix = "", suffix = "", className, start = true }: {
  to: number; decimals?: number; duration?: number; prefix?: string; suffix?: string; className?: string; start?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const mv = useMotionValue(0);
  const reduce = useReducedMotion();
  const txt = useTransform(mv, (v) => `${prefix}${v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`);
  useEffect(() => {
    if (!inView || !start) return;
    if (reduce) { mv.set(to); return; }
    const c = animate(mv, to, { duration, ease: EASE });
    return () => c.stop();
  }, [inView, start, to, duration, mv, reduce]);
  return <motion.span ref={ref} className={className}>{txt}</motion.span>;
}

/** Children appear one after another. */
export function Stagger({ children, className, delay = 0, step = 0.06 }: { children: ReactNode[]; className?: string; delay?: number; step?: number }) {
  return (
    <div className={className}>
      {children.map((c, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE, delay: delay + i * step }}>
          {c}
        </motion.div>
      ))}
    </div>
  );
}
