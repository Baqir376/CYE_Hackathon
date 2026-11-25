"""Regression tests: known documents must keep giving exactly these answers."""
import os

import pymupdf
import pytest
from conftest import REAL, SAMPLE

from app.parser import parse_document


def test_sample_spread(analysed):
    want = {"IS.REVENUE": 4850, "IS.NET_PROFIT": 125, "BS.TOTAL_ASSETS": 5377, "BS.TOTAL_EQUITY": 1865, "X.TOTAL_DEBT": 2576,
            "CF.CFO": -396, "X.EBIT": 540, "X.FCF": -718, "BS.TOTAL_CL": 2639}
    assert {k: analysed["spread"][k]["values"]["FY2026"]["value"] / 1e6 for k in want} == pytest.approx(want)


def test_sample_ratios(analysed):
    r = {k: analysed["ratios"][k]["values"]["FY2026"] for k in ("current_ratio", "interest_cover", "debt_to_equity", "gross_margin")}
    assert r == pytest.approx({"current_ratio": 3192 / 2639, "interest_cover": 540 / 342, "debt_to_equity": 2576 / 1865, "gross_margin": 0.16})


def test_sample_signals_and_failures(analysed):
    assert {s["id"] for s in analysed["signals"]} == {"NEG_CFO", "RECV_OUTPACE", "LEVERAGE_UP", "COVER_DOWN"}
    assert sorted(c["id"].split(":")[0] for c in analysed["checks"] if c["status"] == "fail") == ["ARITH", "BS_LIAB"]
    assert any(c["id"].startswith("AUDIT:emphasis") for c in analysed["checks"])


def test_every_figure_traces_to_a_real_cell(analysed):
    """The core promise: re-read the PDF inside each stored box and find the same printed text."""
    doc, n = pymupdf.open(SAMPLE), 0
    for r in analysed["rows"]:
        for cell in r["values"].values():
            x0, y0, x1, y1 = cell["bbox"]
            words = [w[4] for w in doc[r["page"] - 1].get_text("words", clip=pymupdf.Rect(x0 - 1, y0 - 1, x1 + 1, y1 + 1))]
            assert cell["raw"] in words, (r["label"], cell)
            n += 1
    assert n == 120


@pytest.mark.skipif(not os.path.exists(REAL), reason="the real PSX report is not in the repository")
def test_real_report():
    d = parse_document(REAL)
    assert [p["page"] for p in d["statement_pages"]] == [100, 101, 102, 105]
    assert (d["page_count"], d["unit"], d["periods"], d["basis"]) == (227, 1000, ["FY2026", "FY2025"], "standalone")
    assert sum(bool(r["verified_sum_of"]) for r in d["rows"]) == 20
