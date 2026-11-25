"""Credit memo drafting. Figures are inserted by Python, then every sentence passes the number guard (guard.py).

The LLM receives a fact sheet and writes placeholders such as {{F:IS.REVENUE:FY2026}}; it is told to type no digits, and
any digit it types anyway is blocked. Without an LLM a deterministic template writer produces the memo.
"""
from __future__ import annotations

import re

from . import llm
from .analysis import fmt_money, fmt_ratio
from .guard import guard, stats

# printed in brackets in Pakistani statements; prose says "finance cost was Rs 342.0 mn", not "-Rs 342.0 mn"
COST_CODES = {"IS.COGS", "IS.DISTRIBUTION", "IS.ADMIN", "IS.OTHER_OPEX", "IS.FINANCE_COST", "CF.CAPEX", "CF.DIVIDENDS_PAID",
              "CF.DEBT_REPAID"}


def build_facts(spread, ratios, periods, signals=()) -> dict[str, dict]:
    facts = {}
    cur = periods[0] if periods else "FY0000"
    for sg in signals:  # engine-computed signal statements are trusted facts too
        facts[f"S:{sg['id']}:{cur}"] = {"label": sg["title"], "display": sg["detail"], "value": None,
                                        "kind": "signal", "code": sg["id"], "period": cur}
    for code, item in spread.items():
        for p, v in item["values"].items():
            facts[f"F:{code}:{p}"] = {"label": f"{item['name']} {p}", "display": fmt_money(abs(v["value"]) if code in COST_CODES else v["value"]),
                                      "value": v["value"], "kind": "fact", "code": code, "period": p,
                                      "cost": code in COST_CODES}
    for key, r in ratios.items():
        for p, v in r["values"].items():
            facts[f"R:{key}:{p}"] = {"label": f"{r['name']} {p}", "display": fmt_ratio(v, r["unit"]),
                                     "value": v, "kind": "ratio", "code": key, "period": p}
    return facts


# ----------------------------------------------------------------------------- template writer (no LLM)
def _f(facts, fid):
    return f"{facts[fid]['display']} [{fid}]" if fid in facts else None


def template_sections(case, facts, signals, checks, periods) -> list[dict]:
    cur = periods[0] if periods else ""
    prev = periods[1] if len(periods) > 1 else None
    F = lambda code, p=cur: _f(facts, f"F:{code}:{p}")  # noqa: E731
    R = lambda key, p=cur: _f(facts, f"R:{key}:{p}")  # noqa: E731
    sec = []
    perf = []
    if F("IS.REVENUE"):
        s = f"Net revenue for {cur} was {F('IS.REVENUE')}"
        if prev and F("IS.REVENUE", prev):
            s += f", compared with {F('IS.REVENUE', prev)} in {prev}"
            if R("revenue_growth"):
                s += f" (revenue growth of {R('revenue_growth')})"
        perf.append(s + ".")
    if R("gross_margin"):
        perf.append(f"Gross margin was {R('gross_margin')}" + (f" against {R('gross_margin', prev)} in the prior year." if prev and R('gross_margin', prev) else "."))
    if F("IS.NET_PROFIT"):
        perf.append(f"Net profit after tax was {F('IS.NET_PROFIT')}" + (f", a net margin of {R('net_margin')}." if R("net_margin") else "."))
    sec.append({"title": "Financial performance", "body": " ".join(perf) or "Income statement items were not found."})
    pos = []
    if F("BS.TOTAL_ASSETS"):
        pos.append(f"Total assets stood at {F('BS.TOTAL_ASSETS')} with total equity of {F('BS.TOTAL_EQUITY') or 'an unknown amount'}.")
    if R("debt_to_equity") is not None and facts.get(f"F:X.TOTAL_DEBT:{cur}", {}).get("value"):
        pos.append(f"Interest-bearing debt was {F('X.TOTAL_DEBT')}, giving a debt-to-equity ratio of {R('debt_to_equity')}.")
    elif F("X.TOTAL_DEBT"):
        pos.append("No interest-bearing borrowings were identified on the balance sheet.")
    if R("leverage"):
        pos.append(f"Total liabilities to equity was {R('leverage')}.")
    sec.append({"title": "Financial position & leverage", "body": " ".join(pos) or "Balance sheet items were not found."})
    liq = []
    if R("current_ratio"):
        liq.append(f"The current ratio was {R('current_ratio')}" + (f" and the quick ratio {R('quick_ratio')}." if R("quick_ratio") else "."))
    if F("CF.CFO"):
        liq.append(f"Cash flow from operations was {F('CF.CFO')}" + (f", a cash conversion of {R('cash_conversion')}." if R("cash_conversion") else "."))
    if R("interest_cover"):
        liq.append(f"Interest cover was {R('interest_cover')}.")
    if R("receivable_days"):
        liq.append(f"Receivable days were {R('receivable_days')}.")
    sec.append({"title": "Liquidity, cash flow & debt service", "body": " ".join(liq) or "Cash-flow items were not found."})
    return sec


def borrower_questions(signals, checks) -> list[str]:
    q = []
    m = {
        "RECV_OUTPACE": "Please provide an ageing analysis of trade debts and explain why receivables grew faster than sales.",
        "NEG_CFO": "Please explain the negative operating cash flow and provide a 12-month cash-flow projection.",
        "LOW_CASH_CONV": "Please reconcile reported profit with operating cash flow (working-capital movements).",
        "MARGIN_SQUEEZE": "What drove the decline in gross margin, and is it expected to persist?",
        "LEVERAGE_UP": "Please share the purpose and repayment schedule of new borrowings during the year.",
        "COVER_DOWN": "How will finance costs be serviced if policy rates remain at current levels?",
        "WC_DEFICIT": "How is the working-capital deficit being funded, and which facilities are due for renewal?",
        "ST_RELIANCE": "Please provide the renewal dates and limits of all short-term running finance facilities.",
        "INV_BUILD": "Please provide an inventory ageing report and explain the build-up in stock.",
        "OTHER_INCOME": "Please break down other income and confirm which components are recurring.",
        "NET_LOSS": "Please explain the net loss and management's plan to return to profitability.",
        "REV_DECLINE": "Please explain the decline in revenue and provide current-year sales to date.",
    }
    for s in signals:
        base = s["id"].split("_FY")[0]
        if base.startswith("PAYOUT"):
            txt = "Please confirm the dividend policy while the proposed facility is outstanding."
        else:
            txt = m.get(base)
        if txt and txt not in q:
            q.append(txt)
    for c in checks:
        if c["status"] == "fail" and c["id"].startswith(("BS_", "IS_", "CF_SUM", "ARITH:")):
            t = f"Please clarify a reconciliation difference: {c['check']}" + (f" ({c['period']})." if c.get("period") else ".")
            if t not in q:
                q.append(t)
        if c["id"].startswith("AUDIT:") and c["severity"] in ("high", "medium"):
            q.append(f"Please provide management's response to the auditor's report ({c['check'].lower()}).")
    return q[:10]


# ----------------------------------------------------------------------------- LLM writer
SYSTEM = """You are a senior credit analyst at a Pakistani commercial bank writing the financial analysis
sections of an internal credit memo. Tone: precise, neutral, professional; no hype; no recommendation to approve
or decline (that is the human approver's job).
STRICT RULES:
1. NEVER type a digit or a number word (doubled, half, million, percent). Wherever a figure belongs, write its id in double
   curly braces and the system inserts the figure. Example: "Net revenue was {{f1}}, up from {{f2}}."
   Apart from ids, the only digits allowed are period labels such as FY2026.
2. Name the item in words directly before its placeholder, and only use ids from the FACT SHEET.
3. In one sentence compare one item across years, or state related items each with its own name. Keep sentences short.
4. For a risk signal write only "Title: {{s1}}." because the system inserts the full wording. Add your interpretation
   in the next sentence, without figures.
5. Check direction: "rose" / "fell" must agree with the two values shown.
6. Interpret what the figures mean for repayment capacity.
Return JSON: {"sections":[{"title":"Financial performance","body":"..."},{"title":"Financial position & leverage","body":"..."},
{"title":"Liquidity, cash flow & debt service","body":"..."},{"title":"Key risks & mitigants to explore","body":"..."}]}"""


# what a credit memo normally discusses; keeps the prompt inside free-tier limits
MEMO_FACTS = ["IS.REVENUE", "IS.COGS", "IS.GROSS_PROFIT", "IS.OPERATING_PROFIT", "IS.FINANCE_COST", "IS.PBT", "IS.NET_PROFIT",
              "IS.OTHER_INCOME", "BS.TOTAL_ASSETS", "BS.TOTAL_EQUITY", "BS.TOTAL_LIABILITIES", "X.TOTAL_DEBT", "BS.ST_BORROWINGS",
              "BS.TOTAL_CA", "BS.TOTAL_CL", "BS.CASH", "BS.INVENTORY", "BS.TRADE_RECEIVABLES", "CF.CFO", "CF.CAPEX", "X.FCF",
              "CF.DIVIDENDS_PAID"]


def llm_sections(case, facts, signals, periods) -> tuple[list[dict], dict]:
    alias, lines = {}, []
    for fid, f in facts.items():
        if f["kind"] == "signal" or f["period"] not in periods[:2] or (f["kind"] == "fact" and f["code"] not in MEMO_FACTS):
            continue
        alias[f"f{len(alias) + 1}"] = fid
        lines.append(f"f{len(alias)} {f['label']} = {f['display']}")
    sig = []
    for i, s in enumerate(signals, 1):
        alias[f"s{i}"] = f"S:{s['id']}:{periods[0]}"
        sig.append(f"s{i} [{s['severity']}] {s['title']}: {s['detail']}")
    user = (f"Facility requested: {case.get('facility') or 'not specified'}\nPeriods (latest first): {', '.join(periods[:2])}\n\n"
            "FACT SHEET:\n" + "\n".join(lines) + "\n\nRISK SIGNALS:\n" + ("\n".join(sig) or "- none"))
    data, meta = llm.chat_json([{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}],
                               temperature=0.2, max_tokens=2000)
    expand = lambda m: "{{" + alias.get(m.group(1), m.group(1)) + "}}"  # noqa: E731
    secs = [{"title": s.get("title", "Section"), "body": re.sub(r"\{\{\s*([fs]\d+)\s*\}\}", expand,
                                                      re.sub(r"\bTitle:\s*(?=\{\{)", "", s.get("body", "")))}
            for s in data.get("sections", []) if s.get("body")]
    if not secs:
        raise ValueError("The AI returned an empty memo")
    return secs, meta


def write_memo(case, spread, ratios, signals, checks, periods, use_llm=True) -> dict:
    facts = build_facts(spread, ratios, periods, signals)
    engine, meta, err = "template", None, None
    sections = None
    if use_llm and llm.available():
        try:
            sections, meta = llm_sections(case, facts, signals, periods)
            engine = "llm"
        except Exception as e:
            err = str(e)[:300]
    if not sections:
        sections = template_sections(case, facts, signals, checks, periods)
        if signals:
            sections.append({"title": "Key risks & mitigants to explore",
                             "body": " ".join(f"{s['title']}: {s['detail'][:-1] if s['detail'].endswith('.') else s['detail']} [S:{s['id']}:{periods[0]}]." for s in signals)})
    out_secs = [{"title": x["title"], **guard(x["body"], facts)} for x in sections]
    return {"engine": engine, "llm_meta": meta, "llm_error": err, "sections": out_secs, "stats": stats(out_secs),
            "questions": borrower_questions(signals, checks), "facts": facts}
