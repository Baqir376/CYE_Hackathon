"""Spreading, validation (tie-outs), ratio engine, policy checks and risk signals.

Everything here is deterministic Python: same input -> same output, every number traceable to rows.
"""
from __future__ import annotations

import json
import os
from typing import Optional

from .taxonomy import TAXONOMY

POLICY_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "policies")


# ----------------------------------------------------------------------------- formatting
def fmt_money(v: Optional[float]) -> str:
    if v is None:
        return "n/a"
    mn = v / 1_000_000
    sign = "-" if mn < 0 else ""
    a = abs(mn)
    if a >= 1000:
        return f"{sign}Rs {a:,.0f} mn"
    if a >= 1:
        return f"{sign}Rs {a:,.1f} mn"
    return f"{sign}Rs {abs(v) / 1000:,.0f}k"


def fmt_ratio(v: Optional[float], unit: str) -> str:
    if v is None:
        return "n/a"
    if unit == "%":
        return f"{v * 100:.1f}%"
    if unit == "days":
        return f"{v:.0f} days"
    return f"{v:.2f}x"


# ----------------------------------------------------------------------------- spread
def build_spread(mapped_rows: list[dict], periods: list[str], unit: int) -> tuple[dict, list[dict]]:
    spread: dict[str, dict] = {}
    issues = []
    by_code: dict[str, list[dict]] = {}
    for r in mapped_rows:
        if r.get("code"):
            by_code.setdefault(r["code"], []).append(r)
    for code, (stmt, name, agg, _p) in TAXONOMY.items():
        rows = by_code.get(code, [])
        if not rows:
            continue
        if agg == "one" and len(rows) > 1:
            pick = sorted(rows, key=lambda x: (x.get("map_source") == "ai", not x.get("verified_sum_of"), -abs(next(iter(x["values"].values()))["value"])))[0]
            issues.append({"code": code, "rows": [x["id"] for x in rows], "kept": pick["id"]})
            rows = [pick]
        vals = {}
        for p in periods:
            contrib = [x for x in rows if p in x["values"]]
            if not contrib:
                continue
            vals[p] = {"value": sum(x["values"][p]["value"] for x in contrib) * unit,
                       "rows": [x["id"] for x in contrib], "derived": False}
        if vals:
            spread[code] = {"code": code, "name": name, "statement": stmt, "values": vals}
    _derive(spread, periods)
    return spread, issues


def _g(spread, code, p) -> Optional[float]:
    it = spread.get(code)
    if not it:
        return None
    v = it["values"].get(p)
    return None if v is None else v["value"]


def _put(spread, code, name, stmt, p, value, formula, inputs):
    spread.setdefault(code, {"code": code, "name": name, "statement": stmt, "values": {}})
    spread[code]["values"][p] = {"value": value, "rows": [], "derived": True, "formula": formula,
                                 "inputs": [i for i in inputs if _g(spread, i, p) is not None]}


def _derive(spread, periods):
    for p in periods:
        g = lambda c: _g(spread, c, p)  # noqa: E731
        if g("BS.TOTAL_NCA") is None and g("BS.TOTAL_ASSETS") is not None and g("BS.TOTAL_CA") is not None:
            _put(spread, "BS.TOTAL_NCA", "Total non-current assets", "BS", p, g("BS.TOTAL_ASSETS") - g("BS.TOTAL_CA"),
                 "Total assets − Total current assets", ["BS.TOTAL_ASSETS", "BS.TOTAL_CA"])
        if g("BS.TOTAL_EQUITY") is None and g("BS.SHARE_CAPITAL") is not None:
            _put(spread, "BS.TOTAL_EQUITY", "Total equity", "BS", p, g("BS.SHARE_CAPITAL") + (g("BS.RESERVES") or 0),
                 "Share capital + Reserves", ["BS.SHARE_CAPITAL", "BS.RESERVES"])
        if g("BS.TOTAL_LIABILITIES") is None:
            if g("BS.TOTAL_NCL") is not None and g("BS.TOTAL_CL") is not None:
                _put(spread, "BS.TOTAL_LIABILITIES", "Total liabilities", "BS", p, g("BS.TOTAL_NCL") + g("BS.TOTAL_CL"),
                     "Non-current liabilities + Current liabilities", ["BS.TOTAL_NCL", "BS.TOTAL_CL"])
            elif g("BS.TOTAL_EQ_LIAB") is not None and g("BS.TOTAL_EQUITY") is not None:
                _put(spread, "BS.TOTAL_LIABILITIES", "Total liabilities", "BS", p, g("BS.TOTAL_EQ_LIAB") - g("BS.TOTAL_EQUITY"),
                     "Total equity & liabilities − Total equity", ["BS.TOTAL_EQ_LIAB", "BS.TOTAL_EQUITY"])
        debt_parts = ["BS.LT_BORROWINGS", "BS.ST_BORROWINGS", "BS.CURRENT_PORTION_LTD", "BS.LEASE_LIABILITIES"]
        _put(spread, "X.TOTAL_DEBT", "Total interest-bearing debt", "BS", p, sum(abs(g(c) or 0) for c in debt_parts),
             "LT borrowings + ST borrowings + Current portion of LTD + Lease liabilities", debt_parts)
        if g("IS.COGS") is None and g("IS.REVENUE") is not None and g("IS.GROSS_PROFIT") is not None:
            _put(spread, "IS.COGS", "Cost of sales", "IS", p, g("IS.GROSS_PROFIT") - g("IS.REVENUE"),
                 "Gross profit − Net revenue", ["IS.GROSS_PROFIT", "IS.REVENUE"])
        if g("IS.PBT") is not None:
            ebit = g("IS.PBT") + abs(g("IS.FINANCE_COST") or 0)
            _put(spread, "X.EBIT", "EBIT (PBT + finance cost)", "IS", p, ebit, "Profit before tax + Finance cost",
                 ["IS.PBT", "IS.FINANCE_COST"])
            if g("CF.DEPRECIATION") is not None:
                _put(spread, "X.EBITDA", "EBITDA", "IS", p, ebit + abs(g("CF.DEPRECIATION")), "EBIT + Depreciation & amortisation",
                     ["X.EBIT", "CF.DEPRECIATION"])
        if g("CF.CFO") is not None and g("CF.CAPEX") is not None:
            _put(spread, "X.FCF", "Free cash flow", "CF", p, g("CF.CFO") - abs(g("CF.CAPEX")), "CFO − Capital expenditure",
                 ["CF.CFO", "CF.CAPEX"])


# ----------------------------------------------------------------------------- validation
def _check(cid, name, p, expected, actual, inputs, tol_rel=0.0005, note="", severity="high"):
    if expected is None or actual is None:
        return None
    diff = actual - expected
    ok = abs(diff) <= max(2000, abs(expected) * tol_rel)
    return {"id": f"{cid}:{p}", "check": name, "period": p, "status": "pass" if ok else "fail",
            "severity": None if ok else severity, "expected": expected, "actual": actual, "difference": diff,
            "inputs": inputs, "note": note}


def validate(spread, mapped_rows, periods, parsed, dup_issues) -> list[dict]:
    out = []
    for p in periods:
        g = lambda c: _g(spread, c, p)  # noqa: E731
        der = lambda c: spread.get(c, {}).get("values", {}).get(p, {}).get("derived", False)  # noqa: E731
        out.append(_check("BS_BALANCE", "Balance sheet balances (Assets = Equity + Liabilities)", p,
                          g("BS.TOTAL_EQ_LIAB"), g("BS.TOTAL_ASSETS"), ["BS.TOTAL_ASSETS", "BS.TOTAL_EQ_LIAB"]))
        if not der("BS.TOTAL_NCA"):
            out.append(_check("BS_ASSETS", "Total assets = Non-current + Current assets", p,
                              (g("BS.TOTAL_NCA") or 0) + (g("BS.TOTAL_CA") or 0) if g("BS.TOTAL_NCA") is not None and g("BS.TOTAL_CA") is not None else None,
                              g("BS.TOTAL_ASSETS"), ["BS.TOTAL_NCA", "BS.TOTAL_CA", "BS.TOTAL_ASSETS"]))
        if None not in (g("BS.TOTAL_EQUITY"), g("BS.TOTAL_NCL"), g("BS.TOTAL_CL")):
            out.append(_check("BS_LIAB", "Equity + Non-current + Current liabilities = Total", p,
                              g("BS.TOTAL_EQUITY") + g("BS.TOTAL_NCL") + g("BS.TOTAL_CL"), g("BS.TOTAL_EQ_LIAB"),
                              ["BS.TOTAL_EQUITY", "BS.TOTAL_NCL", "BS.TOTAL_CL", "BS.TOTAL_EQ_LIAB"]))
        if not der("IS.COGS") and None not in (g("IS.REVENUE"), g("IS.COGS")):
            out.append(_check("IS_GP", "Gross profit = Revenue − Cost of sales", p,
                              g("IS.REVENUE") - abs(g("IS.COGS")), g("IS.GROSS_PROFIT"), ["IS.REVENUE", "IS.COGS", "IS.GROSS_PROFIT"]))
        if None not in (g("IS.PBT"), g("IS.NET_PROFIT"), g("IS.TAX")):
            exp = g("IS.PBT") - abs(g("IS.TAX"))
            c = _check("IS_NP", "Net profit = Profit before tax − Taxation", p, exp, g("IS.NET_PROFIT"),
                       ["IS.PBT", "IS.TAX", "IS.NET_PROFIT"], severity="medium")
            if c and c["status"] == "fail" and g("IS.LEVIES") is not None:
                c2 = _check("IS_NP", "Net profit = Profit before tax − Levies − Taxation", p, exp - abs(g("IS.LEVIES")),
                            g("IS.NET_PROFIT"), ["IS.PBT", "IS.LEVIES", "IS.TAX", "IS.NET_PROFIT"], severity="medium")
                c = c2 or c
            out.append(c)
        if None not in (g("CF.CFO"), g("CF.CFI"), g("CF.CFF"), g("CF.NET_CHANGE")):
            out.append(_check("CF_SUM", "Net change in cash = CFO + CFI + CFF", p, g("CF.CFO") + g("CF.CFI") + g("CF.CFF"),
                              g("CF.NET_CHANGE"), ["CF.CFO", "CF.CFI", "CF.CFF", "CF.NET_CHANGE"]))
        if None not in (g("CF.CASH_END"), g("BS.CASH")):
            cash, end = g("BS.CASH"), g("CF.CASH_END")
            tol = max(2000, abs(cash) * 0.001)
            variants = [
                (cash, "Matches cash & bank balances.", ["BS.CASH"]),
                (cash + (g("BS.ST_INVESTMENTS") or 0), "Reconciles: cash equivalents include short-term investments.",
                 ["BS.CASH", "BS.ST_INVESTMENTS"]),
                (cash - abs(g("BS.ST_BORROWINGS") or 0), "Reconciles: running finance / short-term borrowings are netted in cash equivalents.",
                 ["BS.CASH", "BS.ST_BORROWINGS"]),
                (cash + (g("BS.ST_INVESTMENTS") or 0) - abs(g("BS.ST_BORROWINGS") or 0),
                 "Reconciles: cash equivalents include short-term investments, net of running finance.",
                 ["BS.CASH", "BS.ST_INVESTMENTS", "BS.ST_BORROWINGS"]),
            ]
            hit = next((v for v in variants if abs(end - v[0]) <= tol), None)
            out.append({"id": f"CF_BS_CASH:{p}", "check": "Closing cash (cash flow) reconciles to balance sheet", "period": p,
                        "status": "pass" if hit else "warn", "severity": None if hit else "medium",
                        "expected": hit[0] if hit else cash, "actual": end, "difference": end - (hit[0] if hit else cash),
                        "inputs": (hit[2] if hit else ["BS.CASH"]) + ["CF.CASH_END"],
                        "note": hit[1] if hit else "Closing cash does not reconcile to cash, short-term investments or running "
                                                    "finance. Check the cash & cash equivalents note."})
    out = [c for c in out if c]
    # printed subtotals that do not add up
    for i, r in enumerate(mapped_rows):
        if r.get("is_subtotal") and not r.get("verified_sum_of"):
            # components = contiguous non-subtotal rows above it in the same section/page
            comps = []
            for prev in reversed(mapped_rows[:i]):
                if prev["page"] != r["page"] or prev.get("section") != r.get("section") or prev.get("is_subtotal"):
                    break
                comps.append(prev)
            comps.reverse()
            bad = []
            for p, cell in r["values"].items():
                exp = sum(c["values"][p]["value"] for c in comps if p in c["values"])
                if comps and abs(exp - cell["value"]) > 1:
                    u = r.get("unit", 1)
                    bad.append((p, exp * u, cell["value"] * u))
            if comps and not bad:
                out.append({"id": f"ARITH:{r['id']}", "check": "Printed subtotal reconciles to its lines (after analyst correction)"
                            if r.get("overridden") else "Subtotal reconciles to its lines", "period": None, "status": "pass",
                            "severity": None, "rows": [r["id"]]})
                continue
            per = bad[0][0] if bad else None
            out.append({"id": f"ARITH:{r['id']}",
                        "check": f"Printed subtotal ({(r.get('section') or 'section').title()}) does not equal the sum of its lines",
                        "period": per, "status": "fail", "severity": "high", "rows": [r["id"]] + [c["id"] for c in comps],
                        "expected": bad[0][1] if bad else None, "actual": bad[0][2] if bad else None,
                        "difference": (bad[0][2] - bad[0][1]) if bad else None,
                        "note": "The figure printed in the statement does not reconcile to its component lines "
                                "(possible typing or casting error). Confirm with the borrower or the auditor."})
    verified = sum(1 for r in mapped_rows if r.get("verified_sum_of"))
    out.append({"id": "ARITH_OK", "check": f"{verified} printed totals re-computed from their component lines",
                "period": None, "status": "pass", "severity": None})
    required = ["IS.REVENUE", "IS.NET_PROFIT", "BS.TOTAL_ASSETS", "BS.TOTAL_EQUITY", "BS.TOTAL_CA", "BS.TOTAL_CL", "CF.CFO"]
    missing = [c for c in required if c not in spread]
    if missing:
        out.append({"id": "MISSING", "check": "Required template items not found", "period": None, "status": "fail",
                    "severity": "medium", "missing": [TAXONOMY[c][1] for c in missing], "codes": missing})
    disputed = [r for r in mapped_rows if r.get("confidence") == "disputed"]
    for r in disputed:
        out.append({"id": f"DISPUTE:{r['id']}", "check": "Classification needs analyst confirmation", "period": None,
                    "status": "warn", "severity": "medium", "rows": [r["id"]],
                    "note": f"'{r['label'][:60]}': rules say {TAXONOMY[r['rule_code']][1]}, AI says {TAXONOMY[r['ai_code']][1]}. "
                            "The rules answer is used until you confirm or change it."})
    for d in dup_issues:
        out.append({"id": f"DUP:{d['code']}", "check": f"Several rows look like '{TAXONOMY[d['code']][1]}'", "period": None,
                    "status": "warn", "severity": "low", "rows": d["rows"],
                    "note": "Kept '" + next((r["label"] for r in mapped_rows if r["id"] == d["kept"]), d["kept"])[:60] + "'. Confirm the correct line."})
    if len(periods) < 2:
        out.append({"id": "PERIODS", "check": "Only one financial year found; trend analysis is limited", "period": None,
                    "status": "warn", "severity": "medium"})
    if parsed.get("scanned_pages"):
        out.append({"id": "SCANNED", "check": f"{parsed['scanned_pages']} page(s) have no text layer (scanned images)",
                    "period": None, "status": "warn" if not parsed["rows"] else "info", "severity": "low",
                    "note": "Scanned pages are not read in this version. Statement pages must be text-based PDFs."})
    for f in parsed.get("auditor_flags", []):
        out.append({"id": f"AUDIT:{f['phrase']}", "check": f["message"], "period": None, "status": "warn",
                    "severity": f["severity"], "page": f["page"], "bbox": f["bbox"], "doc_id": f.get("doc_id")})
    return out


# ----------------------------------------------------------------------------- ratios
RATIOS = [
    # key, name, unit, numerator codes, denominator codes, formula text, higher_is_better
    ("current_ratio", "Current ratio", "x", "Total current assets / Total current liabilities", True),
    ("quick_ratio", "Quick ratio", "x", "(Current assets − Inventory) / Current liabilities", True),
    ("debt_to_equity", "Debt / Equity", "x", "Total interest-bearing debt / Total equity", False),
    ("leverage", "Total liabilities / Equity", "x", "Total liabilities / Total equity", False),
    ("gearing", "Gearing", "%", "Debt / (Debt + Equity)", False),
    ("interest_cover", "Interest cover", "x", "EBIT / Finance cost", True),
    ("dscr", "DSCR (proxy)", "x", "(EBIT + D&A) / (Finance cost + Current portion of LTD)", True),
    ("gross_margin", "Gross margin", "%", "Gross profit / Net revenue", True),
    ("ebit_margin", "Operating (EBIT) margin", "%", "EBIT / Net revenue", True),
    ("net_margin", "Net margin", "%", "Net profit / Net revenue", True),
    ("roa", "Return on assets", "%", "Net profit / Total assets (period-end)", True),
    ("roe", "Return on equity", "%", "Net profit / Total equity (period-end)", True),
    ("receivable_days", "Receivable days", "days", "Trade receivables / Net revenue × 365", False),
    ("inventory_days", "Inventory days", "days", "Inventory / Cost of sales × 365", False),
    ("payable_days", "Payable days", "days", "Trade & other payables / Cost of sales × 365", None),
    ("cfo_to_debt", "CFO / Debt", "x", "Cash flow from operations / Total debt", True),
    ("cash_conversion", "Cash conversion (CFO / Net profit)", "x", "Cash flow from operations / Net profit", True),
    ("revenue_growth", "Revenue growth", "%", "Revenue this year / Revenue last year − 1", True),
    ("profit_growth", "Net profit growth", "%", "Net profit this year / Net profit last year − 1", True),
]
RATIO_INPUTS = {
    "current_ratio": ["BS.TOTAL_CA", "BS.TOTAL_CL"], "quick_ratio": ["BS.TOTAL_CA", "BS.INVENTORY", "BS.TOTAL_CL"],
    "debt_to_equity": ["X.TOTAL_DEBT", "BS.TOTAL_EQUITY"], "leverage": ["BS.TOTAL_LIABILITIES", "BS.TOTAL_EQUITY"],
    "gearing": ["X.TOTAL_DEBT", "BS.TOTAL_EQUITY"], "interest_cover": ["X.EBIT", "IS.FINANCE_COST"],
    "dscr": ["X.EBIT", "CF.DEPRECIATION", "IS.FINANCE_COST", "BS.CURRENT_PORTION_LTD"],
    "gross_margin": ["IS.GROSS_PROFIT", "IS.REVENUE"], "ebit_margin": ["X.EBIT", "IS.REVENUE"],
    "net_margin": ["IS.NET_PROFIT", "IS.REVENUE"], "roa": ["IS.NET_PROFIT", "BS.TOTAL_ASSETS"],
    "roe": ["IS.NET_PROFIT", "BS.TOTAL_EQUITY"], "receivable_days": ["BS.TRADE_RECEIVABLES", "IS.REVENUE"],
    "inventory_days": ["BS.INVENTORY", "IS.COGS"], "payable_days": ["BS.TRADE_PAYABLES", "IS.COGS"],
    "cfo_to_debt": ["CF.CFO", "X.TOTAL_DEBT"], "cash_conversion": ["CF.CFO", "IS.NET_PROFIT"],
    "revenue_growth": ["IS.REVENUE"], "profit_growth": ["IS.NET_PROFIT"],
}


def _div(a, b):
    if a is None or b in (None, 0):
        return None
    return a / b


def compute_ratios(spread, periods) -> dict:
    out = {}
    for key, name, unit, formula, hib in RATIOS:
        vals, notes = {}, {}
        for i, p in enumerate(periods):
            g = lambda c: _g(spread, c, p)  # noqa: E731
            v, note = None, None
            debt = g("X.TOTAL_DEBT")
            if key == "current_ratio":
                v = _div(g("BS.TOTAL_CA"), g("BS.TOTAL_CL"))
            elif key == "quick_ratio":
                v = _div((g("BS.TOTAL_CA") or 0) - abs(g("BS.INVENTORY") or 0), g("BS.TOTAL_CL")) if g("BS.TOTAL_CA") is not None else None
            elif key == "debt_to_equity":
                v = _div(debt, g("BS.TOTAL_EQUITY"))
            elif key == "leverage":
                v = _div(g("BS.TOTAL_LIABILITIES"), g("BS.TOTAL_EQUITY"))
            elif key == "gearing":
                v = _div(debt, (debt or 0) + (g("BS.TOTAL_EQUITY") or 0)) if g("BS.TOTAL_EQUITY") else None
            elif key == "interest_cover":
                fc = abs(g("IS.FINANCE_COST") or 0)
                v = _div(g("X.EBIT"), fc)
                if fc == 0:
                    note = "No finance cost reported"
            elif key == "dscr":
                ds = abs(g("IS.FINANCE_COST") or 0) + abs(g("BS.CURRENT_PORTION_LTD") or 0)
                cash_earn = (g("X.EBIT") or 0) + abs(g("CF.DEPRECIATION") or 0) if g("X.EBIT") is not None else None
                v = _div(cash_earn, ds)
                if ds == 0:
                    note = "No scheduled debt service identified"
            elif key == "gross_margin":
                v = _div(g("IS.GROSS_PROFIT"), g("IS.REVENUE"))
            elif key == "ebit_margin":
                v = _div(g("X.EBIT"), g("IS.REVENUE"))
            elif key == "net_margin":
                v = _div(g("IS.NET_PROFIT"), g("IS.REVENUE"))
            elif key == "roa":
                v = _div(g("IS.NET_PROFIT"), g("BS.TOTAL_ASSETS"))
            elif key == "roe":
                v = _div(g("IS.NET_PROFIT"), g("BS.TOTAL_EQUITY"))
            elif key == "receivable_days":
                v = _div(abs(g("BS.TRADE_RECEIVABLES")) * 365, g("IS.REVENUE")) if g("BS.TRADE_RECEIVABLES") is not None else None
            elif key == "inventory_days":
                v = _div(abs(g("BS.INVENTORY")) * 365, abs(g("IS.COGS") or 0)) if g("BS.INVENTORY") is not None else None
            elif key == "payable_days":
                v = _div(abs(g("BS.TRADE_PAYABLES")) * 365, abs(g("IS.COGS") or 0)) if g("BS.TRADE_PAYABLES") is not None else None
            elif key == "cfo_to_debt":
                v = _div(g("CF.CFO"), debt)
                if not debt:
                    note = "No interest-bearing debt"
            elif key == "cash_conversion":
                np_ = g("IS.NET_PROFIT")
                v = _div(g("CF.CFO"), np_) if np_ and np_ > 0 else None
            elif key in ("revenue_growth", "profit_growth") and i + 1 < len(periods):
                code = "IS.REVENUE" if key == "revenue_growth" else "IS.NET_PROFIT"
                prev = _g(spread, code, periods[i + 1])
                cur = g(code)
                v = (cur / prev - 1) if (cur is not None and prev and prev > 0) else None
            if v is not None:
                vals[p] = v
            if note:
                notes[p] = note
        out[key] = {"key": key, "name": name, "unit": unit, "formula": formula, "higher_is_better": hib,
                    "inputs": RATIO_INPUTS[key], "values": vals, "notes": notes}
    return out


# ----------------------------------------------------------------------------- policy
def load_policy(name: str = "default") -> dict:
    with open(os.path.join(POLICY_DIR, f"{name}.json"), encoding="utf-8") as f:
        return json.load(f)


def list_policies() -> list[dict]:
    out = []
    for fn in sorted(os.listdir(POLICY_DIR)):
        if fn.endswith(".json"):
            p = load_policy(fn[:-5])
            out.append({"id": fn[:-5], "name": p.get("name"), "description": p.get("description")})
    return out


def apply_policy(ratios, periods, policy) -> list[dict]:
    res = []
    p = periods[0] if periods else None
    for key, rule in policy.get("thresholds", {}).items():
        r = ratios.get(key)
        if not r or p is None:
            continue
        v = r["values"].get(p)
        status = "n/a"
        if v is not None:
            status = "pass"
            if "min" in rule and v < rule["min"]:
                status = "breach"
            elif "max" in rule and v > rule["max"]:
                status = "breach"
            elif "warn_min" in rule and v < rule["warn_min"]:
                status = "watch"
            elif "warn_max" in rule and v > rule["warn_max"]:
                status = "watch"
        elif r["notes"].get(p):
            status = "n/m"
        res.append({"ratio": key, "name": r["name"], "unit": r["unit"], "period": p, "value": v, "rule": rule,
                    "status": status, "note": r["notes"].get(p)})
    return res


# ----------------------------------------------------------------------------- risk signals
def risk_signals(spread, ratios, periods) -> list[dict]:
    sig = []
    if not periods:
        return sig
    cur = periods[0]
    prev = periods[1] if len(periods) > 1 else None
    g = lambda c, p=cur: _g(spread, c, p)  # noqa: E731
    rv = lambda k, p=cur: ratios.get(k, {}).get("values", {}).get(p)  # noqa: E731

    def add(sid, sev, title, detail, facts):
        sig.append({"id": sid, "severity": sev, "title": title, "detail": detail, "facts": facts})

    if g("IS.NET_PROFIT") is not None and g("IS.NET_PROFIT") < 0:
        add("NET_LOSS", "high", "Company reported a net loss",
            f"Net result for {cur} was {fmt_money(g('IS.NET_PROFIT'))}.", [f"F:IS.NET_PROFIT:{cur}"])
    if g("CF.CFO") is not None and g("CF.CFO") < 0:
        add("NEG_CFO", "high", "Negative operating cash flow",
            f"Operations consumed {fmt_money(abs(g('CF.CFO')))} of cash in {cur}.", [f"F:CF.CFO:{cur}"])
    cc = rv("cash_conversion")
    if cc is not None and 0 <= cc < 0.6:
        add("LOW_CASH_CONV", "medium", "Profits are not converting into cash",
            f"Operating cash flow was only {fmt_ratio(cc, 'x')} of net profit in {cur}.",
            [f"R:cash_conversion:{cur}", f"F:CF.CFO:{cur}", f"F:IS.NET_PROFIT:{cur}"])
    if prev:
        rg, recv_now, recv_prev = rv("revenue_growth"), g("BS.TRADE_RECEIVABLES"), g("BS.TRADE_RECEIVABLES", prev)
        if rg is not None and recv_now and recv_prev:
            recv_g = recv_now / recv_prev - 1
            if recv_g - rg > 0.10:
                add("RECV_OUTPACE", "medium", "Receivables growing faster than sales",
                    f"Trade receivables grew {recv_g * 100:.1f}% while revenue grew {rg * 100:.1f}% ({prev}→{cur}).",
                    [f"F:BS.TRADE_RECEIVABLES:{cur}", f"F:BS.TRADE_RECEIVABLES:{prev}", f"R:revenue_growth:{cur}"])
        if rg is not None and rg < -0.10:
            add("REV_DECLINE", "medium", "Revenue declined materially",
                f"Net revenue fell {abs(rg) * 100:.1f}% year on year.", [f"R:revenue_growth:{cur}", f"F:IS.REVENUE:{cur}"])
        gm, gm_p = rv("gross_margin"), rv("gross_margin", prev)
        if gm is not None and gm_p is not None and gm_p - gm > 0.03:
            add("MARGIN_SQUEEZE", "medium", "Gross margin compression",
                f"Gross margin fell from {fmt_ratio(gm_p, '%')} to {fmt_ratio(gm, '%')}.",
                [f"R:gross_margin:{cur}", f"R:gross_margin:{prev}"])
        de, de_p = rv("debt_to_equity"), rv("debt_to_equity", prev)
        if de is not None and de_p is not None and de - de_p > 0.25:
            add("LEVERAGE_UP", "medium", "Leverage rising",
                f"Debt/Equity increased from {fmt_ratio(de_p, 'x')} to {fmt_ratio(de, 'x')}.",
                [f"R:debt_to_equity:{cur}", f"R:debt_to_equity:{prev}"])
        ic, ic_p = rv("interest_cover"), rv("interest_cover", prev)
        if ic is not None and ic_p is not None and ic < ic_p * 0.7 and ic < 3:
            add("COVER_DOWN", "high", "Interest cover weakening",
                f"Interest cover fell from {fmt_ratio(ic_p, 'x')} to {fmt_ratio(ic, 'x')}.",
                [f"R:interest_cover:{cur}", f"R:interest_cover:{prev}"])
        idays, idays_p = rv("inventory_days"), rv("inventory_days", prev)
        if idays is not None and idays_p is not None and idays - idays_p > 20:
            add("INV_BUILD", "low", "Inventory build-up",
                f"Inventory days rose from {fmt_ratio(idays_p, 'days')} to {fmt_ratio(idays, 'days')}.",
                [f"R:inventory_days:{cur}", f"R:inventory_days:{prev}"])
    cr = rv("current_ratio")
    if cr is not None and cr < 1:
        add("WC_DEFICIT", "high", "Working-capital deficit",
            f"Current liabilities exceed current assets (current ratio {fmt_ratio(cr, 'x')}).", [f"R:current_ratio:{cur}"])
    debt = g("X.TOTAL_DEBT") or 0
    st = abs(g("BS.ST_BORROWINGS") or 0) + abs(g("BS.CURRENT_PORTION_LTD") or 0)
    if debt > 0 and st / debt > 0.7:
        add("ST_RELIANCE", "medium", "Heavy reliance on short-term borrowing",
            f"{st / debt * 100:.0f}% of interest-bearing debt is due within 12 months.",
            [f"F:BS.ST_BORROWINGS:{cur}", f"F:X.TOTAL_DEBT:{cur}"])
    oi, pbt = g("IS.OTHER_INCOME"), g("IS.PBT")
    if oi and pbt and pbt > 0 and oi / pbt > 0.25:
        add("OTHER_INCOME", "low", "Profit depends on non-core income",
            f"Other income was {oi / pbt * 100:.0f}% of profit before tax in {cur}.",
            [f"F:IS.OTHER_INCOME:{cur}", f"F:IS.PBT:{cur}"])
    for p in periods:
        dv, np_ = _g(spread, "CF.DIVIDENDS_PAID", p), _g(spread, "IS.NET_PROFIT", p)
        if dv and np_ and np_ > 0 and abs(dv) > np_:
            add(f"PAYOUT_{p}", "low", f"Dividends paid exceeded net profit ({p})",
                f"Dividends paid {fmt_money(abs(dv))} vs net profit {fmt_money(np_)}: cash leaving the business.",
                [f"F:CF.DIVIDENDS_PAID:{p}", f"F:IS.NET_PROFIT:{p}"])
    return sig
