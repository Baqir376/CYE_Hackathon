"use client";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { api, Case } from "@/lib/api";
import { Box, Evidence } from "@/lib/evidence";
import { cx } from "./ui";

const HI = 3; // focus view renders pages at 3x
const LENS = 110;
export type Hot = Box & { doc_id: string; page: number };
export const hotspots = (ev: Evidence | null): Hot[] =>
  ev ? ev.targets.flatMap((t) => t.boxes.filter((b) => b.kind !== "label").map((b) => ({ ...b, doc_id: t.doc_id, page: t.page }))) : [];
type Cam = { s: number; x: number; y: number };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Full-screen focus view: a page camera that flies to each highlight, with page film strip, spotlight, loupe and minimap. */
export default function DocInspector({ c, ev, docId, page, hot, origin, onClose }: {
  c: Case; ev: Evidence | null; docId: string; page: number; hot: number; origin: { x: number; y: number }; onClose: () => void;
}) {
  const hots = useMemo(() => hotspots(ev), [ev]);
  const [view, setView] = useState({ doc: docId, page, dir: 1 });
  const [cur, setCur] = useState(hot);
  const d = c.documents.find((x) => x.id === view.doc) || c.documents[0];
  const pages = d?.pages || 1;
  const [size, setSize] = useState({ w: 595, h: 842 });
  const [box, setBox] = useState({ w: 1000, h: 700 });
  const [cam, setCam] = useState<Cam>({ s: 0.8, x: 0, y: 0 });
  const goal = useRef<Cam>({ s: 0.8, x: 0, y: 0 });
  const snap = useRef(false), shown = useRef(false);
  const [spot, setSpot] = useState(true);
  const [loupe, setLoupe] = useState(false);
  const [ptr, setPtr] = useState<{ x: number; y: number } | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const src = `${api.pageUrl(c.id, view.doc, view.page)}?scale=${HI}`;
  const onPage = hots.map((h, i) => ({ h, i })).filter(({ h }) => h.doc_id === view.doc && h.page === view.page);
  const stmt = d?.statement_pages?.find((s) => s.page === view.page);

  // geometry
  const fitCam = useCallback((): Cam => {
    const s = Math.min((box.w - 64) / size.w, (box.h - 64) / size.h);
    return { s, x: (box.w - size.w * s) / 2, y: (box.h - size.h * s) / 2 };
  }, [box, size]);
  const focusCam = useCallback((b: number[]): Cam => {
    const f = fitCam().s, bw = b[2] - b[0] + 60, bh = b[3] - b[1] + 40;
    const s = clamp(Math.min((box.w * 0.34) / bw, (box.h * 0.2) / bh), f * 1.5, Math.max(f * 1.5, 3));
    return { s, x: box.w / 2 - ((b[0] + b[2]) / 2) * s, y: box.h * 0.46 - ((b[1] + b[3]) / 2) * s };
  }, [box, fitCam]);
  const fly = (to: Cam) => { goal.current = to; };

  // smooth camera: exponential approach, every frame
  useEffect(() => {
    let raf = 0, last = performance.now();
    const tick = (n: number) => {
      const k = 1 - Math.exp(-((n - last) / 1000) * 9); last = n;
      setCam((c0) => {
        const g = goal.current;
        if (snap.current) { snap.current = false; return { ...g }; }
        if (Math.abs(g.s - c0.s) < 1e-4 && Math.abs(g.x - c0.x) < 0.1 && Math.abs(g.y - c0.y) < 0.1) return c0;
        return { s: c0.s + (g.s - c0.s) * k, x: c0.x + (g.x - c0.x) * k, y: c0.y + (g.y - c0.y) * k };
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const el = stage.current; if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  // when a page is ready: start from the whole page, then dive into the highlight
  useEffect(() => {
    if (loaded !== src) return;
    goal.current = fitCam(); if (!shown.current) { shown.current = true; snap.current = true; }
    const h = hots[cur];
    if (h && h.doc_id === view.doc && h.page === view.page) {
      const t = setTimeout(() => fly(focusCam(h.bbox)), 380);
      return () => clearTimeout(t);
    }
  }, [loaded, src, fitCam, focusCam, hots, cur, view.doc, view.page]);

  const goPage = useCallback((p: number, doc = view.doc) => {
    if (p < 1 || p > (c.documents.find((x) => x.id === doc)?.pages || 1) || (p === view.page && doc === view.doc)) return;
    setView((v) => ({ doc, page: p, dir: doc !== v.doc ? 1 : p > v.page ? 1 : -1 }));
    setLoaded(null);
    const firstHere = hots.findIndex((h) => h.doc_id === doc && h.page === p);
    if (firstHere >= 0) setCur(firstHere);
  }, [view, hots, c.documents]);
  const goHot = useCallback((i: number) => {
    const h = hots[(i + hots.length) % hots.length]; if (!h) return;
    const j = hots.indexOf(h); setCur(j);
    if (h.doc_id !== view.doc || h.page !== view.page) goPage(h.page, h.doc_id);
    else fly(focusCam(h.bbox));
  }, [hots, view, goPage, focusCam]);
  const zoomAt = useCallback((f: number, mx = box.w / 2, my = box.h / 2) => {
    const g = goal.current, s = clamp(g.s * f, fitCam().s * 0.5, 9), px = (mx - g.x) / g.s, py = (my - g.y) / g.s;
    fly({ s, x: mx - px * s, y: my - py * s });
  }, [box, fitCam]);

  // keyboard
  useEffect(() => {
    closeBtn.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" || e.key === "PageDown") goPage(view.page + 1);
      else if (e.key === "ArrowLeft" || e.key === "PageUp") goPage(view.page - 1);
      else if (e.key === "ArrowDown" || e.key === "j") { e.preventDefault(); goHot(cur + 1); }
      else if (e.key === "ArrowUp" || e.key === "k") { e.preventDefault(); goHot(cur - 1); }
      else if (e.key === "+" || e.key === "=") zoomAt(1.4);
      else if (e.key === "-") zoomAt(1 / 1.4);
      else if (e.key === "0") fly(fitCam());
      else if (e.key === "f" && hots[cur]) goHot(cur);
      else if (e.key === "s") setSpot((v) => !v);
      else if (e.key === "l") setLoupe((v) => !v);
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose, goPage, goHot, zoomAt, fitCam, cur, view.page, hots]);

  // wheel zoom at the cursor (needs a non-passive listener)
  useEffect(() => {
    const el = stage.current; if (!el) return;
    const w = (e: WheelEvent) => { e.preventDefault(); const r = el.getBoundingClientRect(); zoomAt(Math.exp(-e.deltaY * 0.0016), e.clientX - r.left, e.clientY - r.top); };
    el.addEventListener("wheel", w, { passive: false });
    return () => el.removeEventListener("wheel", w);
  }, [zoomAt]);

  useEffect(() => { strip.current?.querySelector<HTMLElement>(`[data-p="${view.page}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [view.page]);

  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const rel = (e: { clientX: number; clientY: number }) => { const r = stage.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const active = hots[cur] && hots[cur].doc_id === view.doc && hots[cur].page === view.page ? hots[cur] : null;
  const pct = Math.round(cam.s * 100);

  const mmW = 150, mmK = mmW / size.w;
  return createPortal(
    <motion.div role="dialog" aria-modal="true" aria-label={`Focus view: ${ev?.title || "source document"}`}
      className="fixed inset-0 z-[90] flex flex-col bg-[#150d1f] text-white"
      initial={{ clipPath: `circle(0px at ${origin.x}px ${origin.y}px)` }}
      animate={{ clipPath: `circle(150% at ${origin.x}px ${origin.y}px)`, transition: { duration: 0.65, ease: [0.7, 0, 0.2, 1] } }}
      exit={{ clipPath: `circle(0px at ${origin.x}px ${origin.y}px)`, transition: { duration: 0.45, ease: [0.6, 0, 0.4, 1] } }}>
      {/* top bar */}
      <div className="flex items-center gap-4 px-5 h-16 border-b border-white/10 shrink-0">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#f4d35e] text-[#2b1a3d]" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
        </span>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#f4d35e]">Focus view</p>
          <p className="font-serif text-[18px] leading-tight truncate">{ev?.title || d?.filename}</p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-[13px] text-white/60">
          <span className="hidden md:inline">{d?.filename} · page {view.page} of {pages}{stmt ? ` · ${stmt.title}` : ""}</span>
          <button ref={closeBtn} onClick={onClose} aria-label="Close focus view" className="ml-3 h-10 rounded-full border border-white/20 px-4 text-white hover:bg-white/10">Close <kbd className="ml-1 text-white/50">Esc</kbd></button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* film strip */}
        <nav aria-label="Pages" ref={strip} className="hidden md:flex w-[132px] shrink-0 flex-col gap-3 overflow-y-auto scroll-thin border-r border-white/10 p-3">
          {c.documents.length > 1 && c.documents.map((x) => (
            <button key={x.id} onClick={() => goPage(1, x.id)} className={cx("rounded-md px-2 py-1 text-[11px] text-left truncate", x.id === view.doc ? "bg-white text-[#2b1a3d]" : "bg-white/10")}>{x.filename}</button>
          ))}
          {Array.from({ length: pages }, (_, k) => k + 1).map((p) => {
            const n = hots.filter((h) => h.doc_id === view.doc && h.page === p).length;
            const st = d?.statement_pages?.find((s) => s.page === p);
            return (
              <button key={p} data-p={p} onClick={() => goPage(p)} aria-label={`Page ${p}${n ? `, ${n} highlight${n > 1 ? "s" : ""}` : ""}`} aria-current={p === view.page ? "page" : undefined}
                className={cx("group relative shrink-0 rounded-[8px] p-1 transition", p === view.page ? "bg-[#f4d35e]" : "bg-white/5 hover:bg-white/15")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img loading="lazy" src={`${api.pageUrl(c.id, view.doc, p)}?scale=0.3`} alt="" className="block w-full rounded-[5px] bg-white" />
                <span className={cx("mt-1 flex items-center justify-between px-0.5 text-[11px]", p === view.page ? "text-[#2b1a3d]" : "text-white/70")}>
                  <span className="num">{p}</span>{st && <span className="truncate max-w-[70px]">{st.statement}</span>}
                </span>
                {n > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#b82e54] px-1 text-[11px] font-semibold text-white shadow-[0_0_0_3px_#150d1f]">{n}</span>}
              </button>
            );
          })}
        </nav>

        {/* stage */}
        <div ref={stage} className={cx("relative flex-1 overflow-hidden select-none touch-none", loupe ? "cursor-none" : "cursor-grab active:cursor-grabbing")}
          style={{ background: "radial-gradient(120% 90% at 50% 40%, #2a1c3b 0%, #150d1f 70%)" }}
          onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); drag.current = { ...rel(e), moved: false }; }}
          onPointerMove={(e) => {
            const p = rel(e); setPtr(p);
            const g = drag.current; if (!g) return;
            const dx = p.x - g.x, dy = p.y - g.y; if (Math.abs(dx) + Math.abs(dy) > 3) g.moved = true;
            g.x = p.x; g.y = p.y; goal.current = { ...goal.current, x: goal.current.x + dx, y: goal.current.y + dy }; setCam((c0) => ({ ...c0, x: c0.x + dx, y: c0.y + dy }));
          }}
          onPointerUp={() => { drag.current = null; }} onPointerLeave={() => setPtr(null)}
          onDoubleClick={(e) => { const p = rel(e); zoomAt(2, p.x, p.y); }}>
          <div className="absolute left-0 top-0 origin-top-left" style={{ width: size.w, height: size.h, transform: `translate(${cam.x}px,${cam.y}px) scale(${cam.s})` }}>
            <AnimatePresence initial={false} custom={view.dir} mode="popLayout">
              <motion.div key={`${view.doc}:${view.page}`} custom={view.dir} className="absolute inset-0 bg-white shadow-[0_40px_120px_-20px_rgba(0,0,0,0.8)]"
                style={{ transformPerspective: 2400, transformOrigin: view.dir > 0 ? "0% 50%" : "100% 50%" }}
                variants={{ in: (d: number) => ({ rotateY: d * -70, opacity: 0, x: d * 80 }), on: { rotateY: 0, opacity: 1, x: 0, transition: { type: "spring", stiffness: 120, damping: 20 } }, out: (d: number) => ({ rotateY: d * 60, opacity: 0, x: d * -120, transition: { duration: 0.35 } }) }}
                initial="in" animate="on" exit="out">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Focused view of page ${view.page}`} draggable={false} className="block w-full h-full"
                  onLoad={(e) => { setSize({ w: e.currentTarget.naturalWidth / HI, h: e.currentTarget.naturalHeight / HI }); setLoaded(src); }} />
                <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden>
                  <defs>
                    <mask id="spot">
                      <rect width={size.w} height={size.h} fill="white" />
                      {onPage.map(({ h, i }) => <rect key={i} x={h.bbox[0] - 8} y={h.bbox[1] - 6} width={h.bbox[2] - h.bbox[0] + 16} height={h.bbox[3] - h.bbox[1] + 12} rx="5" fill="black" />)}
                    </mask>
                  </defs>
                  <rect width={size.w} height={size.h} fill="#1b1028" mask="url(#spot)" style={{ opacity: spot && onPage.length ? 0.38 : 0, transition: "opacity .5s" }} />
                  {onPage.map(({ h, i }) => {
                    const on = i === cur, flag = h.kind === "flag";
                    return (
                      <g key={i} className="cursor-pointer" onPointerDown={(e) => e.stopPropagation()} onClick={() => goHot(i)}>
                        <rect x={h.bbox[0] - 3} y={h.bbox[1] - 2.5} width={h.bbox[2] - h.bbox[0] + 6} height={h.bbox[3] - h.bbox[1] + 5} rx="2.5"
                          fill={flag ? "rgba(184,46,84,.18)" : "rgba(244,211,94,.42)"} stroke={flag ? "#b82e54" : "#e9b44c"} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                        {on && <rect x={h.bbox[0] - 7} y={h.bbox[1] - 6} width={h.bbox[2] - h.bbox[0] + 14} height={h.bbox[3] - h.bbox[1] + 12} rx="5" fill="none"
                          stroke={flag ? "#ff5d82" : "#f4d35e"} strokeWidth="2.5" strokeDasharray="7 5" vectorEffect="non-scaling-stroke" className="ants" />}
                      </g>
                    );
                  })}
                </svg>
              </motion.div>
            </AnimatePresence>
          </div>

          {loaded !== src && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><span className="rounded-full bg-white/10 px-4 py-2 text-[13px] text-white/80 backdrop-blur">Rendering page {view.page} in high resolution…</span></div>}

          {/* callout pinned to the active highlight */}
          <AnimatePresence>
            {active && loaded === src && (
              <motion.div key={`${cur}:${view.page}`} initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, transition: { duration: 0.08 } }} transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.25 }}
                className="pointer-events-none absolute rounded-[14px] bg-white px-4 py-2.5 text-[#2b1a3d] shadow-[0_20px_50px_-10px_rgba(0,0,0,0.7)]"
                style={{ left: clamp(active.bbox[2] * cam.s + cam.x + 18, 12, box.w - 260), top: clamp(active.bbox[1] * cam.s + cam.y - 66, 12, box.h - 90) }}>
                <p className={cx("text-[11px] uppercase tracking-wider font-semibold", active.kind === "flag" ? "text-[#b82e54]" : "text-[#17684c]")}>{active.kind === "flag" ? "Flagged" : "Source figure"} · p.{active.page}</p>
                <p className="num text-[22px] font-semibold leading-tight">{active.text || "—"}</p>
                {active.label && <p className="text-[12px] text-[#4e4159] max-w-[220px] truncate">{active.label}</p>}
              </motion.div>
            )}
          </AnimatePresence>

          {/* loupe */}
          {loupe && ptr && loaded === src && (
            <span aria-hidden className="pointer-events-none absolute rounded-full border-[5px] border-[#f4d35e] shadow-[0_30px_60px_-10px_rgba(0,0,0,0.8)]"
              style={{ width: LENS * 2, height: LENS * 2, left: ptr.x - LENS, top: ptr.y - LENS, backgroundColor: "#fff", backgroundRepeat: "no-repeat", backgroundImage: `url(${src})`,
                backgroundSize: `${size.w * cam.s * 2.2}px ${size.h * cam.s * 2.2}px`, backgroundPosition: `${LENS - 5 - (ptr.x - cam.x) * 2.2}px ${LENS - 5 - (ptr.y - cam.y) * 2.2}px` }} />
          )}

          {/* minimap */}
          <div className="absolute right-4 top-4 hidden sm:block rounded-[10px] bg-white/10 p-1.5 backdrop-blur" style={{ width: mmW + 12 }}
            onPointerDown={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(), px = (e.clientX - r.left - 6) / mmK, py = (e.clientY - r.top - 6) / mmK, g = goal.current; fly({ s: g.s, x: box.w / 2 - px * g.s, y: box.h / 2 - py * g.s }); }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${api.pageUrl(c.id, view.doc, view.page)}?scale=0.3`} alt="" className="block rounded-[4px] bg-white" style={{ width: mmW }} draggable={false} />
            <span className="absolute rounded-[3px] border-2 border-[#f4d35e] bg-[#f4d35e]/15 pointer-events-none"
              style={{ left: 6 + clamp(-cam.x / cam.s, 0, size.w) * mmK, top: 6 + clamp(-cam.y / cam.s, 0, size.h) * mmK,
                width: clamp(box.w / cam.s, 0, size.w - clamp(-cam.x / cam.s, 0, size.w)) * mmK, height: clamp(box.h / cam.s, 0, size.h - clamp(-cam.y / cam.s, 0, size.h)) * mmK }} />
            {onPage.map(({ h, i }) => <span key={i} className="absolute h-1.5 w-1.5 rounded-full bg-[#b82e54] pointer-events-none" style={{ left: 6 + h.bbox[2] * mmK - 3, top: 6 + h.bbox[1] * mmK }} />)}
          </div>

          {/* page arrows */}
          <button aria-label="Previous page" disabled={view.page <= 1} onClick={() => goPage(view.page - 1)} onPointerDown={(e) => e.stopPropagation()}
            className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/10 text-xl backdrop-blur hover:bg-white/20 disabled:opacity-25">‹</button>
          <button aria-label="Next page" disabled={view.page >= pages} onClick={() => goPage(view.page + 1)} onPointerDown={(e) => e.stopPropagation()}
            className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/10 text-xl backdrop-blur hover:bg-white/20 disabled:opacity-25">›</button>

          {/* control dock */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-white/95 p-1.5 text-[#2b1a3d] shadow-[0_20px_60px_-10px_rgba(0,0,0,0.7)]" onPointerDown={(e) => e.stopPropagation()}>
            <Dock label="Zoom out" onClick={() => zoomAt(1 / 1.4)}>−</Dock>
            <span className="num w-14 text-center text-[13px]" aria-live="polite">{pct}%</span>
            <Dock label="Zoom in" onClick={() => zoomAt(1.4)}>+</Dock>
            <span className="mx-1 h-6 w-px bg-[#2b1a3d]/15" />
            <Dock label="Fit page" onClick={() => fly(fitCam())} wide>Fit</Dock>
            <Dock label="Focus highlight" onClick={() => goHot(cur)} wide disabled={!hots.length}>Focus</Dock>
            <Dock label="Spotlight" onClick={() => setSpot((v) => !v)} wide on={spot}>Spotlight</Dock>
            <Dock label="Magnifier" onClick={() => setLoupe((v) => !v)} wide on={loupe}>Loupe</Dock>
          </div>
        </div>

        {/* info rail */}
        {ev && (
          <aside className="hidden lg:flex w-[330px] shrink-0 flex-col border-l border-white/10 overflow-y-auto scroll-thin">
            <div className="p-5 border-b border-white/10">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">Evidence</p>
              <h3 className="font-serif text-[22px] leading-snug mt-1">{ev.title}</h3>
              {ev.subtitle && <p className="text-[13px] text-white/60 mt-1">{ev.subtitle}</p>}
              {ev.formula && <p className="mt-3 rounded-[10px] bg-white/10 px-3 py-2 text-[12px]"><span className="text-white/50">Formula </span><span className="num">{ev.formula}</span></p>}
              {ev.lines && ev.lines.length > 0 && (
                <dl className="mt-3 text-[13px]">
                  {ev.lines.map((l, i) => <div key={i} className="flex justify-between gap-3 border-t border-white/10 py-1.5"><dt className="text-white/70">{l.label}</dt><dd className="num">{l.value}</dd></div>)}
                </dl>
              )}
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">Highlights · {hots.length}</p>
                <div className="flex gap-1">
                  <button aria-label="Previous highlight" onClick={() => goHot(cur - 1)} className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20">↑</button>
                  <button aria-label="Next highlight" onClick={() => goHot(cur + 1)} className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20">↓</button>
                </div>
              </div>
              <ol className="mt-3 space-y-1.5">
                {hots.map((h, i) => (
                  <li key={i}>
                    <button onClick={() => goHot(i)} className={cx("relative w-full overflow-hidden rounded-[12px] px-3 py-2 text-left transition", i === cur ? "bg-[#f4d35e] text-[#2b1a3d]" : "bg-white/5 hover:bg-white/10")}>
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="num text-[15px] font-semibold">{h.text || "—"}</span>
                        <span className={cx("text-[11px]", i === cur ? "text-[#2b1a3d]/70" : "text-white/50")}>p.{h.page}{h.kind === "flag" ? " · flag" : ""}</span>
                      </span>
                      {h.label && <span className={cx("block truncate text-[12px]", i === cur ? "text-[#2b1a3d]/75" : "text-white/55")}>{h.label}</span>}
                    </button>
                  </li>
                ))}
              </ol>
              <p className="mt-6 text-[12px] leading-relaxed text-white/45">
                <kbd>←</kbd> <kbd>→</kbd> pages · <kbd>↑</kbd> <kbd>↓</kbd> highlights · scroll or <kbd>+</kbd> <kbd>−</kbd> to zoom · drag to pan · double-click to zoom in · <kbd>0</kbd> fit · <kbd>S</kbd> spotlight · <kbd>L</kbd> loupe
              </p>
            </div>
          </aside>
        )}
      </div>
    </motion.div>,
    document.body,
  );
}

function Dock({ label, onClick, children, wide, on, disabled }: { label: string; onClick: () => void; children: React.ReactNode; wide?: boolean; on?: boolean; disabled?: boolean }) {
  return (
    <button aria-label={label} aria-pressed={on} onClick={onClick} disabled={disabled}
      className={cx("h-9 rounded-full text-[14px] font-semibold transition disabled:opacity-30", wide ? "px-3.5" : "w-9 text-[18px]", on ? "bg-[#2b1a3d] text-white" : "hover:bg-[#2b1a3d]/10")}>{children}</button>
  );
}
