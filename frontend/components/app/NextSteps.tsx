"use client";
import { motion } from "motion/react";
import { Case } from "@/lib/api";
import { Ribbon } from "../fx/Engrave";
import { cx, Spinner } from "../ui";

export function openDisputes(c: Case) {
  return c.rows.filter((r) => r.confidence === "disputed" && !c.confirmed?.[r.id] && !c.overrides[r.id]);
}

/** Tells the analyst what to do next, in order. Every step jumps to the right place. */
export default function NextSteps({ c, seen, goto, onSubmit, redraft, busy }: {
  c: Case; seen: Set<string>; goto: (tab: string) => void; onSubmit: () => void; redraft: () => void; busy: boolean;
}) {
  const fails = c.checks.filter((x) => x.status === "fail").length;
  const disputes = openDisputes(c).length;
  const blocked = c.memo?.stats.unverified ?? 0;
  const stale = !!c.memo?.stale;
  const submitted = c.status === "submitted";
  const steps = [
    { k: "checks", t: fails ? `Look at ${fails} failed check${fails > 1 ? "s" : ""}` : "Checks", d: fails ? "Something in the statements doesn't add up." : "Everything ties out.", done: fails === 0 || submitted, go: () => goto("checks"), cta: "Open checks" },
    { k: "review", t: disputes ? `Confirm ${disputes} line${disputes > 1 ? "s" : ""}` : "Lines", d: disputes ? "Rules and AI disagree. You decide." : "No open disagreements.", done: disputes === 0 || submitted, go: () => goto("review"), cta: "Review lines" },
    { k: "memo", t: stale ? "Redraft the memo" : blocked ? `Fix ${blocked} blocked sentence${blocked > 1 ? "s" : ""}` : "Read the memo", d: stale ? "Figures changed since it was written." : blocked ? "A figure doesn't match its source." : "Click any source tag to see the page.", done: (!stale && !blocked && seen.has("memo")) || submitted, go: stale ? redraft : () => goto("memo"), cta: stale ? "Redraft now" : "Open memo" },
    { k: "submit", t: submitted ? "Submitted" : "Submit to approver", d: submitted ? "The approver makes the credit decision." : "Your bank makes the decision.", done: submitted, go: onSubmit, cta: "Submit" },
  ];
  const current = steps.findIndex((s) => !s.done);
  return (
    <ol aria-label="What to do next" className="no-print mt-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
      {steps.map((s, i) => {
        const on = i === current;
        return (
          <motion.li key={s.k} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className={cx("relative rounded-[14px] p-4 flex gap-3 transition-colors", on ? "bg-blue text-white shadow-[0_26px_50px_-24px_rgba(31,60,136,0.95)]" : "glass")}>
            {on && <span aria-hidden className="absolute inset-0 rounded-[14px] overflow-hidden"><Ribbon color="rgba(255,255,255,.2)" className="absolute inset-x-0 bottom-0 w-full h-[80%]" /></span>}
            <span className={cx("relative h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-[14px] font-semibold", s.done ? "bg-green text-white" : on ? "bg-mustard text-ink" : "bg-line text-ink-2")}>
              {s.done ? <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><path d="M5 13l4.5 4.5L19 7" /></motion.svg> : i + 1}
            </span>
            <span className="relative min-w-0">
              <span className="block text-[15px] font-semibold leading-snug">{s.t}</span>
              <span className={cx("block text-[14px] leading-snug", on ? "text-white/90" : "text-muted")}>{s.d}</span>
              {on && <button onClick={s.go} disabled={busy} className="shine mt-2.5 rounded-[9px] bg-mustard text-ink text-[15px] font-bold px-4 py-1.5 hover:bg-lemon transition-colors inline-flex items-center gap-2">{busy && <Spinner />}{s.cta}</button>}
              {!on && !s.done && i > current && s.k !== "submit" && <button onClick={s.go} className="mt-1.5 text-[14px] text-teal hover:underline">{s.cta}</button>}
            </span>
          </motion.li>
        );
      })}
    </ol>
  );
}
