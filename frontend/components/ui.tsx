"use client";
import { ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Card({ children, className, title, right }: { children: ReactNode; className?: string; title?: ReactNode; right?: ReactNode }) {
  return (
    <section className={cx("glass", className)}>
      {title && (
        <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
          <h3 className="text-[13px] font-semibold text-ink-2">{title}</h3>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

const TONES: Record<string, string> = {
  green: "bg-green-soft text-green border-green/20",
  red: "bg-red-soft text-red border-red/20",
  amber: "bg-amber-soft text-amber border-amber/20",
  teal: "bg-teal-soft text-teal border-teal/20",
  gray: "bg-paper text-ink-2 border-line",
  ink: "bg-ink text-white border-ink",
};

export function Badge({ tone = "gray", children, className, title }: { tone?: keyof typeof TONES | string; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cx("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[13px] font-medium whitespace-nowrap", TONES[tone] || TONES.gray, className)}>
      {children}
    </span>
  );
}

export function statusTone(s: string) {
  return (
    { pass: "green", fail: "red", warn: "amber", info: "gray", breach: "red", watch: "amber", "n/a": "gray", "n/m": "gray",
      high: "red", medium: "amber", low: "gray", disputed: "amber", analyst: "teal", verified: "green", unverified: "red",
      ready: "teal", processing: "amber", queued: "gray", failed: "red", in_review: "amber", submitted: "green", returned: "red" } as Record<string, string>
  )[s] || "gray";
}

export const STATUS_LABEL: Record<string, string> = {
  ready: "Draft ready", processing: "Analysing…", queued: "Queued", failed: "Failed", in_review: "In review",
  submitted: "Submitted to approver", returned: "Returned",
};

export function Btn({ children, onClick, variant = "primary", disabled, className, type = "button", title }: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "outline" | "danger"; disabled?: boolean; className?: string; type?: "button" | "submit"; title?: string;
}) {
  const v = {
    primary: "bg-blue text-white hover:bg-ink",
    outline: "border border-line bg-card hover:border-ink-2 text-ink",
    ghost: "text-ink-2 hover:bg-paper",
    danger: "border border-red/30 text-red hover:bg-red-soft",
  }[variant];
  return (
    <button type={type} title={title} disabled={disabled} onClick={onClick}
      className={cx("inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed", v, className)}>
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cx("inline-block h-3.5 w-3.5 rounded-full border-2 border-current border-r-transparent animate-spin", className)} />;
}

export function Dot({ tone }: { tone: string }) {
  const c = { green: "bg-green", red: "bg-red", amber: "bg-amber", teal: "bg-teal", gray: "bg-muted" }[tone] || "bg-muted";
  return <span className={cx("inline-block h-2 w-2 rounded-full shrink-0", c)} />;
}
