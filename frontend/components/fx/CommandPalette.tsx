"use client";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { cx } from "../ui";

export type Command = { id: string; label: string; hint?: string; run: () => void };
const OPEN = "crediq:palette", SET = "crediq:commands";
let extra: Command[] = [];

/** Pages add their own commands (the workspace adds tabs and every figure). */
export function useCommands(list: Command[]) {
  useEffect(() => {
    extra = list;
    window.dispatchEvent(new Event(SET));
    return () => { extra = []; window.dispatchEvent(new Event(SET)); };
  }, [list]);
}
export const openPalette = () => window.dispatchEvent(new Event(OPEN));

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [at, setAt] = useState(0);
  const [more, setMore] = useState<Command[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const back = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const show = () => { back.current = document.activeElement as HTMLElement; setQ(""); setAt(0); setOpen(true); };
    const sync = () => setMore([...extra]);
    const key = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); show(); } };
    sync();
    window.addEventListener(OPEN, show); window.addEventListener(SET, sync); window.addEventListener("keydown", key);
    return () => { window.removeEventListener(OPEN, show); window.removeEventListener(SET, sync); window.removeEventListener("keydown", key); };
  }, []);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);

  const list = useMemo(() => {
    const go = (p: string) => () => router.push(p);
    const all: Command[] = [...more, { id: "n", label: "New analysis", hint: "Page", run: go("/app") }, { id: "c", label: "Cases", hint: "Page", run: go("/app/cases") },
      { id: "g", label: "Guide", hint: "Page", run: go("/app/guide") }, { id: "w", label: "CredIQ website", hint: "Page", run: go("/") }];
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return all.filter((c) => words.every((w) => `${c.label} ${c.hint || ""}`.toLowerCase().includes(w))).slice(0, 40);
  }, [q, more, router]);

  const close = () => { setOpen(false); back.current?.focus?.(); };
  const pick = (c?: Command) => { if (!c) return; setOpen(false); c.run(); };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="no-print fixed inset-0 z-[90] bg-[#2b1a3d]/35 backdrop-blur-[6px] flex justify-center items-start pt-[14vh] px-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onClick={close}>
          <motion.div role="dialog" aria-modal="true" aria-label="Search and jump" onClick={(e) => e.stopPropagation()} className="w-full max-w-[620px] rounded-[20px] bg-white/90 backdrop-blur-2xl border border-white shadow-[0_50px_120px_-30px_rgba(43,26,61,0.7)] overflow-hidden"
            initial={{ opacity: 0, y: -24, scale: 0.96, rotateX: -12 }} animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }} exit={{ opacity: 0, y: -12, scale: 0.98 }} transition={{ type: "spring", stiffness: 340, damping: 28 }} style={{ transformPerspective: 900 }}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              if (e.key === "ArrowDown") { e.preventDefault(); setAt((i) => Math.min(list.length - 1, i + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setAt((i) => Math.max(0, i - 1)); }
              if (e.key === "Enter") { e.preventDefault(); pick(list[at]); }
              if (e.key === "Tab") e.preventDefault();
            }}>
            <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setAt(0); }} role="combobox" aria-expanded="true" aria-controls="cmd-list" aria-activedescendant={list[at] ? `cmd-${at}` : undefined} aria-label="Search figures, tabs and pages"
              placeholder="Find a figure, tab or page" className="w-full bg-transparent px-6 py-5 text-[20px] outline-none placeholder:text-muted" />
            <ul id="cmd-list" role="listbox" aria-label="Results" className="max-h-[46vh] overflow-auto scroll-thin border-t border-line p-2">
              {list.map((c, i) => (
                <li key={c.id} id={`cmd-${i}`} role="option" aria-selected={i === at} ref={(e) => { if (i === at) e?.scrollIntoView({ block: "nearest" }); }} onMouseMove={() => setAt(i)} onClick={() => pick(c)}
                  className={cx("flex items-center justify-between gap-4 rounded-[12px] px-4 py-2.5 text-[16px] cursor-pointer", i === at ? "bg-blue text-white" : "text-ink")}>
                  <span className="truncate">{c.label}</span><span className={cx("num text-[15px] shrink-0", i === at ? "text-white" : "text-muted")}>{c.hint}</span>
                </li>
              ))}
            </ul>
            {!list.length && <p className="px-6 pb-5 text-muted">Nothing matches.</p>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
