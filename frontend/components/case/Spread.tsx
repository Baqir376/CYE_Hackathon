"use client";
import { useState } from "react";
import { api, Case, money, Row, STMT_NAME } from "@/lib/api";
import { rowEvidence, rowById, spreadEvidence } from "@/lib/evidence";
import { Badge, Btn, Card, cx, statusTone } from "../ui";
import { Evi, Modal, stmtOf, TABLE_ORDER, useCase } from "./shared";
import { motion } from "motion/react";

const CONF_LABEL: Record<string, string> = { high: "rules + AI agree", medium: "single source", disputed: "disputed", analyst: "analyst" };

export default function Spread({ review }: { review?: boolean }) {
  const [view, setView] = useState<"template" | "lines">(review ? "lines" : "template");
  const { c } = useCase();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-lg border border-line bg-card p-0.5 text-sm">
          {(["template", "lines"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={cx("px-3 py-1 rounded-md", view === v ? "bg-ink text-white" : "text-ink-2")}>
              {v === "template" ? "Spreading template" : `Extracted lines (${c.rows.length})`}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">Figures in Rs million. Click any figure to see its source.</p>
      </div>
      {view === "template" ? <TemplateView /> : <LinesView review={review} />}
    </div>
  );
}

function TemplateView() {
  const { c, taxonomy, flash } = useCase();
  const order = TABLE_ORDER(taxonomy, Object.keys(c.spread));
  const groups = ["BS", "IS", "CF"].map((s) => ({ s, codes: order.filter((code) => stmtOf(code) === s) }));
  const [cur, prev] = c.periods;
  return (
    <div className="space-y-4">
      {groups.map((g) => g.codes.length > 0 && (
        <Card key={g.s} className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-paper/70 text-xs text-muted">
                <th className="text-left px-4 py-2 font-semibold text-ink">{STMT_NAME[g.s]}</th>
                {c.periods.map((p) => <th key={p} className="text-right px-4 py-2 font-medium num w-32">{p}</th>)}
                {prev && <th className="text-right px-4 py-2 font-medium w-20">YoY</th>}
                <th className="text-left px-4 py-2 font-medium w-56">Source</th>
              </tr>
            </thead>
            <tbody>
              {g.codes.map((code) => {
                const it = c.spread[code];
                const isTotal = /TOTAL|GROSS_PROFIT|NET_PROFIT|PBT|CFO|CFI|CFF|CASH_END|EBIT/.test(code);
                const v0 = it.values[cur]?.value, v1 = prev ? it.values[prev]?.value : undefined;
                const yoy = v0 !== undefined && v1 ? (v0 - v1) / Math.abs(v1) : null;
                const srcRows = Object.values(it.values).flatMap((v) => v.rows).map((id) => rowById(c, id)).filter(Boolean) as Row[];
                const derived = Object.values(it.values).some((v) => v.derived);
                const confs = new Set(srcRows.map((r) => r.confidence));
                const worst = confs.has("disputed") ? "disputed" : confs.has("medium") ? "medium" : confs.has("analyst") ? "analyst" : confs.has("high") ? "high" : null;
                const edited = srcRows.some((r) => c.overrides[r.id]);
                return (
                  <tr key={code} className={cx("border-t border-line/70", isTotal && "bg-paper/40 font-semibold")}>
                    <td className={cx("px-4 py-1.5", !isTotal && "pl-6")}>{it.name}</td>
                    {c.periods.map((p) => (
                      <td key={p} className="px-4 py-1.5 text-right num">
                        {it.values[p] ? <motion.span key={`${it.values[p].value}`} className="inline-block rounded px-1 -mx-1"
                          initial={flash.has(`${code}:${p}`) ? { backgroundColor: "rgba(244,211,94,1)", scale: 1.08 } : false}
                          animate={{ backgroundColor: "rgba(244,211,94,0)", scale: 1 }} transition={{ duration: 2.2, ease: "easeOut" }}>
                          <Evi ev={spreadEvidence(c, code, p)}>{money(it.values[p].value)}</Evi></motion.span> : <span className="text-muted">—</span>}
                      </td>
                    ))}
                    {prev && <td className={cx("px-4 py-1.5 text-right num text-xs", yoy === null ? "text-muted" : yoy >= 0 ? "text-ink-2" : "text-ink-2")}>
                      {yoy === null ? "—" : `${yoy >= 0 ? "+" : ""}${(yoy * 100).toFixed(1)}%`}</td>}
                    <td className="px-4 py-1.5">
                      <div className="flex gap-1 flex-wrap">
                        {derived ? <Badge tone="gray">derived</Badge> : <Badge tone="gray">{new Set(srcRows.map((r) => r.id)).size} line{new Set(srcRows.map((r) => r.id)).size > 1 ? "s" : ""} · p.{[...new Set(srcRows.map((r) => r.page))].join(",")}</Badge>}
                        {worst && <Badge tone={worst === "high" ? "green" : statusTone(worst)}>{CONF_LABEL[worst]}</Badge>}
                        {edited && <Badge tone="teal">edited</Badge>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}

function LinesView({ review }: { review?: boolean }) {
  const { c, taxonomy } = useCase();
  const [edit, setEdit] = useState<Row | null>(null);
  const [filter, setFilter] = useState<"all" | "review" | "unmapped">(review ? "review" : "all");
  const rows = c.rows.filter((r) => filter === "all" ? true : filter === "unmapped" ? !r.code : (r.confidence === "disputed" || r.confidence === "medium"));
  const pages = [...new Set(rows.map((r) => `${r.doc_id}|${r.page}|${r.statement}`))];
  const nameOf = (code: string | null) => taxonomy.find((t) => t.code === code)?.name;
  return (
    <>
      <div className="flex gap-2 text-xs">
        {(["all", "review", "unmapped"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cx("rounded-full border px-3 py-1", filter === f ? "bg-ink text-white border-ink" : "border-line bg-card")}>
            {f === "all" ? "All lines" : f === "review" ? "Needs review" : "Not used in spread"}
          </button>
        ))}
      </div>
      {pages.map((pk) => {
        const [doc, page, st] = pk.split("|");
        const prs = rows.filter((r) => r.doc_id === doc && String(r.page) === page);
        const periods = [...new Set(prs.flatMap((r) => Object.keys(r.values)))].sort().reverse();
        return (
          <Card key={pk} className="overflow-x-auto">
            <div className="px-4 py-2 bg-paper/70 text-xs flex justify-between">
              <span className="font-semibold">{STMT_NAME[st]} · page {page}</span>
              <span className="text-muted">{c.documents.find((d) => d.id === doc)?.filename} · as printed</span>
            </div>
            <table className="w-full text-[13px]">
              <tbody>
                {prs.map((r) => {
                  const confirmed = c.confirmed?.[r.id];
                  return (
                    <tr key={r.id} className={cx("border-t border-line/60", !r.code && "text-muted")}>
                      <td className="px-4 py-1.5">
                        <span className={cx(r.is_subtotal && "italic")}>{r.label}</span>
                        {r.note && <span className="ml-1.5 text-[13px] text-muted">note {r.note}</span>}
                        {r.verified_sum_of.length > 0 && <Badge tone="green" className="ml-2" title="Printed total equals the sum of its component lines">Σ verified</Badge>}
                        {r.is_subtotal && r.verified_sum_of.length === 0 && <Badge tone="red" className="ml-2">Σ mismatch</Badge>}
                      </td>
                      {periods.map((p) => (
                        <td key={p} className="px-3 py-1.5 text-right num w-28">
                          {r.values[p] ? <Evi ev={rowEvidence(c, r, p)} className={cx(r.values[p].overridden && "text-teal font-semibold")}>{r.values[p].raw}</Evi> : ""}
                        </td>
                      ))}
                      <td className="px-3 py-1.5 w-64">
                        {r.code ? <span className="text-ink-2">{nameOf(r.code)}</span> : <span className="text-muted">—</span>}
                        {r.confidence && <Badge tone={r.confidence === "high" ? "green" : statusTone(r.confidence)} className="ml-1.5" title={`rules: ${r.rule_code || "none"} · AI: ${r.ai_code || "none"}`}>
                          {CONF_LABEL[r.confidence]}</Badge>}
                        {confirmed && <Badge tone="teal" className="ml-1">✓ {confirmed.actor}</Badge>}
                      </td>
                      <td className="px-3 py-1.5 text-right w-36 whitespace-nowrap">
                        {r.confidence === "disputed" && !confirmed && !c.overrides[r.id] && <ConfirmBtn r={r} />}
                        <button onClick={() => setEdit(r)} className="text-xs text-teal hover:underline ml-2">Edit</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        );
      })}
      {edit && <EditRow r={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function ConfirmBtn({ r }: { r: Row }) {
  const { c, setCase, actor } = useCase();
  return <button className="text-xs rounded border border-amber/40 text-amber px-2 py-0.5 hover:bg-amber-soft"
    onClick={async () => setCase(await api.post<Case>(`/api/cases/${c.id}/confirm`, { row_id: r.id, actor }))}>Confirm</button>;
}

export function EditRow({ r, onClose, preset }: { r: Row; onClose: () => void; preset?: { period: string; value: number; reason: string } }) {
  const { c, setCase, actor, taxonomy } = useCase();
  const [code, setCode] = useState<string>(r.code || "");
  const [period, setPeriod] = useState(preset?.period || Object.keys(r.values)[0]);
  const [value, setValue] = useState(preset ? String(preset.value) : "");
  const [reason, setReason] = useState(preset?.reason || "");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const opts = taxonomy.filter((t) => t.statement === r.statement);
  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = { row_id: r.id, reason, actor };
      if ((code || null) !== r.code) { body.set_code = true; body.code = code || null; }
      if (value.trim() !== "") { body.period = period; body.value = Number(value.replace(/,/g, "")); }
      setCase(await api.post<Case>(`/api/cases/${c.id}/overrides`, body));
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Correct line item" onClose={onClose}>
      <p className="text-sm font-medium">{r.label}</p>
      <p className="text-xs text-muted">Page {r.page} · printed: {Object.entries(r.values).map(([p, v]) => `${p} ${v.raw}`).join(" · ")}</p>
      <label className="block text-xs text-ink-2 mt-4">Template classification
        <select value={code} onChange={(e) => setCode(e.target.value)} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm">
          <option value="">— not used in spread —</option>
          {opts.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-[120px_1fr] gap-3 mt-3">
        <label className="text-xs text-ink-2">Period
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm">
            {Object.keys(r.values).map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
        <label className="text-xs text-ink-2">Corrected value (printed units, optional)
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={r.values[period]?.raw}
            className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm num" />
        </label>
      </div>
      <label className="block text-xs text-ink-2 mt-3">Reason (recorded in the audit trail)
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="e.g. Confirmed with management accounts"
          className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm" />
      </label>
      {err && <p className="text-sm text-red mt-2">{err}</p>}
      <div className="flex justify-end gap-2 mt-4">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save} disabled={busy || !reason.trim()}>Save & recompute</Btn>
      </div>
    </Modal>
  );
}
