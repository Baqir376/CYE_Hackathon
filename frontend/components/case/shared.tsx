"use client";
import { createPortal } from "react-dom";
import { createContext, KeyboardEvent, ReactNode, useContext, useEffect, useRef } from "react";
import { Case } from "@/lib/api";
import { Evidence } from "@/lib/evidence";
import { cx } from "../ui";

export type Ctx = {
  c: Case;
  open: (ev: Evidence | null) => void;
  activeKey: string | null;
  setCase: (c: Case) => void;
  actor: string;
  taxonomy: { code: string; statement: string; name: string }[];
  llm: boolean;
  flash: Set<string>;
};
export const CaseCtx = createContext<Ctx | null>(null);
export function useCase() {
  const v = useContext(CaseCtx);
  if (!v) throw new Error("no case ctx");
  return v;
}

/** Makes a non-button element work from the keyboard. */
export function press(fn: () => void) {
  return { role: "button", tabIndex: 0, onKeyDown: (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); fn(); } } };
}

export function Evi({ ev, children, className }: { ev: Evidence | null; children: ReactNode; className?: string }) {
  const { open, activeKey } = useCase();
  if (!ev) return <span className={className}>{children}</span>;
  return (
    <span {...press(() => open(ev))} className={cx("evi", activeKey === ev.key && "active", className)} onClick={(e) => { e.stopPropagation(); open(ev); }}>
      {children}
    </span>
  );
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const items = () => [...(box.current?.querySelectorAll<HTMLElement>("button,input,select,textarea") || [])].filter((e) => !(e as HTMLButtonElement).disabled);
    items()[1]?.focus();
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      if (e.key !== "Tab") return;
      const l = items(), first = l[0], last = l[l.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); before?.focus?.(); };
  }, []);
  return createPortal(
    <div className="fixed inset-0 z-[80] bg-ink/35 backdrop-blur-[5px] flex items-center justify-center p-4" onClick={onClose}>
      <div ref={box} role="dialog" aria-modal="true" aria-label={title} className="bg-white/92 backdrop-blur-2xl rounded-[20px] border border-white shadow-[0_50px_120px_-30px_rgba(43,26,61,0.7)] w-full max-w-lg fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-line">
          <h3 className="font-serif text-lg font-semibold">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="text-muted hover:text-ink text-2xl leading-none h-9 w-9">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function TABLE_ORDER(taxonomy: { code: string; statement: string }[], spreadCodes: string[]) {
  const extras: Record<string, string> = { "X.TOTAL_DEBT": "BS.TOTAL_EQ_LIAB", "X.EBIT": "IS.NET_PROFIT", "X.EBITDA": "X.EBIT", "X.FCF": "CF.CASH_END" };
  const order = taxonomy.map((t) => t.code);
  for (const [x, after] of Object.entries(extras)) {
    const i = order.indexOf(after);
    order.splice(i >= 0 ? i + 1 : order.length, 0, x);
  }
  return order.filter((c) => spreadCodes.includes(c));
}

export function stmtOf(code: string) {
  if (code.startsWith("X.")) return code === "X.TOTAL_DEBT" ? "BS" : code === "X.FCF" ? "CF" : "IS";
  return code.split(".")[0];
}
