"use client";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useCallback } from "react";
import { api, CaseSummary, Meta } from "@/lib/api";
import { useServer } from "@/lib/useServer";
import { EASE } from "../motion/primitives";
import { Magnetic } from "../motion/pointer";
import { Glass } from "../fx/Glass";
import { Banner, Ribbon } from "../fx/Engrave";
import { Badge, cx, Spinner, STATUS_LABEL, statusTone } from "../ui";

const start = () => Promise.all([api.meta(), api.health(), api.cases()]);
type Start = Awaited<ReturnType<typeof start>>;
const STEPS = [
  ["Upload", "One or more PDFs of audited financial statements."],
  ["Watch", "Figures are read, checked and drafted. About 20 seconds for the sample."],
  ["Review", "Fix what was flagged, read the memo, submit it."],
];

export default function NewAnalysis() {
  const router = useRouter();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [health, setHealth] = useState<{ llm: { configured: boolean; model: string } } | null>(null);
  const [recent, setRecent] = useState<CaseSummary[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [borrower, setBorrower] = useState("");
  const [facility, setFacility] = useState("");
  const [policy, setPolicy] = useState("default");
  const [busy, setBusy] = useState<"upload" | "sample" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const ready = useCallback(([m, h, c]: Start) => { setMeta(m); setHealth(h); setRecent(c.slice(0, 3)); }, []);
  const waking = useServer(start, ready);

  function add(list: FileList | null) {
    if (!list) return;
    const pdfs = [...list].filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    setErr(pdfs.length < list.length ? "Only PDF files can be read. Other files were left out." : null);
    setFiles((p) => [...p, ...pdfs].slice(0, 4));
  }
  async function go(kind: "upload" | "sample") {
    setErr(null);
    setBusy(kind);
    try {
      if (kind === "sample") return router.push(`/app/cases/${(await api.sample(meta!.samples[0].id, policy)).id}`);
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      fd.append("borrower", borrower); fd.append("facility", facility); fd.append("policy", policy);
      router.push(`/app/cases/${(await api.create(fd)).id}`);
    } catch (e) { setErr((e as Error).message); setBusy(null); }
  }

  return (
    <div className="mx-auto max-w-[1120px] px-5 sm:px-8 pt-6 md:pt-9 pb-16">
      <Banner tint="#E6EEFC" className="px-7 sm:px-10 pt-9 pb-10">
      <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}
        className="font-display text-[clamp(34px,4.4vw,52px)] leading-[1.05]">New analysis</motion.h1>
      <ol className="mt-6 grid sm:grid-cols-3 gap-3">
        {STEPS.map(([t, d], i) => (
          <motion.li key={t} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 * i, duration: 0.5, ease: EASE }}
            className="flex gap-3 items-start">
            <span className={cx("h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-[15px] font-semibold", ["bg-magenta text-white", "bg-blue text-white", "bg-green text-white"][i])}>{i + 1}</span>
            <p className="text-[15px] leading-snug"><span className="font-semibold block">{t}</span><span className="text-ink-2">{d}</span></p>
          </motion.li>
        ))}
      </ol>
      </Banner>

      {waking && <p role="status" className="mt-6 rounded-2xl bg-amber-soft text-amber px-5 py-4 flex items-center gap-3"><Spinner className="shrink-0" />The analysis server is waking up, which can take about a minute. This page connects by itself.</p>}

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-5">
        <div className="min-w-0"><Glass delay={0.12} className="p-6">
          <button type="button" onClick={() => input.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
            className={cx("group relative overflow-hidden w-full rounded-[20px] border-2 border-dashed px-6 py-12 text-center transition-colors", drag ? "border-blue bg-teal-soft" : "border-[#b9c8b6] hover:border-blue " + "hover:bg-teal-soft/50 bg-paper/70")}>
            <Ribbon className="absolute inset-x-0 top-[6%] w-full h-[52%] opacity-70" />
            <input ref={input} type="file" accept="application/pdf" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
            <span className="relative mx-auto block h-[84px] w-[110px] [perspective:500px]" aria-hidden>
              {[0, 1, 2].map((i) => (
                <motion.span key={i} animate={{ rotateY: drag ? (i - 1) * 8 : (i - 1) * 24, x: drag ? (i - 1) * 4 : (i - 1) * 24, y: drag ? -6 : 0 }} transition={{ type: "spring", stiffness: 220, damping: 18 }}
                  className="absolute left-1/2 top-0 -ml-[30px] h-[80px] w-[60px] rounded-md bg-white border border-line shadow-lg p-2">
                  {[0, 1, 2, 3, 4].map((j) => <span key={j} className={cx("block h-[4px] rounded mb-[7px]", i === 1 && j === 2 ? "bg-magenta w-full" : "bg-ink/15")} style={{ width: `${90 - j * 9}%` }} />)}
                </motion.span>
              ))}
            </span>
            <span className="block mt-5 text-[19px] font-semibold">Drop financial statements here</span>
            <span className="block mt-1 text-[15px] text-muted">or click to choose PDFs, up to 4. A full annual report is fine.</span>
          </button>
          <AnimatePresence>
            {files.map((f, i) => (
              <motion.div key={f.name + f.size} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-paper px-4 py-2.5 text-[15px]">
                  <span className="truncate">{f.name}</span>
                  <span className="flex gap-4 text-muted shrink-0">{(f.size / 1048576).toFixed(1)} MB<button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="hover:text-red">Remove</button></span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div className="mt-5 grid sm:grid-cols-2 gap-4">
            <Field label="Borrower" hint="optional"><input className="fld" value={borrower} onChange={(e) => setBorrower(e.target.value)} placeholder="Detected from the statements" /></Field>
            <Field label="Facility requested" hint="optional"><input className="fld" value={facility} onChange={(e) => setFacility(e.target.value)} placeholder="Running finance, Rs 500 mn" /></Field>
            <Field label="Credit policy to test against" className="sm:col-span-2">
              <select className="fld" value={policy} onChange={(e) => setPolicy(e.target.value)}>
                {(meta?.policies || [{ id: "default", name: "Sample Corporate Credit Policy" }]).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          </div>
          {err && <p role="alert" className="mt-4 text-red">{err}</p>}
          <button onClick={() => go("upload")} disabled={!files.length || !!busy}
            className="mt-5 w-full rounded-[12px] bg-blue text-white py-3.5 text-[18px] font-bold transition-colors hover:bg-ink disabled:bg-line disabled:text-muted flex justify-center items-center gap-2">
            {busy === "upload" && <Spinner />}{busy === "upload" ? "Uploading" : files.length ? "Start analysis" : "Add a PDF to start"}
          </button>
        </Glass></div>

        <div className="min-w-0 flex flex-col gap-5">
          <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24, duration: 0.6, ease: EASE }}
            className="relative overflow-hidden rounded-[18px] bg-[#ffe4de] text-ink p-7">
            <Ribbon className="absolute inset-x-0 bottom-0 w-full h-[46%]" />
            <h2 className="relative font-note text-magenta text-[38px] leading-none">First time here?</h2>
            <p className="relative mt-2 text-[17px] leading-relaxed">Run the sample company. It&apos;s fictional and has real problems planted in it, including a subtotal that doesn&apos;t add up.</p>
            <div className="relative mt-5"><Magnetic>
              <button onClick={() => go("sample")} disabled={!meta?.samples.length || !!busy}
                className="shine note-btn bg-mustard text-ink disabled:opacity-60 gap-2">
                {busy === "sample" && <Spinner />}{busy === "sample" ? "Starting" : "Run the sample"}</button>
            </Magnetic></div>
          </motion.section>
          <section className="glass p-6 flex-1">
            <div className="flex justify-between items-baseline"><h2 className="text-[19px] font-semibold">Recent cases</h2><Link href="/app/cases" className="text-teal hover:underline">See all</Link></div>
            {recent.length === 0 && <p className="mt-3 text-muted">Your analyses will appear here.</p>}
            <ul className="mt-2">{recent.map((c) => (
              <li key={c.id}><Link href={`/app/cases/${c.id}`} className="flex items-center justify-between gap-3 py-2.5 border-t border-line first:border-0 hover:text-teal transition-colors">
                <span className="truncate">{c.borrower === "auto" ? "Reading" : c.borrower}</span><Badge tone={statusTone(c.status)}>{STATUS_LABEL[c.status] || c.status}</Badge></Link></li>
            ))}</ul>
          </section>
          {health && <p className="text-[14px] text-muted px-2">{health.llm.configured
            ? "The PDF is never sent to the AI. Line labels and extracted figures go to Groq to classify rows and draft wording."
            : "No AI key set: rows are classified by rules and the memo uses a template."}</p>}
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return <label className={cx("block min-w-0 text-[15px] font-medium", className)}>{label}{hint && <span className="text-muted font-normal"> {hint}</span>}<span className="block mt-1.5 font-normal">{children}</span></label>;
}
