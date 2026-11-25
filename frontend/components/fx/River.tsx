"use client";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as RPointer } from "react";
import { fmtM } from "@/lib/evidence";
import type { stress } from "@/lib/stress";

type Flow = ReturnType<typeof stress>;
const NODES = [
  { k: "cogs", name: "Cost of sales", code: "IS.COGS", color: "#6a4590" },
  { k: "opex", name: "Other running costs", code: null, color: "#1f3c88" },
  { k: "fc", name: "Finance cost", code: "IS.FINANCE_COST", color: "#b82e54" },
  { k: "tax", name: "Tax", code: "IS.TAX", color: "#e9b44c" },
  { k: "profit", name: "Net profit", code: "IS.NET_PROFIT", color: "#17684c" },
] as const;

/** Values that chase their target like a spring, so the river swells and shrinks instead of jumping. */
function useSprings(target: number[]) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(target);
  const s = useRef({ x: target.slice(), vel: target.map(() => 0) });
  const key = target.map((t) => Math.round(t)).join();
  useEffect(() => {
    const goal = key.split(",").map(Number);
    let raf = 0, last = performance.now();
    const tick = (t: number) => {
      const dt = reduce ? 1 : Math.min(0.032, (t - last) / 1000);
      last = t;
      let moving = false;
      const st = s.current;
      goal.forEach((g, i) => {
        if (reduce) { st.x[i] = g; st.vel[i] = 0; return; }
        const size = Math.max(1, Math.abs(g), Math.abs(st.x[i]));
        st.vel[i] += (-170 * (st.x[i] - g) - 17 * st.vel[i]) * dt;
        st.x[i] += st.vel[i] * dt;
        if (Math.abs(st.x[i] - g) > size * 0.0005 || Math.abs(st.vel[i]) > size * 0.002) moving = true; else { st.x[i] = g; st.vel[i] = 0; }
      });
      setV(st.x.slice());
      if (moving) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [key, reduce]);
  return v;
}

const VW = 752, VH = 456, TOP = 26, X0 = 118, X1 = 506, BAR = 18, GAP = 13;

/** Stack the streams on both banks and keep their labels from colliding. */
function layout(heights: number[]) {
  const out: { th: number; a: number; b: number; label: number; d: string; veins: string }[] = [];
  let ly = TOP, ry = TOP - 8, last = -99;
  for (const th of heights) {
    const a = ly, b = ry, bh = Math.max(th, 3), mid = (X0 + X1) / 2;
    last = Math.max(b + bh / 2, last + 46);
    const n = Math.floor(th / 7), veins = Array.from({ length: n }, (_, i) => { const f = (i + 1) / (n + 1), p = a + th * f, q = b + bh * f, s = Math.sin(i * 0.9) * 5; return `M${X0 + BAR} ${p}C${mid - 40} ${p + s} ${mid + 40} ${q - s} ${X1} ${q}`; }).join("");
    out.push({ th, a, b, label: last, veins, d: `M${X0 + BAR} ${a}C${mid} ${a} ${mid} ${b} ${X1} ${b}V${b + bh}C${mid} ${b + bh} ${mid} ${a + th} ${X0 + BAR} ${a + th}Z` });
    ly += th;
    ry += bh + GAP;
  }
  return out;
}

export default function River({ flow, base, onPick, onDragSales, sales = 0 }: {
  flow: Flow; base: number; onPick?: (code: string) => void; onDragSales?: (s: number) => void; sales?: number;
}) {
  const [hot, setHot] = useState<string | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ y: number; s: number } | null>(null);
  const [rev, oi, cogs, opex, fc, tax, profit, loss] = useSprings([flow.rev, flow.oi, flow.cogs, Math.max(0, flow.opex), flow.fc, Math.max(0, flow.tax), Math.max(0, flow.np), Math.max(0, -flow.np)]);
  const scale = 262 / Math.max(base, 1);
  const h = (v: number) => Math.max(0, v * scale);
  const vals = { cogs, opex, fc, tax, profit } as Record<string, number>;
  const shown = NODES.filter((n) => vals[n.k] * scale > 0.4);

  const bands = layout(shown.map((n) => h(vals[n.k]))).map((g, i) => ({ ...shown[i], ...g }));
  const inH = h(rev), oiH = h(oi), lossH = h(loss);
  const handleY = TOP + inH;

  function down(e: RPointer<SVGGElement>) {
    if (!onDragSales) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, s: sales };
  }
  function move(e: RPointer<SVGGElement>) {
    if (!drag.current || !svg.current || !onDragSales) return;
    const perPx = VH / svg.current.getBoundingClientRect().height;
    const ds = ((e.clientY - drag.current.y) * perPx) / scale / base;
    onDragSales(Math.max(-0.4, Math.min(0.2, Math.round((drag.current.s + ds) * 1000) / 1000)));
  }
  const key = (e: KeyboardEvent, fn: () => void) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } };

  return (
    <div className="overflow-hidden sm:overflow-visible">
    <svg ref={svg} viewBox={`0 0 ${VW} ${VH}`} className="w-[142%] max-w-none sm:w-full h-auto block select-none overflow-visible" role="group" aria-label={`Where the money goes: net revenue ${fmtM(flow.rev)}, net result ${fmtM(flow.np)}`}>
      <defs>{bands.map((b) => <linearGradient key={b.k} id={`rv-${b.k}`} x1="0" x2="1"><stop offset="0" stopColor={b.color} stopOpacity="0.28" /><stop offset="0.55" stopColor={b.color} stopOpacity="0.62" /><stop offset="1" stopColor={b.color} stopOpacity="0.92" /></linearGradient>)}
        <pattern id="rv-loss" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#fbe4ea" /><rect width="4" height="8" fill="#b82e54" /></pattern></defs>
      {bands.map((b) => {
        const go = () => b.code && onPick?.(b.code);
        const on = hot === b.k, dim = hot && !on;
        return (
          <g key={b.k} role={b.code && onPick ? "button" : undefined} tabIndex={b.code && onPick ? 0 : undefined} onClick={go} onKeyDown={(e) => key(e, go)}
            onPointerEnter={() => setHot(b.k)} onPointerLeave={() => setHot(null)} onFocus={() => setHot(b.k)} onBlur={() => setHot(null)} style={{ cursor: b.code && onPick ? "pointer" : "default", opacity: dim ? 0.22 : 1, transition: "opacity 200ms", outline: "none" }}>
            <path d={b.d} fill="none" stroke="transparent" strokeWidth="12" pointerEvents="stroke" />
            <rect x={X1 + BAR} y={b.label - 22} width={VW - X1 - BAR} height={44} fill="transparent" />
            <path d={b.d} fill={`url(#rv-${b.k})`} stroke={on ? b.color : "none"} strokeWidth="2" />
            <path d={b.veins} fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1" pointerEvents="none" />
            <rect x={X1} y={b.b} width={BAR} height={Math.max(b.th, 3)} rx="3" fill={b.color} />
            {Math.abs(b.label - b.b - Math.max(b.th, 3) / 2) > 3 && <path d={`M${X1 + BAR} ${b.b + Math.max(b.th, 3) / 2}L${X1 + BAR + 16} ${b.label}`} stroke={b.color} strokeWidth="1.4" fill="none" />}
            <text x={X1 + BAR + 22} y={b.label - 4} fontSize="17" fontWeight="700" fill="currentColor">{b.name}</text>
            <text x={X1 + BAR + 22} y={b.label + 16} fontSize="16" fill="currentColor" fontFamily="var(--font-mono)">{fmtM(vals[b.k])}<tspan opacity="0.8">  {flow.rev ? ((vals[b.k] / rev) * 100).toFixed(1) : 0}%</tspan></text>
          </g>
        );
      })}
      <rect x={X0} y={TOP} width={BAR} height={inH} rx="3" fill="#2b1a3d" />
      {oiH > 0.4 && <rect x={X0} y={TOP + inH} width={BAR} height={Math.max(oiH, 2)} fill="#8fd0b4" />}
      {lossH > 0.4 && <><rect x={X0} y={TOP + inH + oiH} width={BAR} height={lossH} fill="url(#rv-loss)" /><text className="max-sm:hidden" x={X0 - 10} y={handleY + 52} textAnchor="end" fontSize="16" fontWeight="700" fill="#a8274a">Loss</text><text className="max-sm:hidden" x={X0 - 10} y={handleY + 72} textAnchor="end" fontSize="15" fill="#a8274a" fontFamily="var(--font-mono)">{fmtM(-loss)}</text></>}
      <text className="max-sm:hidden" x={X0 - 12} y={TOP + 14} textAnchor="end" fontSize="17" fontWeight="700" fill="currentColor">Net revenue</text>
      <text className="max-sm:hidden" x={X0 - 12} y={TOP + 35} textAnchor="end" fontSize="15" fill="currentColor" fontFamily="var(--font-mono)">{fmtM(rev)}</text>
      {onDragSales && (
        <g onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} style={{ cursor: "ns-resize", touchAction: "none" }} data-testid="sales-handle" aria-hidden>
          <rect x={X0 - 60} y={handleY - 22} width={140} height={44} fill="transparent" />
          <line x1={X0 - 8} x2={X0 + BAR + 8} y1={handleY} y2={handleY} stroke="#e9b44c" strokeWidth="5" strokeLinecap="round" />
          <circle cx={X0 - 24} cy={handleY} r="17" fill="#e9b44c" stroke="#fff8e7" strokeWidth="3" />
          <path d={`M${X0 - 30} ${handleY - 3}l6 -6l6 6M${X0 - 30} ${handleY + 3}l6 6l6 -6`} fill="none" stroke="#2b1a3d" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
    </svg>
    <ul className="sm:hidden grid grid-cols-2 gap-x-4 gap-y-2 text-[15px]">
      {[{ k: "rev", name: "Net revenue", color: "#2b1a3d", v: flow.rev }, ...shown.map((n) => ({ k: n.k as string, name: n.name as string, color: n.color as string, v: vals[n.k] })), ...(flow.np < 0 ? [{ k: "loss", name: "Loss", color: "#b82e54", v: flow.np }] : [])].map((n) => (
        <li key={n.k} className="flex gap-2"><span className="mt-1.5 h-3 w-3 rounded-[3px] shrink-0" style={{ background: n.color }} /><span>{n.name}<span className="num block">{fmtM(n.v)}</span></span></li>
      ))}
    </ul>
    </div>
  );
}
