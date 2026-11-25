"use client";
import { Case } from "@/lib/api";
import { cx, Spinner } from "../ui";

export default function Trace({ c, compact }: { c: Case; compact?: boolean }) {
  const steps = c.trace || [];
  return (
    <ol className={cx("relative", compact ? "space-y-2" : "space-y-4")}>
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3 fade-up">
          <div className="flex flex-col items-center">
            <span className={cx("mt-0.5 h-5 w-5 rounded-full flex items-center justify-center text-[11px] text-white shrink-0",
              s.status === "done" ? "bg-teal" : s.status === "running" ? "bg-amber" : s.status === "warn" ? "bg-amber" : "bg-red")}>
              {s.status === "running" ? <Spinner className="h-2.5 w-2.5 border-[1.5px]" /> : s.status === "done" ? "✓" : "!"}
            </span>
            {i < steps.length - 1 && <span className="w-px flex-1 bg-line mt-1" />}
          </div>
          <div className="pb-1 min-w-0">
            <p className={cx("font-medium", compact ? "text-[13px]" : "text-sm")}>
              {s.title}
              {s.ms !== null && <span className="ml-2 num text-[11px] text-muted">{s.ms < 1000 ? `${s.ms} ms` : `${(s.ms / 1000).toFixed(1)} s`}</span>}
            </p>
            {s.detail && <p className={cx("text-muted mt-0.5 leading-snug", compact ? "text-xs" : "text-[13px]")}>{s.detail}</p>}
          </div>
        </li>
      ))}
      {c.status === "queued" && <li className="text-sm text-muted flex items-center gap-2"><Spinner /> Queued…</li>}
    </ol>
  );
}
