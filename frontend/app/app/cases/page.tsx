"use client";
import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { api, CaseSummary } from "@/lib/api";
import { useServer } from "@/lib/useServer";
import { Badge, Spinner, STATUS_LABEL, statusTone } from "@/components/ui";
import { Banner, Ribbon } from "@/components/fx/Engrave";
import { EASE } from "@/components/motion/primitives";

export default function CasesPage() {
  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const waking = useServer(api.cases, setCases);
  return (
    <div className="mx-auto max-w-[1200px] px-5 sm:px-6 pt-6 md:pt-9 pb-16">
      <Banner tint="#FDF1CF" className="px-7 sm:px-10 py-10"><div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[16px] text-ink-2">Every borrower you&apos;ve analysed</p>
          <h1 className="font-display text-[52px] leading-none mt-2">Credit cases</h1>
        </div>
        <Link href="/app" className="rounded-[10px] bg-blue text-white px-5 py-2.5 text-[16px] font-bold hover:bg-ink-2">New case</Link>
      </div></Banner>
      <div className="mt-10 space-y-3">
        {cases === null && Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 rounded-2xl glass animate-pulse" />)}
        {waking && <p role="status" className="rounded-[14px] bg-amber-soft text-amber px-5 py-4 flex items-center gap-3"><Spinner className="shrink-0" />The analysis server is waking up, which can take about a minute. This page connects by itself.</p>}
        {cases?.length === 0 && <p className="text-muted">No cases yet. <Link href="/app" className="text-teal underline">Start one</Link>.</p>}
        {cases?.map((c, i) => (
          <motion.div key={c.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04, duration: 0.5, ease: EASE }}>
            <Link href={`/app/cases/${c.id}`}>
              <motion.div whileHover={{ y: -5, rotateX: 5, scale: 1.01 }} style={{ transformPerspective: 900 }} transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className="glass relative overflow-hidden group px-6 py-5 grid md:grid-cols-[2.4fr_0.9fr_0.6fr_0.6fr_170px] gap-4 items-center">
                <Ribbon className="absolute right-0 top-0 h-full w-[38%] opacity-25 group-hover:opacity-80 transition-opacity duration-500 [mask-image:linear-gradient(90deg,transparent,black)]" />
                <div className="relative">
                  <p className="font-display text-[24px] leading-tight group-hover:text-teal transition-colors">{c.borrower === "auto" ? "Detecting borrower…" : c.borrower}</p>
                  <p className="text-[13px] text-muted mt-0.5">{c.facility || "Facility not specified"} · {new Date(c.created_at).toLocaleString()}</p>
                </div>
                <p className="num text-[13px] text-ink-2">{(c.periods || []).join(" · ") || "—"}</p>
                <div><p className="text-[13px] text-muted">Exceptions</p><p className="num text-lg">{c.exception_count ?? "—"}</p></div>
                <div><p className="text-[13px] text-muted">Risk signals</p><p className="num text-lg">{c.signal_count ?? "—"}</p></div>
                <Badge className="relative w-fit md:justify-self-end" tone={statusTone(c.status)}>{STATUS_LABEL[c.status] || c.status}</Badge>
              </motion.div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
