"""Export the sample statements (real parser output) for the landing page loupe. Run from the backend folder."""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from app import pipeline  # noqa: E402
from app.mapper import map_rows  # noqa: E402
from app.parser import parse_document  # noqa: E402
from app.taxonomy import TAXONOMY  # noqa: E402

d = parse_document(os.path.join(ROOT, "samples", "sutlej_demo_textiles.pdf"))
rows = pipeline._prefix_rows(d["rows"], 1, "d1", d["unit"])
mapped, _ = map_rows(rows, use_llm=False)
case = pipeline.analyze({"rows": mapped, "overrides": {}, "policy": "default",
                         "documents": [{"id": "d1", "periods": d["periods"], "unit": d["unit"], "auditor_flags": []}]})
fails = [c for c in case["checks"] if c["id"].startswith("ARITH:") and c["status"] == "fail"]
bad = {c["rows"][0]: c["difference"] / 1000 for c in fails}
parts = {c["rows"][0]: c["rows"][1:] for c in fails}
out = []
for r in mapped:
    boxes = [c["bbox"] for c in r["values"].values()]
    out.append({"id": r["id"], "page": r["page"], "y": round((boxes[0][1] + boxes[0][3]) / 2, 1), "lx": round((r["label_bbox"] or [68])[0], 1),
                "label": "" if r["is_subtotal"] else r["label"], "code": TAXONOMY[r["code"]][1] if r["code"] else None,
                "cells": [{"t": c["raw"], "b": c["bbox"]} for c in r["values"].values()],
                "sum": r["verified_sum_of"] or parts.get(r["id"], []), "off": bad.get(r["id"])})
s = case["spread"]


def v(k):
    return abs(s[k]["values"]["FY2026"]["value"]) if k in s else 0


base = {"rev": v("IS.REVENUE"), "oi": v("IS.OTHER_INCOME"), "cogs": v("IS.COGS"), "ebit": v("X.EBIT"), "fc": v("IS.FINANCE_COST"), "np": v("IS.NET_PROFIT"),
        "debt": v("X.TOTAL_DEBT"), "ca": v("BS.TOTAL_CA"), "cl": v("BS.TOTAL_CL"), "inv": v("BS.INVENTORY"), "recv": v("BS.TRADE_RECEIVABLES"),
        "equity": v("BS.TOTAL_EQUITY"), "liab": v("BS.TOTAL_LIABILITIES"), "dep": v("CF.DEPRECIATION"), "cpltd": v("BS.CURRENT_PORTION_LTD")}
data = {"rows": out, "base": base, "limits": {p["ratio"]: p["rule"] for p in case["policy_results"]},
        "ratios": {k: r["values"].get("FY2026") for k, r in case["ratios"].items()}}
with open(os.path.join(ROOT, "..", "frontend", "lib", "ledger.json"), "w", encoding="utf-8") as f:
    json.dump(data, f, separators=(",", ":"))
print(len(out), "rows", sum(bool(x["sum"]) for x in out), "sums", bad)
