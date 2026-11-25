"use client";
import { animate, motion, useInView, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform, useVelocity, type MotionValue } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent as RPointer } from "react";
import data from "@/lib/ledger.json";
import { THREADS, Weave } from "../fx/Engrave";
import { EASE } from "../motion/primitives";
import { Magnetic } from "../motion/pointer";

/** Everything here is real parser output for the fictional sample: positions, classifications and totals. */
type R = (typeof data.rows)[number];
const PW = 595.28, PH = 841.89, EDGE = 0.62;
const ROWS = (data.rows as R[]).filter((r) => r.page === 3);
const byId = new Map(ROWS.map((r) => [r.id, r]));
const pos = (r: R, c = 0) => { const b = r.cells[c].b; return { x: (b[0] + b[2]) / 2, y: (b[1] + b[3]) / 2 }; };
// the tour parks a little left of the figure so its name fits in the glass too
const look = (r: R) => { const p = pos(r); return { x: p.x - 40, y: p.y }; };
const find = (label: string) => ROWS.find((r) => r.label === label);
const TOUR = [find("Trade debts"), ROWS.find((r) => r.sum.length === 6), find("Short term borrowings"), ROWS.find((r) => r.off), find("Cash and bank balances")].filter(Boolean) as R[];
const num = (t: string) => Number(t.replace(/[(),]/g, "")) * (t.startsWith("(") ? -1 : 1);

const sub = (cb: () => void) => { window.addEventListener("resize", cb); return () => window.removeEventListener("resize", cb); };
const scaleNow = () => { const w = window.innerWidth, h = window.innerHeight; return Math.round((w < 1024 ? Math.min((w - 84) / PW, 0.82) : Math.max(0.5, Math.min((w * 0.27) / PW, (h - 190) / PH, 1))) * 1000) / 1000; };

const XRay = memo(function XRay({ zoom }: { zoom: number }) {
  return (
    <svg width={PW * zoom} height={PH * zoom} viewBox={`0 0 ${PW} ${PH}`} className="block max-w-none" aria-hidden>
      <rect width={PW} height={PH} fill="#f4f8ff" />
      {ROWS.filter((r) => r.sum.length).map((r) => {
        const ty = pos(r).y, x = 433;
        return r.sum.map((id) => {
          const c = byId.get(id);
          if (!c) return null;
          const cy = pos(c).y, bow = 8 + Math.min(34, Math.abs(ty - cy) * 0.14);
          return <path key={r.id + id} d={`M${x} ${cy} C${x + bow} ${cy} ${x + bow} ${ty} ${x} ${ty}`} fill="none" stroke={r.off ? "#B82E54" : "#17684C"} strokeWidth={r.off ? 1.2 : 0.8} opacity={r.off ? 1 : 0.8} />;
        });
      })}
      {ROWS.map((r) => (
        <g key={r.id}>
          <text x={r.cells[0].b[0] - 9} y={r.y + 3} textAnchor="end" fill={r.off ? "#A8274A" : r.sum.length ? "#17684C" : r.code ? "#1F3C88" : "#6b5d78"} fontSize="7.6" fontFamily="var(--font-body)" fontWeight="700">{r.off ? `should be ${(num(r.cells[0].t) - r.off).toLocaleString("en-US")}` : r.sum.length ? `${r.sum.length} lines add up` : r.code || "not needed"}</text>
          {r.cells.map((c, i) => (
            <g key={i}>
              <rect x={c.b[0] - 3} y={c.b[1] - 1.5} width={c.b[2] - c.b[0] + 6} height={c.b[3] - c.b[1] + 3} rx="4" fill={r.off && !i ? "#FBD3DC" : r.sum.length ? "#D3ECDD" : "#DCE7FB"} />
              <text x={c.b[2]} y={(c.b[1] + c.b[3]) / 2 + 3} textAnchor="end" fill={r.off && !i ? "#A8274A" : "#2B1A3D"} fontSize="8.4" fontFamily="var(--font-mono)" fontWeight="600">{c.t}</text>
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
});

/** One strand of the twisted thread that ties the glass to its tag. */
function Strand({ i, ax, ay, bx, by, r }: { i: number; ax: MotionValue<number>; ay: MotionValue<number>; bx: number; by: MotionValue<number>; r: number }) {
  const d = useTransform([ax, ay, by], ([x1, y1, y2]: number[]) => {
    const dx = bx - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
    if (L < r) return "M0 0";
    const ux = dx / L, uy = dy / L, sx = x1 + ux * r, sy = y1 + uy * r, len = L - r;
    let s = "";
    for (let k = 0; k <= 36; k++) {
      const t = k / 36, o = Math.sin(t * (2 + len / 90) * Math.PI * 2 + (i / 4) * Math.PI * 2) * Math.min(11, len * 0.12) * Math.sin(Math.PI * t);
      s += `${k ? "L" : "M"}${(sx + ux * len * t - uy * o).toFixed(1)} ${(sy + uy * len * t + ux * o + Math.sin(Math.PI * t) * 14).toFixed(1)}`;
    }
    return s;
  });
  return <motion.path d={d} stroke={THREADS[i]} strokeWidth="1.8" fill="none" strokeLinecap="round" />;
}

function Readout({ r, c, paused, toggle }: { r: R; c: number; paused: boolean; toggle: () => void }) {
  const cell = r.cells[c], bad = r.off && !c;
  return (
    <>
      <motion.div key={`${r.id}-${c}`} initial={{ y: 7 }} animate={{ y: 0 }} transition={{ duration: 0.16 }} className="min-h-[124px]">
        <p className="text-[15px] text-ink-2 leading-snug pr-10">{r.label || (r.off ? "Printed subtotal" : `Subtotal of ${r.sum.length} lines`)}, {c ? 2025 : 2026}</p>
        <p className={`num text-[clamp(27px,2vw,36px)] leading-tight font-semibold ${bad ? "text-red" : "text-ink"}`}>{cell.t}</p>
        <p className="mt-1 text-[14px] text-ink-2">Page {r.page}, {Math.round(cell.b[0])} across, {Math.round(cell.b[1])} down</p>
        <p className={`text-[15px] font-semibold leading-snug ${bad ? "text-red" : r.sum.length ? "text-green" : "text-blue"}`}>{bad ? `Off by ${r.off.toLocaleString("en-US")}: the lines add to ${(num(cell.t) - r.off).toLocaleString("en-US")}` : r.sum.length ? `Adds up from ${r.sum.length} lines` : r.code ? `Goes to ${r.code}` : "Not needed in the template"}</p>
      </motion.div>
      <button onClick={toggle} aria-label={paused ? "Play tour" : "Pause tour"} className="absolute right-2.5 top-2.5 h-11 w-11 rounded-full flex items-center justify-center text-ink-2 hover:bg-paper hover:text-ink transition-colors">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>{paused ? <path d="M7 4v16l13-8z" /> : <path d="M6 4h4v16H6zM14 4h4v16h-4z" />}</svg>
      </button>
    </>
  );
}

const stretch = ([a, b]: number[]) => 1 + Math.max(-0.07, Math.min(0.09, (Math.abs(a) - Math.abs(b)) / 9000));

export default function LoupeHero({ delay }: { delay: number }) {
  const root = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const k = useSyncExternalStore(sub, scaleNow, () => 0.8);
  const R0 = Math.round(Math.max(88, Math.min(142, PW * k * 0.27))), ZOOM = R0 / 80, M = ZOOM / k;
  const start = look(TOUR[0]);
  const x = useMotionValue(start.x * k), y = useMotionValue(start.y * k);
  const spring = { stiffness: 130, damping: 19, mass: 0.7 };
  const lx = useSpring(x, spring), ly = useSpring(y, spring);
  const bx = useTransform(lx, (v) => v - R0), by = useTransform(ly, (v) => v - R0);
  const ix = useTransform(lx, (v) => R0 - v * M), iy = useTransform(ly, (v) => R0 - v * M);
  const ex = useTransform(lx, (v) => R0 - v * EDGE), ey = useTransform(ly, (v) => R0 - v * EDGE);
  // a soft bubble: it stretches a little in the direction it travels
  const vx = useSpring(useVelocity(lx), { stiffness: 200, damping: 26 }), vy = useSpring(useVelocity(ly), { stiffness: 200, damping: 26 });
  const scaleX = useTransform([vx, vy], stretch), scaleY = useTransform([vy, vx], stretch);
  // the tag hangs off the page edge and follows at its own pace
  const tagX = PW * k + 44, tagW = Math.max(216, Math.min(296, PW * k * 0.58));
  const tagY = useSpring(useTransform(ly, (v) => Math.max(34, Math.min(PH * k - 150, v))), { stiffness: 70, damping: 13 });
  const tagTop = useTransform(tagY, (v) => v - 26);
  const swing = useSpring(useTransform(useVelocity(tagY), [-900, 900], [9, -9]), { stiffness: 90, damping: 9 });

  const [now, setNow] = useState<{ r: R; c: number }>({ r: TOUR[0], c: 0 });
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(0);
  const seen = useInView(root, { amount: 0.3 });
  const step = useRef(0);

  const centres = useMemo(() => ROWS.flatMap((r) => r.cells.map((_, c) => ({ r, c, ...pos(r, c) }))), []);
  useEffect(() => {
    const track = () => {
      const cx = lx.get() / k, cy = ly.get() / k;
      let best = centres[0], d = Infinity;
      for (const p of centres) { const q = (p.x - cx) ** 2 * 0.25 + (p.y - cy) ** 2; if (q < d) { d = q; best = p; } }
      setNow((n) => (n.r === best.r && n.c === best.c ? n : { r: best.r, c: best.c }));
    };
    const a = lx.on("change", track), b = ly.on("change", track);
    return () => { a(); b(); };
  }, [lx, ly, centres, k]);
  // keep the glass on its figure when the window changes size
  useEffect(() => { const p = look(TOUR[step.current]); x.jump(p.x * k); y.jump(p.y * k); lx.jump(p.x * k); ly.jump(p.y * k); }, [k, x, y, lx, ly]);

  useEffect(() => {
    if (reduce || paused || !seen || held) return;
    const t = setInterval(() => {
      step.current = (step.current + 1) % TOUR.length;
      const p = look(TOUR[step.current]);
      animate(x, p.x * k, { duration: 1.1, ease: [0.65, 0, 0.35, 1] });
      animate(y, p.y * k, { duration: 1.1, ease: [0.65, 0, 0.35, 1] });
    }, 3200);
    return () => clearInterval(t);
  }, [reduce, paused, seen, held, x, y, k]);
  useEffect(() => {
    if (!held) return;
    const t = setTimeout(() => setHeld(0), 4500);
    return () => clearTimeout(t);
  }, [held]);

  function move(e: RPointer<HTMLDivElement>) {
    x.stop(); y.stop();
    x.set(e.nativeEvent.offsetX); y.set(e.nativeEvent.offsetY);
    setHeld(e.timeStamp);
  }

  const { scrollYProgress } = useScroll({ target: root, offset: ["start start", "end start"] });
  const lift = useTransform(scrollYProgress, [0, 1], [0, -70]), fan4 = useTransform(scrollYProgress, [0, 1], [4.5, 13]), fan5 = useTransform(scrollYProgress, [0, 1], [9, 25]);
  const { r, c } = now, bad = !!r.off && !c;
  const mark = bad ? "#B82E54" : r.sum.length ? "#17684C" : "#1F3C88";
  const marked = [r, ...(c ? [] : (r.sum.map((id) => byId.get(id)).filter(Boolean) as R[]))];
  // pausing freezes the glass where it is, even in the middle of a move
  const toggle = () => {
    if (!paused) for (const [goal, at] of [[x, lx], [y, ly]] as const) { goal.stop(); goal.set(at.get()); at.jump(at.get()); }
    setPaused(!paused);
  };

  return (
    <section id="top" ref={root} className="relative -mt-16 bg-paper text-ink overflow-hidden">
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(115deg,#f4faf2_0%,#f4faf2_38%,#e9f0fd_74%,#fdece4_100%)]" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[30%] bg-[linear-gradient(0deg,#f4faf2,transparent)]" />
      <Weave bands={5} lines={10} alpha={1} delay={delay} />
      <div className="relative mx-auto max-w-[2000px] min-h-[100svh] lg:min-h-[max(100svh,700px)] px-6 sm:px-12 lg:pl-[clamp(112px,9vw,190px)] lg:pr-[clamp(28px,4vw,90px)] pt-32 pb-20 lg:pt-[96px] lg:pb-[64px] grid lg:grid-cols-[minmax(0,1fr)_auto] gap-x-10 gap-y-12 content-center items-center">
        <div className="relative z-10">
          <span aria-hidden className="absolute -inset-x-[16%] -inset-y-[26%] -z-10 bg-[radial-gradient(closest-side,rgba(244,250,242,0.94)_45%,transparent)]" />
          <h1 className="font-note text-[clamp(46px,5.4vw,112px)] leading-[0.92]">
            {["Every number", "has a home."].map((t, i) => (
              <span key={t} className="block overflow-hidden pb-[0.1em] -mb-[0.1em]"><motion.span className="block" initial={{ y: "108%" }} animate={{ y: 0 }} transition={{ delay: delay + i * 0.12, duration: 1, ease: EASE }}>{t}</motion.span></span>
            ))}
          </h1>
          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: delay + 0.4, duration: 0.8, ease: EASE }} className="mt-7 max-w-[470px] text-[20px] leading-[1.5] text-ink-2 font-medium">
            Slide the glass over the accounts. Underneath is what Credence sees: every figure, where it sits, what it means, and whether it adds up.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: delay + 0.55, duration: 0.8, ease: EASE }} className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Magnetic><Link href="/app" className="note-btn bg-mustard text-ink">Open the app</Link></Magnetic>
            <a href="#game" className="text-[18px] font-semibold underline underline-offset-[6px] decoration-2 decoration-magenta py-3">Find the mistake yourself</a>
          </motion.div>
        </div>

        <motion.div style={{ y: lift }} initial={{ opacity: 0, x: 80 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: delay + 0.15, duration: 1.2, ease: EASE }} className="relative mx-auto lg:mx-0">
          <div className="relative" style={{ width: PW * k, height: PH * k }}>
            {([[5, fan5, 0.06], [4, fan4, 0.03]] as const).map(([p, rot, off]) => (
              <motion.div key={p} aria-hidden style={{ rotate: rot, x: PW * k * off, transformOrigin: "20% 100%" }} className="absolute inset-0 rounded-[6px] overflow-hidden bg-white shadow-[0_30px_60px_-30px_rgba(43,26,61,0.5)]">
                <Image src={`/ledger/p${p}.png`} alt="" width={1310} height={1853} className="block w-full h-full opacity-60" sizes="560px" draggable={false} />
              </motion.div>
            ))}
            <div className="absolute inset-0 rounded-[6px] overflow-hidden bg-white shadow-[0_50px_90px_-36px_rgba(43,26,61,0.6),0_0_0_1px_rgba(43,26,61,0.06)]">
              <Image src="/ledger/p3.png" alt="" width={1310} height={1853} priority className="block w-full h-full" sizes="620px" draggable={false} />
              {/* a highlighter on the real page marks the figure, and for a total, the lines behind it */}
              <svg viewBox={`0 0 ${PW} ${PH}`} className="absolute inset-0 w-full h-full mix-blend-multiply" aria-hidden>
                {marked.map((m, i) => { const b = m.cells[i ? 0 : c].b; return <motion.rect key={`${r.id}-${c}-${m.id}`} x={b[0] - 4} y={b[1] - 2} height={b[3] - b[1] + 4} rx="3" fill={mark} fillOpacity={i ? 0.14 : 0.24} initial={{ width: 0 }} animate={{ width: b[2] - b[0] + 8 }} transition={{ duration: 0.35, delay: i * 0.04 }} />; })}
              </svg>
            </div>

            <svg aria-hidden className="hidden lg:block absolute left-0 top-0 overflow-visible pointer-events-none" width="1" height="1">
              {[0, 1, 2, 3].map((i) => <Strand key={`${i}-${k}`} i={i} ax={lx} ay={ly} bx={tagX + 17} by={tagY} r={R0 - 1} />)}
            </svg>

            <motion.div aria-hidden data-loupe style={{ x: bx, y: by, scaleX, scaleY, width: R0 * 2, height: R0 * 2 }} className="absolute left-0 top-0 pointer-events-none">
              {/* the shadow and the light the bubble throws on the paper */}
              <span className="absolute inset-[4%] translate-x-[9%] translate-y-[16%] rounded-full bg-[radial-gradient(circle,rgba(43,26,61,0.34)_40%,rgba(43,26,61,0.12)_62%,transparent_72%)]" />
              <span className="absolute inset-[18%] translate-x-[30%] translate-y-[46%] rounded-full bg-[radial-gradient(circle,rgba(255,236,170,0.75),transparent_62%)]" />
              <span className="absolute inset-0 rounded-full overflow-hidden bg-white">
                {/* bent page at the rim, what Credence sees in the middle */}
                <motion.span style={{ x: ex, y: ey, width: PW * k * EDGE, height: PH * k * EDGE }} className="absolute left-0 top-0 block"><Image src="/ledger/p3.png" alt="" width={1310} height={1853} className="block w-full h-full" sizes="620px" draggable={false} /></motion.span>
                <span className="absolute inset-0 [mask-image:radial-gradient(circle_closest-side,black_86%,transparent_97%)]"><motion.span style={{ x: ix, y: iy }} className="absolute left-0 top-0 block"><XRay zoom={ZOOM} /></motion.span></span>
                <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_closest-side,transparent_76%,rgba(31,60,136,0.10)_84%,rgba(31,60,136,0.26)_92%,rgba(184,46,84,0.34)_96%,rgba(217,152,43,0.55)_100%)]" />
                <span className="absolute left-[9%] top-[5%] h-[13%] w-[44%] -rotate-[30deg] rounded-[50%] bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(255,255,255,0))]" />
              </span>
              <span className="absolute inset-0 rounded-full shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.95),inset_0_-10px_26px_rgba(255,255,255,0.85),0_0_0_1px_rgba(43,26,61,0.2),0_18px_40px_-14px_rgba(43,26,61,0.5)]" />
            </motion.div>

            <div className="absolute inset-0 cursor-none touch-pan-y" onPointerMove={move} onPointerDown={move} data-testid="paper" />

            <motion.div style={{ left: tagX, y: tagTop, width: tagW, rotate: swing, transformOrigin: "17px 26px" }} className="hidden lg:block absolute top-0 z-10 rounded-[16px] bg-white/95 shadow-[0_26px_50px_-24px_rgba(43,26,61,0.6),0_0_0_1px_rgba(43,26,61,0.07)] pl-10 pr-4 py-4" role="group" aria-label="What the glass is showing">
              <span aria-hidden className="absolute left-[10px] top-[19px] h-[14px] w-[14px] rounded-full bg-[#e9f0fd] border-[3px] transition-colors" style={{ borderColor: mark }} />
              <Readout r={r} c={c} paused={paused} toggle={toggle} />
            </motion.div>
          </div>
          <div aria-hidden className="hidden lg:block h-0" style={{ width: tagX + tagW }} />
        </motion.div>

        <div className="lg:hidden relative z-10 rounded-[18px] bg-white/95 shadow-[0_24px_50px_-28px_rgba(43,26,61,0.6)] p-5" role="group" aria-label="What the glass is showing"><Readout r={r} c={c} paused={paused} toggle={toggle} /></div>
      </div>
    </section>
  );
}
