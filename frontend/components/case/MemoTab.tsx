"use client";
import { Fragment, useState } from "react";
import { api, Case, ratio } from "@/lib/api";
import { factEvidence } from "@/lib/evidence";
import { Ribbon } from "../fx/Engrave";
import { Badge, Btn, Card, cx, Spinner } from "../ui";
import { press, useCase } from "./shared";

const CITE = /\[((?:F|R|S):[A-Za-z0-9_.]+:FY\d{4})\]/g;

function SentenceView({ text }: { text: string }) {
  const { c, open, activeKey } = useCase();
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  const re = new RegExp(CITE.source, "g");
  while ((m = re.exec(text))) {
    parts.push(<Fragment key={`t${n}`}>{text.slice(last, m.index).replace(/\s+$/, "")}</Fragment>);
    const fid = m[1];
    const ev = factEvidence(c, fid);
    n++;
    parts.push(
      <sup key={`c${n}`} {...(ev ? press(() => open(ev)) : {})} aria-label={`${fid.startsWith("S:") ? "signal" : fid.startsWith("R:") ? "calc" : "src"}: ${c.memo?.facts[fid]?.label || fid}`} onClick={() => ev && open(ev)} title={c.memo?.facts[fid]?.label || fid}
        className={cx("cursor-pointer ml-0.5 mr-0.5 rounded px-1 text-[12px] font-semibold num align-super",
          activeKey === ev?.key ? "bg-lemon text-ink" : "bg-teal-soft text-teal hover:bg-teal hover:text-white")}>
        {fid.startsWith("S:") ? "signal" : fid.startsWith("R:") ? "calc" : "src"}
      </sup>,
    );
    last = m.index + m[0].length;
  }
  parts.push(<Fragment key="end">{text.slice(last)}</Fragment>);
  return <>{parts}</>;
}

export default function MemoTab() {
  const { c, setCase, actor, llm } = useCase();
  const memo = c.memo;
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  if (!memo) return <p className="text-sm text-muted">Memo not generated yet.</p>;
  const [cur] = c.periods;

  async function regen(useLlm: boolean) {
    setBusy(useLlm ? "llm" : "tpl");
    try { setCase(await api.post<Case>(`/api/cases/${c.id}/memo/regenerate`, { use_llm: useLlm, actor })); } finally { setBusy(null); }
  }
  async function saveEdit(i: number) {
    setBusy("edit");
    try { setCase(await api.post<Case>(`/api/cases/${c.id}/memo/edit`, { section: i, body: draft, actor })); setEditing(null); } finally { setBusy(null); }
  }
  const letter = `Dear Sir/Madam,\n\nWith reference to your financing request, please provide the following to complete our credit assessment:\n\n${memo.questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\nRegards,\n${actor}\nCorporate Credit`;

  return (
    <div className="space-y-4">
      <Card className="p-4 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge tone="ink">{memo.engine === "llm" ? `AI draft · ${memo.llm_meta?.model}` : "Template draft (deterministic)"}</Badge>
            <span className="text-sm"><span className="num font-semibold">{memo.stats.numbers_checked}</span> figures checked against their sources</span>
            <Badge tone="green">{memo.stats.verified} sentences verified</Badge>
            <Badge tone={memo.stats.unverified ? "red" : "gray"}>{memo.stats.unverified} blocked</Badge>
            {!!memo.stats.narrative && <Badge title="No figures in these sentences, so there is nothing to verify. Read them yourself.">{memo.stats.narrative} qualitative</Badge>}
            {memo.stale && <Badge tone="amber">Spread changed since this draft</Badge>}
          </div>
          <div className="flex gap-2">
            {llm && <Btn variant="outline" onClick={() => regen(true)} disabled={!!busy}>{busy === "llm" ? <Spinner /> : null} Redraft with AI</Btn>}
            <Btn variant="outline" onClick={() => regen(false)} disabled={!!busy}>{busy === "tpl" && <Spinner />}Template draft</Btn>
            <Btn onClick={() => window.print()}>Print / PDF</Btn>
          </div>
        </div>
        {memo.llm_error && <p className="text-xs text-amber mt-2">AI unavailable, so the deterministic template was used: {memo.llm_error}</p>}
      </Card>

      <Card className="relative overflow-hidden p-8 sm:p-12 print-full !bg-white print:!p-0">
        <Ribbon className="absolute right-0 top-0 w-[58%] h-[104px] print:hidden [mask-image:linear-gradient(90deg,transparent,black_70%)]" />
        <div className="relative border-b-2 border-ink pb-4 mb-6">
          <p className="text-[13px] text-teal font-semibold">Credit analysis memorandum · Draft for analyst review</p>
          <h2 className="font-serif text-[28px] font-semibold mt-1">{c.borrower}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-xs">
            <div><p className="text-muted">Facility requested</p><p className="font-medium">{c.facility || "Not specified"}</p></div>
            <div><p className="text-muted">Periods analysed</p><p className="font-medium num">{c.periods.join(", ")}</p></div>
            <div><p className="text-muted">Policy</p><p className="font-medium">{c.policy_name}</p></div>
            <div><p className="text-muted">Prepared by</p><p className="font-medium">{c.analyst} · CredIQ</p></div>
          </div>
        </div>

        <h3 className="font-serif text-lg font-semibold">Key figures</h3>
        <table className="w-full text-sm mt-2 mb-6">
          <tbody>
            {[["Net revenue", "IS.REVENUE"], ["Net profit", "IS.NET_PROFIT"], ["Operating cash flow", "CF.CFO"], ["Total assets", "BS.TOTAL_ASSETS"], ["Total equity", "BS.TOTAL_EQUITY"], ["Interest-bearing debt", "X.TOTAL_DEBT"]]
              .filter(([, k]) => c.spread[k]).map(([l, k]) => (
                <tr key={k} className="border-b border-line/70">
                  <td className="py-1.5">{l} (Rs mn)</td>
                  {c.periods.map((p) => <td key={p} className="py-1.5 text-right num">{c.spread[k].values[p] ? (c.spread[k].values[p].value / 1e6).toLocaleString("en-US", { maximumFractionDigits: 1 }) : "—"} <span className="text-[12px] text-muted">{p}</span></td>)}
                </tr>
              ))}
            {["current_ratio", "debt_to_equity", "interest_cover", "dscr"].filter((k) => c.ratios[k]?.values[cur] !== undefined).map((k) => (
              <tr key={k} className="border-b border-line/70">
                <td className="py-1.5">{c.ratios[k].name}</td>
                {c.periods.map((p) => <td key={p} className="py-1.5 text-right num">{ratio(c.ratios[k].values[p], c.ratios[k].unit)} <span className="text-[12px] text-muted">{p}</span></td>)}
              </tr>
            ))}
          </tbody>
        </table>

        {memo.sections.map((s, i) => (
          <section key={i} className="mb-6 group">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg font-semibold">{s.title}</h3>
              {editing !== i && <button className="no-print text-xs text-teal transition" onClick={() => { setEditing(i); setDraft(s.sentences.map((x) => x.text).join(" ")); }}>Edit section</button>}
            </div>
            {editing === i ? (
              <div className="mt-2 no-print">
                <textarea aria-label={`Edit ${s.title}`} value={draft} onChange={(e) => setDraft(e.target.value)} rows={6} className="w-full rounded-lg border border-line p-3 text-sm num" />
                <p className="text-xs text-muted mt-1">Keep the [F:…] citations after each figure. Each figure must match the source it cites, or its sentence is blocked.</p>
                <div className="flex gap-2 mt-2"><Btn onClick={() => saveEdit(i)} disabled={busy === "edit"}>Save & verify</Btn><Btn variant="ghost" onClick={() => setEditing(null)}>Cancel</Btn></div>
              </div>
            ) : (
              <p className="mt-2 text-[15px] leading-7 text-ink">
                {s.sentences.map((sen, j) => (
                  <span key={j} className={cx(sen.status === "unverified" && "bg-red-soft text-red line-through decoration-red/50 print:hidden")}
                    title={sen.problems.join("; ")}>
                    <SentenceView text={sen.text} />{" "}
                    {sen.status === "unverified" && <span className="no-print not-italic no-underline text-[12px] font-semibold uppercase bg-red text-white rounded px-1 mr-1">blocked: {sen.problems[0]}</span>}
                  </span>
                ))}
              </p>
            )}
            {s.edited_by && <p className="text-[13px] text-muted mt-1">Edited by {s.edited_by}</p>}
          </section>
        ))}

        <section className="mb-6">
          <h3 className="font-serif text-lg font-semibold">Data exceptions</h3>
          <ul className="mt-2 text-sm list-disc pl-5 space-y-1">
            {c.checks.filter((x) => x.status === "fail" || x.status === "warn").map((x) => (
              <li key={x.id}>{x.check}{x.period ? ` (${x.period})` : ""}{c.overrides[x.rows?.[0] || ""] ? " · corrected by analyst" : ""}</li>
            ))}
            {!c.checks.some((x) => x.status === "fail" || x.status === "warn") && <li>None. All tie-outs passed.</li>}
          </ul>
        </section>

        <section className="mb-6">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-lg font-semibold">Information requested from the borrower</h3>
            <button className="no-print text-xs text-teal" onClick={() => { navigator.clipboard.writeText(letter); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
              {copied ? "Copied ✓" : "Copy as letter"}
            </button>
          </div>
          <ol className="mt-2 text-sm list-decimal pl-5 space-y-1">{memo.questions.map((q, i) => <li key={i}>{q}</li>)}</ol>
        </section>

        <section className="rounded-lg border-2 border-dashed border-line p-4">
          <h3 className="font-serif text-lg font-semibold">Analyst recommendation</h3>
          <p className="text-sm text-muted mt-1">To be completed by the credit analyst. CredIQ does not recommend approval or decline; the credit decision stays with the bank&apos;s authorised officers.</p>
        </section>
      </Card>
    </div>
  );
}
