"use client";
import { useEffect, useRef, useState } from "react";
import { Ribbon } from "./fx/Engrave";
import { motion } from "motion/react";
import { api, Case } from "@/lib/api";
import { Evidence } from "@/lib/evidence";
import { cx } from "./ui";

const RENDER_SCALE = 1.6; // must match backend default page render scale

export default function EvidenceViewer({ c, ev, onOpenKey, onClose }: {
  c: Case; ev: Evidence | null; onOpenKey: (k: string) => void; onClose: () => void;
}) {
  const [ti, setTi] = useState(0);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [lens, setLens] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const target = ev?.targets[Math.min(ti, (ev?.targets.length || 1) - 1)];
  const src = target ? api.pageUrl(c.id, target.doc_id, target.page) : null;

  const loading = !!src && src !== loadedSrc;

  useEffect(() => {
    if (!nat || !target || !scroller.current) return;
    const vals = target.boxes.filter((b) => b.kind !== "label");
    const b = (vals[0] || target.boxes[0])?.bbox;
    if (!b) return;
    const el = scroller.current;
    const imgH = el.scrollWidth * (nat.h / nat.w);
    const y = (b[1] * RENDER_SCALE / nat.h) * imgH;
    el.scrollTo({ top: Math.max(0, y - el.clientHeight / 3), behavior: "smooth" });
  }, [nat, target]);

  if (!ev) {
    return (
      <div className="relative h-full flex flex-col items-center justify-center text-center px-8 text-ink-2">
        <Ribbon className="absolute inset-x-0 top-[12%] w-full h-[26%] opacity-80" />
        <div className="w-14 h-14 rounded-[14px] bg-red-soft flex items-center justify-center mb-4">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#b82e54" strokeWidth="1.8"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /><circle cx="11" cy="14" r="2.5" /><path d="m13 16 2.5 2.5" /></svg>
        </div>
        <p className="font-serif text-lg text-ink">Evidence panel</p>
        <p className="text-sm mt-1.5 max-w-xs">Click any <span className="evi text-ink">underlined figure</span>, check, ratio or memo citation. The source page opens here with the exact cell highlighted.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col fade-up" key={ev.key}>
      <div className="px-4 pt-3 pb-2.5 border-b border-line">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-teal font-semibold">Evidence</p>
            <h4 className="font-serif text-[17px] leading-snug font-semibold truncate" title={ev.title}>{ev.title}</h4>
            {ev.subtitle && <p className="text-xs text-muted mt-0.5">{ev.subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink text-lg leading-none px-1" aria-label="Close">×</button>
        </div>
        {ev.formula && (
          <div className="mt-2 rounded-md bg-paper border border-line px-2.5 py-1.5 text-xs">
            <span className="text-muted">Formula </span><span className="num text-ink">{ev.formula}</span>
          </div>
        )}
        {ev.lines && ev.lines.length > 0 && (
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
        {ev.targets.length > 1 && (
          <div className="mt-2 flex gap-1 flex-wrap">
            {ev.targets.map((t, i) => (
              <button key={i} onClick={() => setTi(i)}
                className={cx("text-[11px] rounded px-2 py-0.5 border", i === ti ? "bg-ink text-white border-ink" : "border-line text-ink-2 hover:border-ink-2")}>
                {c.documents.length > 1 ? `${c.documents.find((d) => d.id === t.doc_id)?.filename.slice(0, 14)} ` : ""}p.{t.page}
              </button>
            ))}
          </div>
        )}
      </div>
      {target ? (
        <div ref={scroller} className="relative flex-1 overflow-auto scroll-thin bg-[#d9e4d4] p-3">
          <div className="relative mx-auto shadow-md bg-white cursor-crosshair" onPointerMove={(e) => { if (e.pointerType !== "mouse") return; const r = e.currentTarget.getBoundingClientRect(); setLens({ x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height }); }} onPointerLeave={() => setLens(null)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src!} alt={`Source page ${target.page}`} className="block w-full"
              onLoad={(e) => { setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight }); setLoadedSrc(src); new window.Image().src = `${src}?scale=3`; }} />
            {nat && target.boxes.map((b, i) => {
              const pad = b.kind === "label" ? 1.5 : 2.5;
              const left = ((b.bbox[0] - pad) * RENDER_SCALE / nat.w) * 100;
              const top = ((b.bbox[1] - pad) * RENDER_SCALE / nat.h) * 100;
              const w = ((b.bbox[2] - b.bbox[0] + pad * 2) * RENDER_SCALE / nat.w) * 100;
              const h = ((b.bbox[3] - b.bbox[1] + pad * 2) * RENDER_SCALE / nat.h) * 100;
              return (
                <motion.div key={i} title={b.text} initial={{ opacity: 0, scale: 1.8 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 320, damping: 20, delay: 0.15 + i * 0.05 }}
                  className={cx("absolute rounded-[3px] pointer-events-none",
                    b.kind === "value" ? "bg-[#f4d35e]/55 ring-2 ring-magenta hl-box" : b.kind === "flag" ? "bg-red-300/30 ring-2 ring-red hl-box" : "bg-[#1f3c88]/10 ring-1 ring-blue/60")}
                  style={{ left: `${left}%`, top: `${top}%`, width: `${w}%`, height: `${h}%` }} />
              );
            })}
            {lens && !loading && src && <span aria-hidden data-lens className="absolute pointer-events-none rounded-full border-[6px] border-[#d9a441] shadow-[0_24px_40px_-12px_rgba(43,26,61,0.8),inset_0_0_24px_rgba(43,26,61,0.35)]"
              style={{ width: 190, height: 190, left: lens.x - 95, top: lens.y - 95, backgroundImage: `url(${src}?scale=3)`, backgroundSize: `${lens.w * 2.4}px ${lens.h * 2.4}px`, backgroundPosition: `${89 - lens.x * 2.4}px ${89 - lens.y * 2.4}px`, backgroundColor: "white", backgroundRepeat: "no-repeat" }} />}
            {loading && <div className="absolute inset-0 bg-white/60 flex items-center justify-center text-sm text-muted">Rendering page {target.page}…</div>}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-sm text-muted p-6 text-center">No source location: this item is not printed in the statements.</div>
      )}
    </div>
  );
}
