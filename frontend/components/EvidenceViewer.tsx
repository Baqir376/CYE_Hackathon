"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { api, Case } from "@/lib/api";
import { Evidence } from "@/lib/evidence";
import DocInspector, { hotspots } from "./DocInspector";
import { cx } from "./ui";

const RENDER_SCALE = 1.6; // must match backend default page render scale
const same = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]) < 0.01);

export default function EvidenceViewer({ c, ev, onOpenKey, onClose }: {
  c: Case; ev: Evidence | null; onOpenKey: (k: string) => void; onClose: () => void;
}) {
  const first = ev?.targets[0];
  const startDoc = c.documents[0];
  const [view, setView] = useState(() => ({
    doc: first?.doc_id || startDoc?.id || "",
    page: first?.page || startDoc?.statement_pages?.[0]?.page || 1,
    dir: 1,
  }));
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [lens, setLens] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ hot: number; x: number; y: number } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(ev?.targets.length ? 1.8 : 1);
  const setZ = (z: number) => setZoom(Math.round(Math.min(4, Math.max(1, z)) * 10) / 10);
  const doc = c.documents.find((d) => d.id === view.doc) || startDoc;
  const pages = doc?.pages || 1;
  const target = ev?.targets.find((t) => t.doc_id === view.doc && t.page === view.page);
  const hots = useMemo(() => hotspots(ev), [ev]);
  const base = doc ? api.pageUrl(c.id, view.doc, view.page) : null;
  const src = base && zoom > 1.15 ? `${base}?scale=3` : base;
  const loading = !!src && src !== loadedSrc;
  const stmt = doc?.statement_pages?.find((s) => s.page === view.page);

  const go = (page: number, d = view.doc) => { if (page >= 1 && page <= (c.documents.find((x) => x.id === d)?.pages || 1)) setView((v) => ({ doc: d, page, dir: page >= v.page ? 1 : -1 })); };
  const hotIndex = (bbox: number[]) => Math.max(0, hots.findIndex((h) => h.doc_id === view.doc && h.page === view.page && same(h.bbox, bbox)));
  const openFocus = (hot: number, e?: { clientX: number; clientY: number }) => setFocus({ hot, x: e?.clientX ?? window.innerWidth - 220, y: e?.clientY ?? 160 });

  useEffect(() => {
    if (!nat || !target || !scroller.current) return;
    const vals = target.boxes.filter((b) => b.kind !== "label");
    const b = (vals[0] || target.boxes[0])?.bbox;
    if (!b) return;
    const el = scroller.current, pg = sheet.current;
    if (!pg) return;
    const k = pg.offsetWidth / (nat.w / RENDER_SCALE), cx = pg.offsetLeft + ((b[0] + b[2]) / 2) * k, cy = pg.offsetTop + ((b[1] + b[3]) / 2) * k;
    el.scrollTo({ left: Math.max(0, cx - el.clientWidth / 2), top: Math.max(0, cy - el.clientHeight * 0.42), behavior: "smooth" });
  }, [nat, target, zoom]);
  useEffect(() => {
    const el = scroller.current; if (!el) return;
    const w = (e: WheelEvent) => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); setZoom((z) => Math.round(Math.min(4, Math.max(1, z * Math.exp(-e.deltaY * 0.002))) * 10) / 10); };
    el.addEventListener("wheel", w, { passive: false });
    return () => el.removeEventListener("wheel", w);
  }, []);

  const vals = target?.boxes.filter((b) => b.kind !== "label") || [];
  const pin = vals[0];
  const pct = (v: number, n: number) => ((v * RENDER_SCALE) / n) * 100;

  return (
    <div className="h-full flex flex-col fade-up" key={ev?.key || "browse"}>
      <div className="px-4 pt-3 pb-2.5 border-b border-line">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-teal font-semibold">{ev ? "Evidence" : "Source document"}</p>
            <h4 className="font-serif text-[17px] leading-snug font-semibold truncate" title={ev?.title || doc?.filename}>{ev?.title || doc?.filename}</h4>
            {ev?.subtitle ? <p className="text-xs text-muted mt-0.5">{ev.subtitle}</p>
              : <p className="text-xs text-muted mt-0.5">Pick any line on the left and its exact cell lights up here.</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={(e) => openFocus(hots.length ? (target ? hotIndex((pin || target.boxes[0]).bbox) : 0) : -1, e)} aria-label="Open focus view"
              className="group flex items-center gap-1.5 rounded-full bg-ink text-white pl-2.5 pr-3 py-1.5 text-[12px] font-semibold hover:bg-magenta transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="transition-transform group-hover:scale-110"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>Focus
            </button>
            {ev && <button onClick={onClose} className="text-muted hover:text-ink text-lg leading-none px-1.5" aria-label="Close">×</button>}
          </div>
        </div>
        {ev?.formula && (
          <div className="mt-2 rounded-md bg-paper border border-line px-2.5 py-1.5 text-xs">
            <span className="text-muted">Formula </span><span className="num text-ink">{ev.formula}</span>
          </div>
        )}
        {ev?.lines && ev.lines.length > 0 && (
          <div className="mt-2 max-h-36 overflow-auto scroll-thin">
            <table className="w-full text-xs">
              <tbody>
                {ev.lines.map((l, i) => (
                  <tr key={i} className="border-t border-line/60 first:border-0">
                    <td className="py-1 pr-2 text-ink-2">{l.label}</td>
                    <td className="py-1 text-right num">
                      {l.onClickKey ? <span className="evi" onClick={() => onOpenKey(l.onClickKey!)}>{l.value}</span> : l.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {ev && ev.targets.length > 1 && (
          <div className="mt-2 flex gap-1 flex-wrap">
            {ev.targets.map((t, i) => {
              const on = t.doc_id === view.doc && t.page === view.page;
              return (
                <button key={i} onClick={() => go(t.page, t.doc_id)}
                  className={cx("text-[11px] rounded px-2 py-0.5 border", on ? "bg-ink text-white border-ink" : "border-line text-ink-2 hover:border-ink-2")}>
                  {c.documents.length > 1 ? `${c.documents.find((d) => d.id === t.doc_id)?.filename.slice(0, 14)} ` : ""}p.{t.page}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* page navigator */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-line bg-white/60">
        <button aria-label="Previous page" disabled={view.page <= 1} onClick={() => go(view.page - 1)} className="h-8 w-8 rounded-full border border-line text-ink-2 hover:bg-ink hover:text-white disabled:opacity-30 transition-colors">‹</button>
        <div className="flex-1 min-w-0 text-center">
          <p className="text-[13px] font-semibold text-ink leading-tight">Page <span className="num">{view.page}</span> <span className="text-muted font-normal">of {pages}</span></p>
          <p className="text-[11px] text-muted truncate">{stmt ? stmt.title : target ? "Highlighted page" : "Not a statement page"}</p>
        </div>
        <div className="flex items-center rounded-full border border-line bg-white" role="group" aria-label="Zoom">
          <button aria-label="Zoom out" disabled={zoom <= 1} onClick={() => setZ(zoom / 1.25)} className="h-8 w-8 rounded-full text-ink-2 hover:bg-ink hover:text-white disabled:opacity-30">−</button>
          <button aria-label={`${Math.round(zoom * 100)}%, fit page width`} onClick={() => setZ(1)} className="num min-w-12 px-1 text-[12px] text-ink hover:text-magenta" title="Fit width">{Math.round(zoom * 100)}%</button>
          <button aria-label="Zoom in" disabled={zoom >= 4} onClick={() => setZ(zoom * 1.25)} className="h-8 w-8 rounded-full text-ink-2 hover:bg-ink hover:text-white disabled:opacity-30">+</button>
        </div>
        <button aria-label="Next page" disabled={view.page >= pages} onClick={() => go(view.page + 1)} className="h-8 w-8 rounded-full border border-line text-ink-2 hover:bg-ink hover:text-white disabled:opacity-30 transition-colors">›</button>
      </div>
      {doc?.statement_pages && doc.statement_pages.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto scroll-thin px-3 py-2 border-b border-line">
          {doc.statement_pages.map((s) => {
            const n = hots.filter((h) => h.doc_id === view.doc && h.page === s.page).length;
            return (
              <button key={s.page} onClick={() => go(s.page)} className={cx("relative shrink-0 rounded-full border px-2.5 py-1 text-[11px] transition-colors", s.page === view.page ? "bg-lemon border-lemon text-ink font-semibold" : "border-line text-ink-2 hover:border-ink-2")}>
                {s.statement} · p.{s.page}{n > 0 && <span className="ml-1 rounded-full bg-magenta px-1.5 text-white">{n}</span>}
              </button>
            );
          })}
        </div>
      )}

      {ev && ev.targets.length === 0 && <p className="px-4 py-2 text-[12px] text-amber bg-amber-soft border-b border-line">No source location: this item is not printed in the statements. Showing the document.</p>}
      {src ? (
        <div ref={scroller} className="relative flex-1 overflow-auto scroll-thin bg-[#d9e4d4] p-3 [perspective:1600px]">
          <AnimatePresence mode="popLayout" initial={false} custom={view.dir}>
            <motion.div key={base} ref={sheet} custom={view.dir} style={{ width: `${zoom * 100}%` }} className="relative mx-auto shadow-md bg-white cursor-crosshair"
              variants={{ in: (d: number) => ({ opacity: 0, x: d * 60, rotateY: d * -12 }), on: { opacity: 1, x: 0, rotateY: 0, transition: { type: "spring", stiffness: 200, damping: 24 } }, out: (d: number) => ({ opacity: 0, x: d * -60, rotateY: d * 10, transition: { duration: 0.2 } }) }}
              initial="in" animate="on" exit="out"
              onPointerMove={(e) => { if (e.pointerType !== "mouse") return; const r = e.currentTarget.getBoundingClientRect(); setLens({ x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height }); }} onPointerLeave={() => setLens(null)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Source page ${view.page}`} className="block w-full"
                onLoad={(e) => { const f = src.endsWith("?scale=3") ? RENDER_SCALE / 3 : 1; setNat({ w: e.currentTarget.naturalWidth * f, h: e.currentTarget.naturalHeight * f }); setLoadedSrc(src); new window.Image().src = `${base}?scale=3`; }} />
              {nat && target?.boxes.map((b, i) => {
                const pad = b.kind === "label" ? 1.5 : 2.5;
                const style = { left: `${pct(b.bbox[0] - pad, nat.w)}%`, top: `${pct(b.bbox[1] - pad, nat.h)}%`, width: `${pct(b.bbox[2] - b.bbox[0] + pad * 2, nat.w)}%`, height: `${pct(b.bbox[3] - b.bbox[1] + pad * 2, nat.h)}%` };
                if (b.kind === "label") return <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute rounded-[3px] pointer-events-none bg-[#1f3c88]/10 ring-1 ring-blue/60" style={style} />;
                return (
                  <motion.button key={i} title={`${b.text || "Highlight"}: open in focus view`} aria-label={`Inspect ${b.text || "highlight"} in focus view`}
                    initial={{ opacity: 0, scale: 1.8 }} animate={{ opacity: 1, scale: 1 }} whileHover={{ scale: 1.12 }}
                    transition={{ type: "spring", stiffness: 320, damping: 20, delay: 0.15 + i * 0.05 }}
                    onClick={(e) => openFocus(hotIndex(b.bbox), e)}
                    className={cx("absolute rounded-[3px] cursor-zoom-in hl-box hl-click", b.kind === "value" ? "bg-[#f4d35e]/55 ring-2 ring-magenta" : "bg-red-300/30 ring-2 ring-red")} style={style} />
                );
              })}
              {nat && pin && (
                <motion.button initial={{ opacity: 0, y: 8, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.55, type: "spring", stiffness: 260, damping: 18 }}
                  onClick={(e) => openFocus(hotIndex(pin.bbox), e)} aria-label="Inspect highlight"
                  className="inspect-pin absolute z-10 flex items-center gap-1 rounded-full bg-ink pl-1.5 pr-2.5 py-1 text-[11px] font-semibold text-white shadow-[0_10px_24px_-8px_rgba(43,26,61,0.8)] hover:bg-magenta"
                  style={pct(pin.bbox[2], nat.w) < 90.5
                    ? { left: `${pct(pin.bbox[2] + 5, nat.w)}%`, top: `calc(${pct((pin.bbox[1] + pin.bbox[3]) / 2, nat.h)}% - 12px)` }
                    : { right: `${Math.max(0, 100 - pct(pin.bbox[2] + 3, nat.w))}%`, top: `calc(${pct(pin.bbox[1] - 3, nat.h)}% - 30px)` }}>
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-lemon text-ink">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>
                  </span>Inspect
                </motion.button>
              )}
              {lens && !loading && <span aria-hidden data-lens className="absolute pointer-events-none rounded-full border-[6px] border-[#d9a441] shadow-[0_24px_40px_-12px_rgba(43,26,61,0.8),inset_0_0_24px_rgba(43,26,61,0.35)]"
                style={{ width: 190, height: 190, left: lens.x - 95, top: lens.y - 95, backgroundImage: `url(${base}?scale=3)`, backgroundSize: `${lens.w * 2.4}px ${lens.h * 2.4}px`, backgroundPosition: `${89 - lens.x * 2.4}px ${89 - lens.y * 2.4}px`, backgroundColor: "white", backgroundRepeat: "no-repeat" }} />}
              {loading && <div className="absolute inset-0 bg-white/60 flex items-center justify-center text-sm text-muted">Rendering page {view.page}…</div>}
            </motion.div>
          </AnimatePresence>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-sm text-muted p-6 text-center">No source location: this item is not printed in the statements.</div>
      )}

      <AnimatePresence>
        {focus && <DocInspector key="focus" c={c} ev={ev} docId={view.doc} page={view.page} hot={focus.hot} origin={{ x: focus.x, y: focus.y }} onClose={() => setFocus(null)} />}
      </AnimatePresence>
    </div>
  );
}
