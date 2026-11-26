"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import AnalysisTheater from "@/components/case/AnalysisTheater";
import { api, Case, Meta, ratio } from "@/lib/api";
import { Evidence, evidenceByKey, fmtM, ratioEvidence, spreadEvidence } from "@/lib/evidence";
import EvidenceViewer from "@/components/EvidenceViewer";
import { Badge, Btn, Card, cx, Spinner, STATUS_LABEL, statusTone } from "@/components/ui";
import Overview from "@/components/case/Overview";
import Spread from "@/components/case/Spread";
import Checks from "@/components/case/Checks";
import Ratios from "@/components/case/Ratios";
import MemoTab from "@/components/case/MemoTab";
import { Banner } from "@/components/fx/Engrave";
import StressLab from "@/components/fx/StressLab";
import { baseOf, limitsOf } from "@/lib/stress";
import { CaseCtx } from "@/components/case/shared";
import NextSteps from "@/components/app/NextSteps";
import { Command, openPalette, useCommands } from "@/components/fx/CommandPalette";

const TABS = [
  ["overview", "Overview"], ["spread", "Spread"], ["checks", "Checks"], ["ratios", "Ratios & policy"], ["stress", "Stress test"], ["memo", "Credit memo"], ["audit", "Audit trail"],
] as const;

// tabs slide in the direction you move, on a spring
const SLIDE = {
  from: (d: number) => ({ opacity: 0, x: 90 * d, rotateY: 7 * d, transformPerspective: 1400 }),
  here: { opacity: 1, x: 0, rotateY: 0, transition: { type: "spring" as const, stiffness: 210, damping: 25 } },
  gone: (d: number) => ({ opacity: 0, x: -70 * d, rotateY: -5 * d, transition: { duration: 0.18 } }),
};

export default function CaseWorkspace() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<Case | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [llm, setLlm] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTabRaw] = useState<string>("spread"); // the template on the left, the document on the right
  const [review, setReview] = useState(false);
  const [dir, setDir] = useState(1);
  const [seen, setSeen] = useState<Set<string>>(new Set(["spread"]));
  const [working, setWorking] = useState(false);
  const setTab = useCallback((k: string) => {
    setReview(k === "review");
    const t = k === "review" ? "spread" : k;
    setTabRaw((old) => { const at = (x: string) => TABS.findIndex(([n]) => n === x); setDir(at(t) >= at(old) ? 1 : -1); return t; });
    setSeen((s) => new Set(s).add(t));
  }, []);
  const [ev, setEv] = useState<Evidence | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const actor = c?.analyst || "Credit Analyst";

  const [handoff, setHandoff] = useState(false);
  const prevStatus = useRef<string | null>(null);
  const load = useCallback(() => api.get(id).then((nc) => {
    const was = prevStatus.current;
    if ((was === "processing" || was === "queued") && nc.status !== "processing" && nc.status !== "queued" && nc.status !== "failed") {
      setHandoff(true);
      setTimeout(() => setHandoff(false), 2000);
    }
    prevStatus.current = nc.status;
    setC(nc);
  }).catch((e) => setErr(e.message)), [id]);
  useEffect(() => {
    load();
    api.meta().then(setMeta).catch(() => {});
    api.health().then((h) => setLlm(h.llm.configured)).catch(() => {});
  }, [load]);
  const busy = c && (c.status === "processing" || c.status === "queued");
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(load, 900);
    return () => clearInterval(t);
  }, [busy, load]);

  const [flash, setFlash] = useState<Set<string>>(new Set());
  const updateCase = useCallback((nc: Case) => {
    setC((old) => {
      if (old?.spread && nc.spread) {
        const changed = new Set<string>();
        for (const [code, it] of Object.entries(nc.spread)) for (const [p, v] of Object.entries(it.values)) {
          const ov = old.spread[code]?.values[p]?.value;
          if (ov === undefined || Math.abs(ov - v.value) > 0.5) changed.add(`${code}:${p}`);
        }
        for (const [k, r] of Object.entries(nc.ratios || {})) for (const [p, v] of Object.entries(r.values)) {
          const ov = old.ratios?.[k]?.values[p];
          if (ov === undefined || Math.abs(ov - v) > 1e-9) changed.add(`r:${k}:${p}`);
        }
        if (changed.size) { setFlash(changed); setTimeout(() => setFlash(new Set()), 2600); }
      }
      return nc;
    });
  }, []);
  const ctx = useMemo(() => c && {
    c, open: setEv, activeKey: ev?.key || null, setCase: updateCase, actor, taxonomy: meta?.taxonomy || [], llm, flash,
  }, [c, ev, actor, meta, llm, flash, updateCase]);

  const commands = useMemo<Command[]>(() => {
    if (!c?.spread) return [];
    const [cur] = c.periods;
    return [...TABS.map(([k, l]) => ({ id: "t" + k, label: l, hint: "Tab", run: () => setTab(k) })),
      ...Object.values(c.spread).filter((s) => s.values[cur]).map((s) => ({ id: s.code, label: s.name, hint: fmtM(s.values[cur].value), run: () => setEv(spreadEvidence(c, s.code, cur)) })),
      ...Object.values(c.ratios || {}).filter((r) => r.values[cur] !== undefined).map((r) => ({ id: r.key, label: r.name, hint: ratio(r.values[cur], r.unit), run: () => setEv(ratioEvidence(c, r.key, cur)) }))];
  }, [c, setTab]);
  useCommands(commands);

  if (err) return <div className="p-10"><p role="alert" className="text-red text-[18px]">{err === "Case not found" ? "This case was not found." : err}</p><Link href="/app/cases" className="inline-block mt-4 text-teal underline">Back to cases</Link></div>;
  if (!c || !ctx) return <div className="p-10 flex items-center gap-2 text-muted"><Spinner /> Loading case…</div>;

  if (busy || c.status === "failed" || handoff) return <AnalysisTheater c={c} complete={handoff} />;

  const stressBase = baseOf(c);
  async function setStatus(status: string) {
    setSubmitErr(null);
    try { setC(await api.post<Case>(`/api/cases/${c!.id}/status`, { status, actor })); }
    catch (e) { setSubmitErr((e as Error).message); }
  }
  async function redraft() {
    setWorking(true);
    try { updateCase(await api.post<Case>(`/api/cases/${c!.id}/memo/regenerate`, { use_llm: llm, actor })); setTab("memo"); }
    catch (e) { setSubmitErr((e as Error).message); }
    finally { setWorking(false); }
  }
  const openKey = (k: string) => setEv(evidenceByKey(c, k));

  return (
    <CaseCtx.Provider value={ctx}>
      <motion.div className="mx-auto max-w-[1500px] px-5 pt-5 md:pt-6 pb-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
        <Banner tint="#E1F1E8" className="px-6 sm:px-8 py-6"><div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/app/cases" className="text-[14px] text-ink-2 hover:text-ink">← Cases</Link>
            <h1 className="font-serif text-[clamp(26px,2.6vw,38px)] leading-tight mt-0.5">{c.borrower}</h1>
            <div className="flex items-center gap-2 mt-1 text-sm text-ink-2 flex-wrap">
              <Badge tone={statusTone(c.status)}>{STATUS_LABEL[c.status] || c.status}</Badge>
              <span>{c.facility || "Facility not specified"}</span><span className="text-ink-2/40" aria-hidden>|</span>
              <span className="num text-xs">{c.periods.join(" · ")}</span><span className="text-ink-2/40" aria-hidden>|</span>
              <span className="text-xs">{c.documents.length} document{c.documents.length > 1 ? "s" : ""}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex gap-2">
              <button onClick={openPalette} className="glass hidden sm:flex items-center gap-3 !rounded-[12px] px-4 py-2 text-[15px] text-ink-2 hover:text-ink">Find any figure <kbd className="rounded-md bg-white/80 border border-line px-1.5 text-[13px]">Ctrl K</kbd></button>
              {c.status === "submitted" && <Btn variant="outline" onClick={() => setStatus("returned")}>Return to analyst</Btn>}
            </div>
            {submitErr && <p className="text-[15px] text-red max-w-sm text-right">Blocked: {submitErr}</p>}
          </div>
        </div></Banner>

        <NextSteps c={c} seen={seen} goto={setTab} onSubmit={() => setStatus("submitted")} redraft={redraft} busy={working} />

        <div className="glass mt-5 !rounded-[14px] flex gap-1 no-print overflow-x-auto p-1.5">
          {TABS.map(([k, l]) => {
            const badge = k === "checks" ? c.checks.filter((x) => x.status === "fail").length : k === "overview" ? c.signals.length : 0;
            return (
              <button key={k} onClick={() => setTab(k)}
                className={cx("relative px-3.5 py-2.5 text-[15px] whitespace-nowrap transition-colors", tab === k ? "text-white font-semibold" : "text-ink-2 hover:text-ink")}>
                {tab === k && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-[10px] bg-ink" transition={{ type: "spring", stiffness: 380, damping: 26 }} />}
                <span className="relative">{l}</span>{badge > 0 && <span className={cx("relative ml-1.5 rounded-full px-1.5 text-[12px] text-white", k === "checks" ? "bg-red" : "bg-amber")}>{badge}</span>}
              </button>
            );
          })}
        </div>

        <div className={cx("mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 items-start", tab === "stress" && !ev ? "" : "xl:grid-cols-[minmax(0,1fr)_440px]")}>
          <AnimatePresence mode="popLayout" custom={dir} initial={false}>
          <motion.div key={tab} custom={dir} variants={SLIDE} initial="from" animate="here" exit="gone" className="min-w-0 print-full">
            {tab === "overview" && <Overview goto={setTab} />}
            {tab === "spread" && <Spread key={review ? "review" : "all"} review={review} />}
            {tab === "checks" && <Checks />}
            {tab === "ratios" && <Ratios />}
            {tab === "stress" && (stressBase ? <StressLab base={stressBase} limits={limitsOf(c)} policy={c.policy_name} onPick={(code) => c.spread[code] && setEv(spreadEvidence(c, code, c.periods[0]))} /> : <p className="glass p-6">The stress test needs revenue, cost of sales, profit and equity. Some of them were not found in these statements.</p>)}
            {tab === "memo" && <MemoTab />}
            {tab === "audit" && (
              <Card className="p-5">
                <ol className="space-y-3">
                  {[...c.audit].reverse().map((a, i) => (
                    <li key={i} className="flex gap-4 text-sm">
                      <span className="num text-xs text-muted w-40 shrink-0">{new Date(a.ts).toLocaleString()}</span>
                      <span className="w-32 shrink-0 font-medium">{a.actor}</span>
                      <span className="w-36 shrink-0"><Badge>{a.action.replace(/_/g, " ")}</Badge></span>
                      <span className="text-ink-2">{a.detail}</span>
                    </li>
                  ))}
                </ol>
              </Card>
            )}
          </motion.div>
          </AnimatePresence>
          <aside className={cx("no-print glass !bg-white/75 overflow-hidden xl:top-5 xl:h-[calc(100vh-40px)] xl:rounded-[24px] xl:block",
            ev ? "fixed inset-x-0 bottom-0 top-16 z-50 rounded-t-[24px] shadow-[0_-20px_80px_rgba(0,0,0,0.35)] xl:inset-x-auto xl:bottom-auto xl:sticky xl:top-5 xl:shadow-none xl:z-auto" : tab === "stress" ? "!hidden" : "hidden xl:sticky")}>
            <EvidenceViewer key={ev?.key || "none"} c={c} ev={ev} onOpenKey={openKey} onClose={() => setEv(null)} />
          </aside>
        </div>
      </motion.div>
    </CaseCtx.Provider>
  );
}
