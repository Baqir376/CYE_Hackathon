"use client";
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "motion/react";
import { ReactNode, useSyncExternalStore } from "react";
import { cx } from "../ui";

const noop = () => () => {};
function mediaStore(query: string) {
  return {
    subscribe: (cb: () => void) => { const m = window.matchMedia(query); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); },
    get: () => window.matchMedia(query).matches,
  };
}
const FINE = mediaStore("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
/** True only for a real mouse/trackpad and no reduced-motion request. All pointer effects are gated on this. */
export function useFinePointer() {
  return useSyncExternalStore(FINE.subscribe, FINE.get, () => false);
}

let cached: "webgl" | "static" | null = null;
function detect3D(): "webgl" | "static" {
  if (cached) return cached;
  const force = new URLSearchParams(window.location.search).has("force3d");
  if (!force && (window.innerWidth < 900 || window.matchMedia("(prefers-reduced-motion: reduce)").matches)) return (cached = "static");
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return (cached = "static");
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    cached = !force && /swiftshader|llvmpipe|software|basic render/i.test(name) ? "static" : "webgl";
  } catch { cached = "static"; }
  return cached;
}
/** "static" on phones, reduced motion, or machines that would render WebGL in software. */
export function use3D() {
  return useSyncExternalStore(noop, detect3D, () => "static" as const);
}

/** Card that tilts toward the pointer in 3D with a moving glare. */
export function Tilt({ children, className, max = 7, glare = true }: { children: ReactNode; className?: string; max?: number; glare?: boolean }) {
  const fine = useFinePointer();
  const px = useMotionValue(0.5), py = useMotionValue(0.5), on = useMotionValue(0);
  const cfg = { stiffness: 200, damping: 20 };
  const rx = useSpring(useTransform(py, [0, 1], [max, -max]), cfg), ry = useSpring(useTransform(px, [0, 1], [-max, max]), cfg);
  const gx = useTransform(px, (v) => `${v * 100}%`), gy = useTransform(py, (v) => `${v * 100}%`);
  const o = useSpring(on, { stiffness: 180, damping: 24 });
  const bg = useMotionTemplate`radial-gradient(380px circle at ${gx} ${gy}, rgba(255,255,255,0.5), rgba(244,211,94,0.2) 40%, transparent 70%)`;
  if (!fine) return <div className={cx("relative", className)}>{children}</div>;
  return (
    <div className={className} style={{ perspective: 1100 }}
      onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); px.set((e.clientX - r.left) / r.width); py.set((e.clientY - r.top) / r.height); on.set(1); }}
      onPointerLeave={() => { px.set(0.5); py.set(0.5); on.set(0); }}>
      <motion.div className="relative h-full" style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}>
        {children}
        {glare && <motion.div aria-hidden className="absolute inset-0 rounded-[inherit] pointer-events-none mix-blend-soft-light" style={{ background: bg, opacity: o, borderRadius: 24 }} />}
      </motion.div>
    </div>
  );
}

/** Pulls its child slightly toward the pointer. */
export function Magnetic({ children, strength = 0.28, className }: { children: ReactNode; strength?: number; className?: string }) {
  const fine = useFinePointer();
  const x = useMotionValue(0), y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 260, damping: 18 }), sy = useSpring(y, { stiffness: 260, damping: 18 });
  if (!fine) return <span className={cx("inline-block", className)}>{children}</span>;
  return (
    <span className={cx("inline-block p-2 -m-2", className)}
      onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); x.set((e.clientX - r.left - r.width / 2) * strength); y.set((e.clientY - r.top - r.height / 2) * strength); }}
      onPointerLeave={() => { x.set(0); y.set(0); }}>
      <motion.span className="inline-block" style={{ x: sx, y: sy }}>{children}</motion.span>
    </span>
  );
}
