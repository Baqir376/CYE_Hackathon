"""Agentic analysis pipeline. Each step records a trace entry the UI shows live."""
from __future__ import annotations

import copy
import time
import traceback

from . import analysis, llm
from .mapper import map_rows
from .memo import write_memo
from .parser import UnreadablePDF, parse_document
from .store import now
from .taxonomy import TAXONOMY


class Tracer:
    def __init__(self, case, store):
        self.case, self.store = case, store
        self.case["trace"] = []

    def step(self, key, title):
        entry = {"key": key, "title": title, "status": "running", "detail": "", "started": time.time(), "ms": None}
        self.case["trace"].append(entry)
        self.store.save_case(self.case)
        return entry

    def done(self, entry, detail, status="done"):
        entry.update(status=status, detail=detail, ms=int((time.time() - entry["started"]) * 1000))
        self.store.save_case(self.case)


def _prefix_rows(rows, doc_idx, doc_id, unit=1):
    pre = f"D{doc_idx}:"
    for r in rows:
        r["unit"] = unit
        r["id"] = pre + r["id"]
        r["verified_sum_of"] = [pre + x for x in r.get("verified_sum_of", [])]
        r["doc_id"] = doc_id
    return rows


def effective_rows(case) -> list[dict]:
    rows = copy.deepcopy(case["rows"])
    ov = case.get("overrides", {})
    confirmed = case.get("confirmed", {})
    for r in rows:
        if r["id"] in confirmed and r.get("confidence") == "disputed":
            r["confidence"] = "analyst"
        o = ov.get(r["id"])
        if not o:
            continue
        if "code" in o:
            r["code"] = o["code"]
            r["confidence"] = "analyst"
            r["map_source"] = "analyst"
        for p, v in (o.get("values") or {}).items():
            if p in r["values"]:
                r["values"][p]["original"] = r["values"][p]["value"]
                r["values"][p]["value"] = v
                r["values"][p]["overridden"] = True
        r["overridden"] = True
    return rows


def analyze(case):
    """Deterministic part: rebuildable at any time after analyst overrides."""
    rows = effective_rows(case)
    docs = case["documents"]
    spreads, dups = [], []
    for d in docs:
        drows = [r for r in rows if r["doc_id"] == d["id"]]
        if not drows:
            continue
        sp, dup = analysis.build_spread(drows, d["periods"], d["unit"])
        spreads.append((d, sp))
        dups.extend(dup)
    # merge: the document with the most recent period wins for overlapping periods (restated comparatives)
    spreads.sort(key=lambda x: max(x[0]["periods"] or ["FY0"]), reverse=True)
    merged: dict = {}
    restated = []
    for d, sp in spreads:
        for code, item in sp.items():
            m = merged.setdefault(code, {**{k: v for k, v in item.items() if k != "values"}, "values": {}})
            for p, v in item["values"].items():
                v = {**v, "doc_id": d["id"]}
                if p not in m["values"]:
                    m["values"][p] = v
                else:
                    a, b = m["values"][p], v
                    if not a.get("derived") and not b.get("derived") and abs(a["value"] - b["value"]) > max(2000, abs(a["value"]) * 0.005):
                        restated.append({"code": code, "period": p, "kept": a["value"], "other": b["value"],
                                         "kept_doc": a["doc_id"], "other_doc": d["id"], "rows": a["rows"] + b["rows"]})
    periods = sorted({p for d in docs for p in d["periods"]}, reverse=True)
    analysis._derive(merged, periods)
    parsed_meta = {"scanned_pages": sum(d.get("scanned_pages", 0) for d in docs),
                   "rows": rows, "auditor_flags": [f for d in docs for f in d.get("auditor_flags", [])]}
    checks = analysis.validate(merged, rows, periods, parsed_meta, dups)
    for rs in restated:
        checks.append({"id": f"RESTATED:{rs['code']}:{rs['period']}", "status": "warn", "severity": "medium",
                       "check": f"{TAXONOMY.get(rs['code'], ('', rs['code']))[1]} for {rs['period']} differs between documents",
                       "period": rs["period"], "rows": rs["rows"], "expected": rs["other"], "actual": rs["kept"],
                       "difference": rs["kept"] - rs["other"],
                       "note": "Possible restatement or reclassification of comparatives. The later document's figure is used."})
    ratios = analysis.compute_ratios(merged, periods)
    policy = analysis.load_policy(case.get("policy") or "default")
    pol = analysis.apply_policy(ratios, periods, policy)
    signals = analysis.risk_signals(merged, ratios, periods)
    case.update(rows_effective=None, spread=merged, periods=periods, checks=checks, ratios=ratios,
                policy_results=pol, policy_name=policy.get("name"), policy_description=policy.get("description"),
                signals=signals, signal_count=len(signals),
                exception_count=sum(1 for c in checks if c["status"] in ("fail", "warn")))
    return case


def run_pipeline(case, store, use_llm=True):
    t = Tracer(case, store)
    case["status"] = "processing"
    try:
        all_rows, unreadable = [], []
        for i, d in enumerate(case["documents"], start=1):
            s = t.step(f"read{i}", f"Reading {d['filename']}")
            try:
                parsed = parse_document(store.document_path(case["id"], d["id"]))
            except UnreadablePDF as e:
                unreadable.append(f"{d['filename']}: {e}")
                d.update(periods=[], unit=1, statement_pages=[], scanned_pages=0, auditor_flags=[])
                t.done(s, str(e), "warn")
                continue
            d.update(pages=parsed["page_count"], scanned_pages=parsed["scanned_pages"], basis=parsed["basis"],
                     unit=parsed["unit"], periods=parsed["periods"], statement_pages=parsed["statement_pages"],
                     auditor_flags=[{**f, "doc_id": d["id"]} for f in parsed["auditor_flags"]],
                     company_guess=parsed["company_guess"])
            found = sorted({(p["statement"], p["page"]) for p in parsed["statement_pages"]}, key=lambda x: x[1])
            names = {"BS": "Balance sheet", "IS": "Profit & loss", "CF": "Cash flow"}
            if not found:
                t.done(s, f"{parsed['page_count']} pages, no financial statements found"
                          + (f" ({parsed['scanned_pages']} scanned pages without text)" if parsed["scanned_pages"] else ""), "warn")
                continue
            unit_txt = {1: "Rupees", 1000: "Rupees '000", 1_000_000: "Rupees million"}.get(parsed["unit"], str(parsed["unit"]))
            t.done(s, f"{parsed['page_count']} pages · found " + ", ".join(f"{names[a]} p.{b}" for a, b in found)
                   + f" · {parsed['basis']} · {unit_txt} · {', '.join(parsed['periods'])}")
            rows = _prefix_rows(parsed["rows"], i, d["id"], parsed["unit"])
            verified = sum(1 for r in rows if r.get("verified_sum_of"))
            s = t.step(f"extract{i}", "Extracting line items with page coordinates")
            t.done(s, f"{len(rows)} line items, {sum(len(r['values']) for r in rows)} figures; "
                      f"{verified} printed totals re-computed and matched")
            s = t.step(f"map{i}", "Classifying into spreading template (rules engine + AI, cross-checked)")
            mapped, info = map_rows(rows, use_llm=use_llm)
            if info.get("llm_used"):
                t.done(s, f"{info['mapped']}/{info['total']} rows mapped · rules & AI agree on {info['agree']} · "
                          f"{info['disputed']} disputed → analyst · model {info.get('model')} ({info.get('latency_ms')} ms)")
            else:
                t.done(s, f"{info['mapped']}/{info['total']} rows mapped by rules engine"
                          + (f" · AI unavailable: {info['llm_error'][:80]}" if info.get("llm_error") else " · AI not configured"),
                       "warn" if info.get("llm_error") else "done")
            d["mapping_info"] = info
            all_rows.extend(mapped)
        case["rows"] = all_rows
        case.setdefault("overrides", {})
        if not all_rows:
            raise UnreadablePDF(" ".join(unreadable) or "No financial statement tables could be read. "
                                "Upload a text-based PDF of audited financial statements.")
        if not case.get("borrower") or case["borrower"].lower() in ("", "auto"):
            case["borrower"] = next((d.get("company_guess") for d in case["documents"] if d.get("company_guess")), "Unnamed borrower")
        s = t.step("spread", "Building spread, running tie-outs, ratios and policy checks")
        analyze(case)
        fails = sum(1 for c in case["checks"] if c["status"] == "fail")
        passes = sum(1 for c in case["checks"] if c["status"] == "pass")
        t.done(s, f"{len(case['spread'])} template items · {passes} checks passed · {fails} failed · "
                  f"{len(case['signals'])} risk signals · policy: {case['policy_name']}")
        s = t.step("memo", "Drafting credit memo with number guard")
        case["memo"] = write_memo(case, case["spread"], case["ratios"], case["signals"], case["checks"], case["periods"], use_llm)
        st = case["memo"]["stats"]
        t.done(s, f"{case['memo']['engine'].upper()} draft · {st['numbers_checked']} figures checked · "
                  f"{st['verified']} sentences verified · {st['unverified']} blocked"
                  + (f" · AI error, used template: {case['memo']['llm_error'][:60]}" if case["memo"].get("llm_error") else ""))
        case["status"] = "ready"
        audit(case, "system", "analysis_completed", f"{len(all_rows)} rows, {len(case['checks'])} checks")
    except Exception as e:
        case["status"] = "failed"
        case["error"] = str(e) if isinstance(e, UnreadablePDF) else "Something went wrong while analysing this case. Please try again."
        case["error_trace"] = traceback.format_exc()[-2000:]
        if case.get("trace") and case["trace"][-1]["status"] == "running":
            case["trace"][-1].update(status="error", detail=case["error"])
    store.save_case(case)
    return case


def audit(case, actor, action, detail):
    case.setdefault("audit", []).append({"ts": now(), "actor": actor, "action": action, "detail": detail})


def llm_status():
    c = llm.config()
    return {"configured": llm.available(), "model": c["model"], "base_url": c["base_url"]}
