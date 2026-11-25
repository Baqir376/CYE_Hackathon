"""Number guard: every figure must be the exact display value of the fact it cites.

Two layers:
1. The LLM writes placeholders ({{F:IS.REVENUE:FY2026}}); `render` fills in the figure and its citation. Digits the LLM
   types itself survive rendering as plain text and are then blocked by layer 2.
2. `guard` checks every sentence, whoever wrote it (LLM, template or analyst):
   - the figure before a citation equals that fact's value, including sign and unit;
   - the words before it do not name a different metric, or a different year;
   - "rose / fell" agrees with the two values when a sentence compares two years of the same metric;
   - no other digits or number words (doubled, million, percent ...) appear outside cited figures.

What it does NOT check: whether a purely qualitative sentence is good judgement. Those are labelled "narrative".
"""
from __future__ import annotations

import re
import unicodedata

CITE_RE = re.compile(r"\[((?:F|R|S):[A-Za-z0-9_.]+:FY\d{4})\]")
PLACEHOLDER_RE = re.compile(r"\{\{\s*((?:F|R|S):[A-Za-z0-9_.]+:FY\d{4})\s*\}\}")
FY_RE = re.compile(r"\bFY\s?(\d{4})\b")
DIGIT_RE = re.compile(r"\d[\d,]*(?:\.\d+)?")
WORD_NUM_RE = re.compile(
    r"\b(doubl(?:e|ed|es|ing)|tripl(?:e|ed|es|ing)|quadrupl\w+|halv(?:e|ed|es|ing)|twice|thrice|half|"
    r"(?:one|two|three|four|five|six|seven|eight|nine|ten)(?:fold|[ -]thirds?|[ -]quarters?)|"
    r"hundreds?|thousands?|lakhs?|crores?|millions?|billions?|trillions?|per ?cent|percent(?:age)?)\b", re.I)
# a period after a figure belongs to that figure: "Rs 4,450 mn [..] in FY2025 ..."
TRAILING_FY_RE = re.compile(r"^\s*,?\s*(?:in|for|during|at)?\s*\(?\s*FY\s?(\d{4})\)?")
UP_RE = re.compile(r"\b(rose|risen|rises|rising|increas\w+|grew|grown|grows|growing|climb\w+|expand\w+|improv\w+|up)\b", re.I)
DOWN_RE = re.compile(r"\b(fell|fallen|falls|falling|declin\w+|decreas\w+|dropp?\w*|slipp?\w*|weaken\w*|contract\w+|reduc\w+|down)\b", re.I)

# How people refer to each item in prose. Longest match wins, so "gross profit margin" beats "gross profit".
ALIASES: dict[str, list[str]] = {
    "IS.REVENUE": ["net revenue", "revenue", "net sales", "sales", "turnover"],
    "IS.COGS": ["cost of sales", "cost of goods sold"],
    "IS.GROSS_PROFIT": ["gross profit"],
    "IS.DISTRIBUTION": ["distribution cost", "selling cost", "distribution expense"],
    "IS.ADMIN": ["administrative expense", "administration expense", "admin expense"],
    "IS.OTHER_OPEX": ["other operating expense"],
    "IS.OTHER_INCOME": ["other income"],
    "IS.OPERATING_PROFIT": ["operating profit"],
    "X.EBIT": ["ebit", "earnings before interest and tax"],
    "X.EBITDA": ["ebitda"],
    "IS.FINANCE_COST": ["finance cost", "financial charge", "interest expense"],
    "IS.PBT": ["profit before tax", "pre-tax profit"],
    "IS.TAX": ["taxation", "tax charge"],
    "IS.NET_PROFIT": ["net profit", "profit after tax", "net income", "profit for the year", "net loss"],
    "CF.CFO": ["cash flow from operations", "operating cash flow", "cash from operations", "cfo"],
    "CF.CFI": ["cash flow from investing", "investing cash flow"],
    "CF.CFF": ["cash flow from financing", "financing cash flow"],
    "CF.CAPEX": ["capital expenditure", "capex"],
    "CF.DEPRECIATION": ["depreciation"],
    "CF.DIVIDENDS_PAID": ["dividends paid", "dividend payment"],
    "X.FCF": ["free cash flow"],
    "BS.TOTAL_ASSETS": ["total assets"],
    "BS.TOTAL_CA": ["total current assets", "current assets"],
    "BS.TOTAL_NCA": ["non-current assets"],
    "BS.TOTAL_EQUITY": ["total equity", "shareholders' equity", "equity base"],
    "BS.TOTAL_LIABILITIES": ["total liabilities"],
    "BS.TOTAL_CL": ["total current liabilities", "current liabilities"],
    "BS.TOTAL_NCL": ["non-current liabilities"],
    "BS.CASH": ["cash and bank balance", "cash & bank balance", "bank balance"],
    "BS.INVENTORY": ["inventory", "inventories", "stock-in-trade"],
    "BS.TRADE_RECEIVABLES": ["trade receivable", "trade debt", "receivables"],
    "BS.TRADE_PAYABLES": ["trade payable", "trade and other payable", "trade & other payable"],
    "BS.ST_BORROWINGS": ["short-term borrowing", "short term borrowing", "running finance"],
    "BS.LT_BORROWINGS": ["long-term borrowing", "long term borrowing", "long-term financing", "long term financing"],
    "X.TOTAL_DEBT": ["interest-bearing debt", "total debt"],
    "current_ratio": ["current ratio"],
    "quick_ratio": ["quick ratio"],
    "debt_to_equity": ["debt-to-equity", "debt to equity", "debt/equity"],
    "leverage": ["total liabilities to equity", "total liabilities/equity", "total liabilities / equity", "leverage"],
    "gearing": ["gearing"],
    "interest_cover": ["interest cover", "interest coverage"],
    "dscr": ["dscr", "debt service coverage"],
    "gross_margin": ["gross margin", "gross profit margin"],
    "ebit_margin": ["ebit margin", "operating margin", "operating profit margin"],
    "net_margin": ["net margin", "net profit margin"],
    "roa": ["return on assets"],
    "roe": ["return on equity"],
    "receivable_days": ["receivable days", "receivables days"],
    "inventory_days": ["inventory days"],
    "payable_days": ["payable days", "payables days"],
    "cfo_to_debt": ["cfo-to-debt", "cfo to debt", "cfo/debt", "cfo / debt"],
    "cash_conversion": ["cash conversion"],
    "revenue_growth": ["revenue growth", "sales growth"],
    "profit_growth": ["profit growth"],
}
# the same quantity under two names, or a ratio introduced by its own subject ("growth of 9.0%", "equal to 1.2x of net profit")
EQUIVALENT = [{"IS.OPERATING_PROFIT", "X.EBIT"}]
SUBJECT_OK = {"revenue_growth": {"IS.REVENUE"}, "profit_growth": {"IS.NET_PROFIT"}, "cash_conversion": {"CF.CFO"},
              "net_margin": {"IS.NET_PROFIT"}, "gross_margin": {"IS.GROSS_PROFIT"}, "ebit_margin": {"IS.OPERATING_PROFIT", "X.EBIT"},
              "debt_to_equity": {"X.TOTAL_DEBT"}}
_ALIAS_LIST = sorted(((a, c) for c, al in ALIASES.items() for a in al), key=lambda x: -len(x[0]))


def render(text: str, facts: dict) -> str:
    """Replace {{id}} with 'figure [id]'. Unknown ids become a bracketed citation so the guard blocks the sentence."""
    def sub(m):
        fid = m.group(1)
        return f"{facts[fid]['display'].rstrip('.')} [{fid}]" if fid in facts else f"[{fid}]"
    return PLACEHOLDER_RE.sub(sub, text)


def _mentions(clause: str) -> list[tuple[int, str]]:
    low = clause.lower().replace("‑", "-").replace("‐", "-").replace("’", "'").replace(" / ", "/")
    taken, found = [], []
    for alias, code in _ALIAS_LIST:
        for m in re.finditer(r"(?<![a-z])" + re.escape(alias), low):
            if any(a < m.end() and m.start() < b for a, b in taken):
                continue
            taken.append((m.start(), m.end()))
            found.append((m.start(), code))
    return sorted(found)


def _variants(display: str) -> list[str]:
    out = [display]
    if display.startswith("-Rs "):
        out += ["Rs -" + display[4:], "(" + display[1:] + ")", "negative " + display[1:]]
    return out


def _same_metric(mentioned: str, cited: str) -> bool:
    return (mentioned == cited or any({mentioned, cited} <= e for e in EQUIVALENT)
            or mentioned in SUBJECT_OK.get(cited, set()))


def check_sentence(s: str, facts: dict) -> dict:
    problems: list[str] = []
    cites = list(CITE_RE.finditer(s))
    good = [m.group(1) for m in cites if m.group(1) in facts]
    last_end, prev_code = 0, None
    uncited_text = ""       # everything that is not a cited figure
    seen = []               # (fact, clause before the figure)
    for m in cites:
        fid = m.group(1)
        clause = s[last_end:m.start()].rstrip()
        last_end = m.end()
        f = facts.get(fid)
        if not f:
            problems.append(f"unknown source {fid}")
            uncited_text += clause + " "
            continue
        tail = TRAILING_FY_RE.match(clause)
        if tail and seen and f"FY{tail.group(1)}" != seen[-1][0]["period"]:
            problems.append(f"text says FY{tail.group(1)} but the source is {seen[-1][0]['period']}")
        body = clause[tail.end():] if tail else clause
        low = body.lower()
        if f["kind"] == "signal":
            want = f["display"].rstrip(".")
            if not low.endswith(want.lower()):
                problems.append(f"wording differs from the calculated signal '{f['label']}'")
                uncited_text += body + " "
            else:
                uncited_text += body[: len(body) - len(want)] + " "
            prev_code = None
            seen.append((f, body))
            continue
        hit = next((v for v in sorted(_variants(f["display"]), key=len, reverse=True) if low.endswith(v.lower())), None)
        before = body[: len(body) - len(hit)] if hit else body
        # "-Rs 5 mn" must not satisfy a fact displayed as "Rs 5 mn", nor "14,850" a fact "4,850"
        if hit and before and (before[-1].isalnum() or before[-1] in "-(−.,"):
            hit = None
        if not hit:
            problems.append(f"figure does not match {f['label']} ({f['display']})")
            uncited_text += body + " "
        else:
            uncited_text += before + " "
        names = _mentions(before)
        if names:
            if not _same_metric(names[-1][1], f["code"]):
                problems.append(f"text names a different item than its source ({f['label']})")
        elif prev_code != f["code"] and f["code"] in ALIASES:
            problems.append(f"sentence does not say which item {f['display']} is")
        yrs = {f"FY{y}" for y in FY_RE.findall(before)}
        if len(yrs) == 1 and f["period"] not in yrs:
            problems.append(f"text says {yrs.pop()} but the source is {f['period']}")
        prev_code = f["code"]
        seen.append((f, before))
    rest = s[last_end:]
    tail = TRAILING_FY_RE.match(rest)
    if tail and seen and f"FY{tail.group(1)}" != seen[-1][0]["period"]:
        problems.append(f"text says FY{tail.group(1)} but the source is {seen[-1][0]['period']}")
    uncited_text += rest
    # direction words when two years of the same metric are compared
    for i in range(1, len(seen)):
        (a, ta), (b, tb) = seen[i - 1], seen[i]
        if a["code"] != b["code"] or a["period"] == b["period"] or a["value"] is None or b["value"] is None:
            continue
        words = ta + " " + tb
        up, down = bool(UP_RE.search(words)), bool(DOWN_RE.search(words))
        if up == down:
            continue
        new, old = (a, b) if a["period"] > b["period"] else (b, a)
        nv, ov = (abs(new["value"]), abs(old["value"])) if new.get("cost") else (new["value"], old["value"])
        if (up and nv < ov) or (down and nv > ov):
            problems.append(f"direction is wrong: {new['label']} {new['display']} vs {old['display']}")
    if "{{" in s:
        problems.append("placeholder without a source")
    loose = FY_RE.sub("", uncited_text)
    problems += [f"figure {n} has no source" for n in DIGIT_RE.findall(loose)]
    problems += [f"figure {ch} has no source" for ch in loose if unicodedata.category(ch) in ("No", "Nl")]  # such as ½ or Ⅳ
    problems += [f"'{w}' is a figure in words without a source" for w in WORD_NUM_RE.findall(loose)]
    problems = list(dict.fromkeys(problems))
    status = "unverified" if problems else ("verified" if good else "narrative")
    return {"text": s, "citations": good, "status": status, "problems": problems}


def guard(text: str, facts: dict) -> dict:
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r" ?\[(?:high|medium|low)\]", "", render(text, facts)).strip()
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z(\[])", text)
    return {"sentences": [check_sentence(p.strip(), facts) for p in parts if p.strip()]}


def stats(sections: list[dict]) -> dict:
    sens = [s for sec in sections for s in sec["sentences"]]
    return {"sentences": len(sens), "verified": sum(s["status"] == "verified" for s in sens),
            "unverified": sum(s["status"] == "unverified" for s in sens),
            "narrative": sum(s["status"] == "narrative" for s in sens),
            "numbers_checked": sum(len(CITE_RE.findall(s["text"])) for s in sens)}
