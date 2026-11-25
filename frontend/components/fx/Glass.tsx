"use client";
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "motion/react";
import type { ReactNode } from "react";
import { useFinePointer } from "../motion/pointer";
import { EASE } from "../motion/primitives";
import { cx } from "../ui";

/** Frosted panel with a light that runs along its edge under the pointer, and an optional 3D tilt. */
export function Glass({ children, className, tilt = 0, delay, dark }: { children: ReactNode; className?: string; tilt?: number; delay?: number; dark?: boolean }) {
  const fine = useFinePointer();
  const px = useMotionValue(0.5), py = useMotionValue(0.5), on = useMotionValue(0);
  const spring = { stiffness: 220, damping: 22 };
  const rotateX = useSpring(useTransform(py, [0, 1], [tilt, -tilt]), spring), rotateY = useSpring(useTransform(px, [0, 1], [-tilt, tilt]), spring);
  const o = useSpring(on, { stiffness: 160, damping: 24 });
  const gx = useTransform(px, (v) => `${v * 100}%`), gy = useTransform(py, (v) => `${v * 100}%`);
  const edge = useMotionTemplate`radial-gradient(260px circle at ${gx} ${gy}, rgba(184,46,84,0.95), rgba(233,180,76,0.8) 35%, rgba(31,60,136,0.35) 60%, transparent 75%)`;
  const sheen = useMotionTemplate`radial-gradient(300px circle at ${gx} ${gy}, rgba(255,255,255,0.6), transparent 70%)`;
  return (
    <motion.div initial={delay === undefined ? false : { opacity: 0, y: 26, rotateX: 14 }} animate={delay === undefined ? undefined : { opacity: 1, y: 0, rotateX: 0 }} transition={{ duration: 0.7, ease: EASE, delay }}
      style={{ transformPerspective: 1100 }} className={cx(tilt > 0 && "h-full")}
      onPointerMove={fine ? (e) => { const r = e.currentTarget.getBoundingClientRect(); px.set((e.clientX - r.left) / r.width); py.set((e.clientY - r.top) / r.height); on.set(1); } : undefined}
      onPointerLeave={fine ? () => { px.set(0.5); py.set(0.5); on.set(0); } : undefined}>
      <motion.div style={tilt && fine ? { rotateX, rotateY, transformPerspective: 900 } : undefined} className={cx(dark ? "glass-dark rounded-[18px] relative" : "glass relative", tilt > 0 && "h-full", className)}>
        {fine && <motion.span aria-hidden className="glass-edge" style={{ background: edge, opacity: o }} />}
        {fine && <motion.span aria-hidden className="absolute inset-0 rounded-[inherit] pointer-events-none mix-blend-soft-light" style={{ background: sheen, opacity: o }} />}
        <div className="relative h-full">{children}</div>
      </motion.div>
    </motion.div>
  );
}

/** Half-dial that sweeps to show how many policy limits pass, are close, or are broken. */
export function PolicyDial({ pass, watch, breach }: { pass: number; watch: number; breach: number }) {
  const total = Math.max(1, pass + watch + breach), R = 78, L = Math.PI * R;
  const seg = [[pass, "#17684c"], [watch, "#e9b44c"], [breach, "#b82e54"]] as const;
  const start = seg.map((_, i) => seg.slice(0, i).reduce((a, s) => a + s[0], 0) / total);
  return (
    <div className="relative w-[200px] mx-auto">
      <svg viewBox="0 0 200 112" className="w-full block" aria-hidden>
        <path d="M22 100 A78 78 0 0 1 178 100" fill="none" stroke="rgba(43,26,61,0.10)" strokeWidth="18" strokeLinecap="round" />
        {seg.map(([n, color], i) => n > 0 && (
          <motion.path key={color} d="M22 100 A78 78 0 0 1 178 100" fill="none" stroke={color} strokeWidth="18" strokeDasharray={`${(n / total) * L - 3} ${L * 2}`}
            initial={{ strokeDashoffset: L * 1.2 }} animate={{ strokeDashoffset: -start[i] * L }} transition={{ duration: 1.3, ease: EASE, delay: 0.25 + i * 0.18 }} />
        ))}
      </svg>
      <p className="absolute inset-x-0 top-[44px] text-center font-note text-[58px] leading-none">{pass}</p>
      <p className="text-center text-[15px] text-ink-2 mt-1">of {total} policy limits pass</p>
    </div>
  );
}
