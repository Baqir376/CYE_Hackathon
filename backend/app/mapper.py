"""Two independent mappers (deterministic rules + LLM) that classify parsed rows into the spreading template.

The LLM only returns row IDs -> template codes. It never sees a request to produce numbers, and any number
in the spread comes from the parser. Where the two mappers disagree, the row is flagged for analyst review.
"""
from __future__ import annotations

from . import llm
from .taxonomy import TAXONOMY, describe_taxonomy, rule_map

SYSTEM = """You are a senior corporate credit analyst at a Pakistani bank doing financial spreading.
You map line items from a company's audited financial statements (IFRS as applicable in Pakistan) to a
bank's standard spreading template. You NEVER invent or modify numbers. You only classify rows by id.
Rules:
- Use only codes from the template. Use null when a row does not belong to any code (e.g. EPS, authorised capital,
  partial subtotals, memo lines).
- A code marked as a total (TOTAL_*, GROSS_PROFIT, PBT, NET_PROFIT, CFO, CFI, CFF, CASH_END, REVENUE) must be
  assigned to at most ONE row per statement.
- Never assign both a subtotal and its component lines to the same additive code.
- "Grand total" rows on a balance sheet page are either BS.TOTAL_ASSETS or BS.TOTAL_EQ_LIAB depending on the side.
- Authorised capital is NOT share capital (null). Gross sales before sales tax is NOT revenue; use net sales.
- Cost of sales may be printed as a subtotal of operating costs + royalty etc.; map that subtotal to IS.COGS.
Return one compact JSON object mapping row number to code, leaving out rows that have no code: {"1":"BS.PPE","4":"BS.CASH"}"""


def llm_map(rows: list[dict]) -> tuple[dict[str, str | None], dict]:
    """One call for all statements. Rows are numbered to keep the prompt and the reply small (free-tier token limits)."""
    parts, index = [], {}
    for stmt, title in (("BS", "BALANCE SHEET"), ("IS", "PROFIT OR LOSS"), ("CF", "CASH FLOW")):
        srows = [r for r in rows if r["statement"] == stmt]
        if not srows:
            continue
        parts.append(f"{title} codes: " + "; ".join(f"{c}={v[1]}" for c, v in TAXONOMY.items() if v[0] == stmt))
        section = None
        for r in srows:
            if r["section"] != section:
                section = r["section"]
                parts.append(f"# {section[:40]}")
            n = len(index) + 1
            index[str(n)] = r
            first = next(iter(r["values"].values()))["raw"] if r["values"] else ""
            parts.append(f"{n} {r['label'][:70]} | {first}")
    if not index:
        return {}, {"calls": 0, "model": None, "latency_ms": 0, "tokens": 0}
    data, meta = llm.chat_json([{"role": "system", "content": SYSTEM}, {"role": "user", "content": "\n".join(parts)}],
                               max_tokens=1800)
    if isinstance(data.get("mappings"), dict):
        data = data["mappings"]
    out: dict[str, str | None] = {r["id"]: None for r in index.values()}
    for n, code in data.items():
        r = index.get(str(n))
        if r and code in TAXONOMY and TAXONOMY[code][0] == r["statement"]:
            out[r["id"]] = code
    return out, {"calls": 1, "model": meta["model"], "latency_ms": meta["latency_ms"],
                 "tokens": (meta.get("usage") or {}).get("total_tokens", 0)}


def map_rows(rows: list[dict], use_llm: bool = True) -> tuple[list[dict], dict]:
    sections_by_page: dict[int, set[str]] = {}
    for r in rows:
        sections_by_page.setdefault(r["page"], set()).add(r["section"])
    rule = {r["id"]: rule_map(r, sections_by_page[r["page"]]) for r in rows}
    info = {"llm_used": False, "llm_error": None}
    ai: dict[str, str | None] = {}
    if use_llm and llm.available():
        try:
            ai, meta = llm_map(rows)
            info.update(llm_used=True, **meta)
        except Exception as e:  # degrade gracefully to rules only
            info["llm_error"] = str(e)[:300]
    mapped = []
    agree = dispute = only_rule = only_ai = 0
    for r in rows:
        rc, ac = rule[r["id"]], ai.get(r["id"]) if info["llm_used"] else None
        if info["llm_used"]:
            if rc and ac and rc == ac:
                code, conf, src = rc, "high", "rules+ai"
                agree += 1
            elif rc and ac and rc != ac:
                code, conf, src = rc, "disputed", "rules"  # never let the AI silently override the deterministic rule
                dispute += 1
            elif ac and not rc:
                code, conf, src = ac, "medium", "ai"
                only_ai += 1
            elif rc and not ac:
                code, conf, src = rc, "medium", "rules"
                only_rule += 1
            else:
                code, conf, src = None, None, None
        else:
            code, conf, src = (rc, "medium", "rules") if rc else (None, None, None)
        mapped.append({**r, "code": code, "confidence": conf, "map_source": src,
                       "rule_code": rc, "ai_code": ac if info["llm_used"] else None})
    info.update(agree=agree, disputed=dispute, rules_only=only_rule, ai_only=only_ai,
                mapped=sum(1 for m in mapped if m["code"]), total=len(mapped))
    return mapped, info


__all__ = ["map_rows", "describe_taxonomy"]
