"""Standard spreading template (canonical line items) with Pakistan-specific synonyms.

Terms follow the presentation used by Pakistani companies under the Companies Act 2017 / IFRS as
applicable in Pakistan (e.g. "trade debts", "stock-in-trade", "accrued mark-up", "running finance").
A bank can override this template via a policy file; this is the default.
"""
from __future__ import annotations

import re

# code: (statement, display name, aggregation, rule patterns)
# aggregation: "sum" adds every row mapped to the code, "one" keeps a single (largest |value|) row
TAXONOMY: dict[str, tuple[str, str, str, list[str]]] = {
    # ---------------- Balance sheet: assets
    "BS.PPE": ("BS", "Property, plant & equipment", "sum",
               [r"^property,? plant (and|&) equipment", r"^fixed assets", r"^operating fixed assets", r"capital work.in.progress", r"right.of.use"]),
    "BS.INTANGIBLES": ("BS", "Intangible assets", "sum", [r"^intangible", r"goodwill"]),
    "BS.LT_INVESTMENTS": ("BS", "Long-term investments", "sum", [r"^long.term investment", r"investments? in (subsidiar|associat)"]),
    "BS.OTHER_NCA": ("BS", "Other non-current assets", "sum",
                     [r"^long.term (loans|deposits|advances|receivable)", r"deferred tax asset", r"development and decommissioning", r"exploration and evaluation"]),
    "BS.TOTAL_NCA": ("BS", "Total non-current assets", "one", [r"^total non.current assets"]),
    "BS.INVENTORY": ("BS", "Inventory (stock-in-trade)", "sum", [r"^stock.in.trade", r"^inventor", r"^stores,? spares", r"^stores and spares"]),
    "BS.TRADE_RECEIVABLES": ("BS", "Trade receivables (trade debts)", "sum", [r"^trade debts", r"^trade receivable", r"^debtors"]),
    "BS.OTHER_RECEIVABLES": ("BS", "Advances, deposits & other receivables", "sum",
                             [r"^(loans,? )?advances", r"deposits,? prepayments", r"other receivables", r"^tax refunds?", r"^taxation.{0,10}net$", r"^short.term (deposits|prepayments)"]),
    "BS.ST_INVESTMENTS": ("BS", "Short-term investments", "sum", [r"^short.term investment", r"^other financial assets", r"^investments?$"]),
    "BS.CASH": ("BS", "Cash & bank balances", "sum", [r"^cash and bank", r"^cash and cash equivalents", r"^bank balances", r"^cash$"]),
    "BS.TOTAL_CA": ("BS", "Total current assets", "one", [r"^total current assets"]),
    "BS.TOTAL_ASSETS": ("BS", "Total assets", "one", [r"^total assets"]),
    # ---------------- Balance sheet: equity & liabilities
    "BS.SHARE_CAPITAL": ("BS", "Paid-up share capital", "sum", [r"paid.up (share )?capital", r"^issued,? subscribed", r"^share capital$"]),
    "BS.RESERVES": ("BS", "Reserves & retained earnings", "sum",
                    [r"reserves?$", r"unappropriated profit", r"accumulated (profit|loss)", r"retained earnings", r"surplus on revaluation"]),
    "BS.TOTAL_EQUITY": ("BS", "Total equity", "one", [r"^total (share capital and reserves?|equity)(?! and liabilities)", r"^shareholders'? equity"]),
    "BS.LT_BORROWINGS": ("BS", "Long-term borrowings", "sum",
                         [r"^long.term (financing|finance|loans?|borrowings?)", r"^sukuks?", r"^term finance certificates", r"^loans? from (directors|sponsors|associated)"]),
    "BS.LEASE_LIABILITIES": ("BS", "Lease liabilities", "sum", [r"lease liabilit", r"liabilities against assets subject to finance lease"]),
    "BS.DEFERRED_TAX": ("BS", "Deferred tax liability", "sum", [r"^deferred tax(ation)? liabilit", r"^deferred taxation$"]),
    "BS.OTHER_NCL": ("BS", "Other non-current liabilities", "sum",
                     [r"^long.term deposits", r"^provisions?$", r"^deferred (liabilities|income|grant)", r"staff retirement", r"^employee benefit"]),
    "BS.TOTAL_NCL": ("BS", "Total non-current liabilities", "one", [r"^total non.current liabilities"]),
    "BS.TRADE_PAYABLES": ("BS", "Trade & other payables", "sum", [r"^trade and other payables", r"^trade payables", r"^creditors", r"^accrued liabilities"]),
    "BS.ST_BORROWINGS": ("BS", "Short-term borrowings", "sum", [r"^short.term (borrowings?|finance|financing|loans?)", r"^running finance"]),
    "BS.CURRENT_PORTION_LTD": ("BS", "Current portion of long-term debt", "sum", [r"^current (portion|maturity) of"]),
    "BS.ACCRUED_MARKUP": ("BS", "Accrued mark-up / interest", "sum", [r"accrued (mark.?up|interest|profit)"]),
    "BS.OTHER_CL": ("BS", "Other current liabilities", "sum",
                    [r"^unclaimed dividend", r"^unpaid dividend", r"^provision for (income )?tax", r"^taxation.{0,10}(net|provision)", r"^contract liabilit", r"^advances from customers"]),
    "BS.TOTAL_CL": ("BS", "Total current liabilities", "one", [r"^total current liabilities"]),
    "BS.TOTAL_LIABILITIES": ("BS", "Total liabilities", "one", [r"^total liabilities$"]),
    "BS.TOTAL_EQ_LIAB": ("BS", "Total equity & liabilities", "one", [r"^total equity and liabilities", r"^total liabilities and equity"]),
    # ---------------- Income statement
    "IS.REVENUE": ("IS", "Net revenue", "one", [r"^net (sales|revenue|turnover)", r"^revenue( from contracts with customers)?( - net)?$", r"^sales.{0,8}net$", r"^turnover.{0,8}net$"]),
    "IS.COGS": ("IS", "Cost of sales", "one", [r"^cost of (sales|goods sold|revenue)"]),
    "IS.GROSS_PROFIT": ("IS", "Gross profit", "one", [r"^gross (profit|loss)"]),
    "IS.DISTRIBUTION": ("IS", "Distribution / selling costs", "sum", [r"^(distribution|selling)"]),
    "IS.ADMIN": ("IS", "Administrative expenses", "sum", [r"^administrat", r"^general and administrative"]),
    "IS.OTHER_OPEX": ("IS", "Other operating expenses", "sum", [r"^other (operating )?(expenses|charges)", r"^exploration costs", r"impairment"]),
    "IS.OTHER_INCOME": ("IS", "Other income", "sum", [r"^other (operating )?income"]),
    "IS.OPERATING_PROFIT": ("IS", "Operating profit (EBIT)", "one", [r"^operating profit", r"^profit from operations"]),
    "IS.FINANCE_COST": ("IS", "Finance cost", "sum", [r"^finance (cost|charges)", r"^financial charges", r"^mark.?up"]),
    "IS.PBT": ("IS", "Profit before tax", "one", [r"^profit before (income )?tax(ation)?$", r"^(profit|loss) before tax", r"^profit before income tax$"]),
    "IS.LEVIES": ("IS", "Levies / final taxes", "sum", [r"^(final taxes|levies|levy)"]),
    "IS.TAX": ("IS", "Taxation", "sum", [r"^(provision for )?taxation$", r"^income tax expense", r"^taxation"]),
    "IS.NET_PROFIT": ("IS", "Net profit after tax", "one", [r"^(net )?(profit|loss|\(loss\) / profit|profit / \(loss\)) (for|after) (the year|tax)"]),
    # ---------------- Cash flow
    "CF.CFO": ("CF", "Cash flow from operations", "one",
               [r"^net cash .{0,40}operating activities", r"^net cash (generated|from|provided|used)( from| in)? operating", r"^cash (generated|provided|used) (from|by|in) operating activities", r"^net cash flows? from operating"]),
    "CF.DEPRECIATION": ("CF", "Depreciation & amortisation", "sum", [r"^depreciation", r"^amortisation", r"^amortization"]),
    "CF.CAPEX": ("CF", "Capital expenditure", "sum", [r"^capital expenditure", r"^(purchase|acquisition|additions?) (of|to) (property|fixed|operating fixed)", r"^fixed capital expenditure"]),
    "CF.CFI": ("CF", "Cash flow from investing", "one", [r"^net cash .{0,40}investing activities", r"^net cash (generated|from|used|flows?)( from| in)? investing", r"^cash (generated|used|provided) (from|in|by) investing"]),
    "CF.DIVIDENDS_PAID": ("CF", "Dividends paid", "sum", [r"^dividends? paid"]),
    "CF.DEBT_REPAID": ("CF", "Repayment of borrowings", "sum", [r"^repayment of (long|short)", r"^repayment of (loans|borrowings|financing|sukuk)"]),
    "CF.CFF": ("CF", "Cash flow from financing", "one", [r"^net cash .{0,40}financing activities", r"^net cash (generated|from|used|flows?)( from| in)? financing", r"^cash (generated|used|provided) (from|in|by) financing"]),
    "CF.NET_CHANGE": ("CF", "Net change in cash", "one", [r"^net (increase|decrease|\(decrease\) / increase|increase / \(decrease\)) in cash"]),
    "CF.CASH_END": ("CF", "Cash at end of year", "one", [r"^cash and cash equivalents at (the )?end"]),
}

CODES = list(TAXONOMY.keys())
_ASSET_CODES = {"BS.PPE", "BS.INTANGIBLES", "BS.LT_INVESTMENTS", "BS.OTHER_NCA", "BS.TOTAL_NCA", "BS.INVENTORY",
                "BS.TRADE_RECEIVABLES", "BS.OTHER_RECEIVABLES", "BS.ST_INVESTMENTS", "BS.CASH", "BS.TOTAL_CA", "BS.TOTAL_ASSETS"}
BS_SIDE = {c: ("A" if c in _ASSET_CODES else "L") for c, v in TAXONOMY.items() if v[0] == "BS"}


def describe_taxonomy() -> str:
    return "\n".join(f"{c}: {v[1]}" for c, v in TAXONOMY.items())


def rule_map(row: dict, page_sections: set[str]) -> str | None:
    label = (row.get("label") or "").strip().lower()
    st = row["statement"]
    section = (row.get("section") or "").lower()
    if row.get("is_subtotal"):
        if label.startswith("grand total"):
            if st == "BS":
                return "BS.TOTAL_EQ_LIAB" if any("liabilit" in s.lower() for s in page_sections) else "BS.TOTAL_ASSETS"
            return None
        if st == "BS":
            if "non current assets" in section or "non-current assets" in section:
                return None  # partial subtotal; let the LLM / totals decide
            if re.search(r"^current assets", section):
                return "BS.TOTAL_CA"
            if re.search(r"non.?current liabilities", section):
                return "BS.TOTAL_NCL"
            if re.search(r"^current liabilities", section):
                return "BS.TOTAL_CL"
            if re.search(r"(share capital|equity)", section):
                return "BS.TOTAL_EQUITY"
        return None
    side = None
    if st == "BS":
        if "asset" in section:
            side = "A"
        elif re.search(r"liabilit|equity|capital|reserve", section):
            side = "L"
    for code, (stmt, _name, _agg, pats) in TAXONOMY.items():
        if stmt != st:
            continue
        if side and code in BS_SIDE and BS_SIDE[code] != side:
            continue
        for p in pats:
            if re.search(p, label):
                # section sanity: long-term deposits under non-current *assets* is an asset
                if code == "BS.OTHER_NCL" and "asset" in section:
                    return "BS.OTHER_NCA"
                return code
    return None
