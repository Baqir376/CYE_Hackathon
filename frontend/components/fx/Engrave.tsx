"use client";
import { useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useFinePointer } from "../motion/pointer";
import { cx } from "../ui";

/**
 * One family of engraved line work, used on the landing page and inside the app:
 * Weave (twisted spirals behind a page), Edge (braided wave between sections), Ribbon and Strand (accents).
 * All of it is drawn with code, stands still, and is original.
 */
const TAU = Math.PI * 2;
export const THREADS = ["#1F3C88", "#B82E54", "#17684C", "#D9982B"];

function useSize<T extends Element>(ref: RefObject<T | null>, start: [number, number]) {
  const [s, set] = useState(start);
  useEffect(() => {
    const e = ref.current;
    if (!e) return;
    const ro = new ResizeObserver(([r]) => { const { width, height } = r.contentRect; if (width && height) set([Math.round(width), Math.round(height)]); });
    ro.observe(e);
    return () => ro.disconnect();
  }, [ref]);
  return s;
}

/* ---------- Weave: the twisted spirals behind a page. Still at rest; threads lean away from the mouse and settle back ---------- */
const INKS = ["31,60,136", "184,46,84", "23,104,76", "217,152,43"];
export function Weave({ className, bands = 5, lines = 10, alpha = 1, delay = 0 }: { className?: string; bands?: number; lines?: number; alpha?: number; delay?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion(), fine = useFinePointer();
  useEffect(() => {
    const cv = ref.current, g = cv?.getContext("2d");
    if (!cv || !g) return;
    let w = 0, h = 0, raf = 0, onScreen = true;
    const born = performance.now() + delay * 1000, open = 1700;
    const p = { x: 0, y: 0, tx: 0, ty: 0, f: 0, tf: 0 };
    const size = () => {
      const r = cv.getBoundingClientRect(), d = Math.min(1.5, window.devicePixelRatio || 1);
      w = r.width; h = r.height;
      cv.width = Math.max(1, Math.round(w * d)); cv.height = Math.max(1, Math.round(h * d));
      g.setTransform(d, 0, 0, d, 0, 0);
    };
    const draw = (now: number) => {
      raf = 0;
      const u = reduce ? 1 : Math.max(0, Math.min(1, (now - born) / open)), grow = 1 - Math.pow(1 - u, 4);
      p.x += (p.tx - p.x) * 0.14; p.y += (p.ty - p.y) * 0.14; p.f += (p.tf - p.f) * 0.09;
      g.clearRect(0, 0, w, h);
      g.lineWidth = 1;
      const gap = h / bands, step = 10, R = 150;
      for (let b = 0; b < bands; b++) {
        const base = gap * (b + 0.5);
        for (let i = 0; i < lines; i++) {
          const ph = (i / lines) * TAU, front = new Path2D(), back = new Path2D();
          let px = 0, py = 0, side = 0;
          for (let x = -step; x <= w + step; x += step) {
            const env = 0.55 + 0.45 * Math.sin(x * 0.0042 + b * 1.3), turn = x * 0.0125 + ph + b;
            let y = base + Math.sin(x * 0.0026 + b * 0.9) * gap * 0.16 + (Math.sin(turn) * gap * 0.42 * env + Math.sin(x * 0.031 - ph * 2) * 5) * grow;
            if (p.f > 0.004) { const dx = x - p.x, dy = y - p.y, q = dx * dx + dy * dy; if (q < R * R * 5) y += (dy / (Math.sqrt(q) || 1)) * Math.exp(-q / (R * R)) * 38 * p.f; }
            const s = Math.cos(turn) > 0 ? 1 : -1, t = s > 0 ? front : back;
            if (x > -step) { if (s !== side) t.moveTo(px, py); t.lineTo(x, y); }
            px = x; py = y; side = x > -step ? s : 0;
          }
          // the near side of every turn is darker than the far side, which is what makes it read as a spiral
          g.strokeStyle = `rgba(${INKS[(i + b) % 4]},${0.3 * alpha})`; g.stroke(front);
          g.strokeStyle = `rgba(${INKS[(i + b) % 4]},${0.12 * alpha})`; g.stroke(back);
        }
      }
      if (onScreen && (u < 1 || Math.abs(p.f - p.tf) > 0.004 || (p.tf > 0 && Math.abs(p.tx - p.x) + Math.abs(p.ty - p.y) > 0.6))) kick();
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(draw); };
    let idle: ReturnType<typeof setTimeout> | undefined;
    const move = (ev: PointerEvent) => {
      const r = cv.getBoundingClientRect(), y = ev.clientY - r.top;
      if (y < -160 || y > h + 160) { if (p.tf) { p.tf = 0; kick(); } return; }
      p.tx = ev.clientX - r.left; p.ty = y;
      if (p.f < 0.05) { p.x = p.tx; p.y = p.ty; }
      p.tf = 1; kick();
      clearTimeout(idle);
      idle = setTimeout(() => { p.tf = 0; kick(); }, 500);
    };
    size(); kick();
    const ro = new ResizeObserver(() => { size(); kick(); });
    ro.observe(cv);
    const io = new IntersectionObserver(([n]) => { onScreen = n.isIntersecting; if (onScreen) kick(); });
    io.observe(cv);
    if (!reduce && fine) window.addEventListener("pointermove", move, { passive: true });
    return () => { cancelAnimationFrame(raf); clearTimeout(idle); ro.disconnect(); io.disconnect(); window.removeEventListener("pointermove", move); };
  }, [bands, lines, alpha, delay, reduce, fine]);
  return <canvas ref={ref} data-weave aria-hidden className={cx("absolute inset-0 h-full w-full pointer-events-none", className)} />;
}

/* ---------- Edge: a braid of threads riding the wave between two sections; run the mouse across it and it twangs ---------- */
const EH = 112, NT = 9;
const ridge = (x: number, w: number) => 54 + Math.sin((x / w) * TAU * (w < 700 ? 1.2 : 2.4) + 0.4) * 19;
function threadPath(i: number, w: number, push?: (x: number) => number) {
  let s = "";
  for (let x = -8; x <= w + 8; x += 8) {
    const env = 0.5 + 0.5 * Math.sin((x / w) * TAU * 1.7 + 1.1), y = ridge(x, w) + Math.sin(x * 0.034 + (i / NT) * TAU) * (3.5 + 11 * env) + (push ? push(x) : 0);
    s += `${s ? "L" : "M"}${x} ${y.toFixed(1)}`;
  }
  return s;
}

export function Edge({ from }: { from: string }) {
  const wrap = useRef<HTMLDivElement>(null), g = useRef<SVGGElement>(null);
  const fine = useFinePointer(), reduce = useReducedMotion();
  const [w] = useSize(wrap, [1440, EH]);
  const lines = useMemo(() => Array.from({ length: NT }, (_, i) => threadPath(i, w)), [w]);
  const fill = useMemo(() => { let s = "M0 0"; for (let x = 0; x <= w; x += 8) s += `L${x} ${ridge(x, w).toFixed(1)}`; return `${s}L${w} ${ridge(w, w).toFixed(1)}L${w} 0Z`; }, [w]);

  useEffect(() => {
    const el = wrap.current;
    if (!el || !fine || reduce) return;
    let raf = 0, lastY = 0, lastT = 0, side = 0;
    const hit = { x: 0, amp: 0, t: 0 };
    const tick = (now: number) => {
      const t = (now - hit.t) / 1000, kids = g.current?.children;
      if (!kids) return;
      const done = t > 1.3;
      for (let i = 0; i < kids.length; i++) kids[i].setAttribute("d", threadPath(i, w, done ? undefined : (x) => hit.amp * Math.exp(-(((x - hit.x) / 150) ** 2)) * Math.exp(-3.4 * t) * Math.cos(24 * t - i * 0.35)));
      raf = done ? 0 : requestAnimationFrame(tick);
    };
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      if (e.clientY < r.top - 60 || e.clientY > r.bottom + 60) { side = 0; return; }
      const x = e.clientX - r.left, y = e.clientY - r.top, now = performance.now(), s = Math.sign(y - ridge(x, w));
      const v = (y - lastY) / Math.max(8, now - lastT);
      if (side && s !== side && now - lastT < 200) {
        Object.assign(hit, { x, amp: Math.max(-26, Math.min(26, v * 16)), t: now });
        if (!raf) raf = requestAnimationFrame(tick);
      }
      side = s; lastY = y; lastT = now;
    };
    // the section's own content lies on top of the threads, so listen on the window
    window.addEventListener("pointermove", move, { passive: true });
    return () => { cancelAnimationFrame(raf); window.removeEventListener("pointermove", move); };
  }, [w, fine, reduce]);

  return (
    <div ref={wrap} data-edge aria-hidden className="absolute -top-px inset-x-0 h-[112px] overflow-hidden">
      <svg width={w} height={EH} viewBox={`0 0 ${w} ${EH}`} preserveAspectRatio="none" className="block w-full h-full" fill="none">
        <path d={fill} fill={from} />
        <g ref={g}>{lines.map((d, i) => <path key={i} d={d} stroke={THREADS[i % 4]} strokeOpacity="0.62" strokeWidth="1.15" />)}</g>
      </svg>
    </div>
  );
}

/* ---------- Ribbon: a short flat braid for cards ---------- */
export function Ribbon({ color, className }: { color?: string; className?: string }) {
  const d = (ph: number) => { let s = ""; for (let x = 0; x <= 420; x += 6) s += `${x ? "L" : "M"}${x} ${(50 + Math.sin(x * 0.028 + ph) * 34 * (0.5 + 0.5 * Math.sin(x * 0.0075))).toFixed(1)}`; return s; };
  return (
    <svg viewBox="0 0 420 100" className={cx("pointer-events-none", className)} fill="none" aria-hidden preserveAspectRatio="none">
      {Array.from({ length: 9 }, (_, i) => <path key={i} d={d((i / 9) * TAU)} stroke={color || THREADS[i % 4]} strokeOpacity={color ? 1 : 0.5} strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
    </svg>
  );
}

/* ---------- Strand: the same braid standing upright, for the app's side rail ---------- */
export function Strand({ className }: { className?: string }) {
  const d = (ph: number) => { let s = ""; for (let y = 0; y <= 400; y += 5) s += `${y ? "L" : "M"}${(22 + Math.sin(y * 0.075 + ph) * 13 * (0.35 + 0.65 * Math.sin((y / 400) * Math.PI))).toFixed(1)} ${y}`; return s; };
  return (
    <svg viewBox="0 0 44 400" className={cx("pointer-events-none", className)} fill="none" aria-hidden preserveAspectRatio="none">
      {[0, 1, 2, 3, 4, 5].map((i) => <path key={i} d={d((i / 6) * TAU)} stroke={THREADS[i % 4]} strokeOpacity="0.6" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />)}
    </svg>
  );
}

/* ---------- Banner: the header every app page shares ---------- */
export function Banner({ children, tint = "#E6EEFC", className }: { children: React.ReactNode; tint?: string; className?: string }) {
  return (
    <header className={cx("relative overflow-hidden rounded-[24px] no-print", className)} style={{ background: tint }}>
      <Ribbon className="absolute right-0 top-0 h-full w-[64%] opacity-40 sm:opacity-75 [mask-image:linear-gradient(90deg,transparent,black_55%)]" />
      <div className="relative">{children}</div>
    </header>
  );
}
