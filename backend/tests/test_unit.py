"""Unit tests: one function at a time."""
import pytest

from app import analysis as A
from app.parser import detect_unit, parse_number
from app.taxonomy import TAXONOMY, rule_map


@pytest.mark.parametrize("tok,val", [("1,234", 1234), ("(1,234)", -1234), ("-5", -5), ("-", 0), ("–", 0), ("0.85", 0.85),
                                     ("12a", None), ("", None), ("(abc)", None), ("1.2.3", None)])
def test_parse_number(tok, val):
    assert parse_number(tok) == val


@pytest.mark.parametrize("txt,unit", [("Rupees in '000", 1000), ("Rupees (‘000)", 1000), ("(Rupees in thousand)", 1000),
                                      ("Rupees in million", 1_000_000), ("Rupees", 1)])
def test_detect_unit(txt, unit):
    assert detect_unit(txt) == unit


@pytest.mark.parametrize("label,section,stmt,code", [
    ("Trade debts", "CURRENT ASSETS", "BS", "BS.TRADE_RECEIVABLES"), ("Stock in trade", "CURRENT ASSETS", "BS", "BS.INVENTORY"),
    ("Long term deposits", "NON CURRENT LIABILITIES", "BS", "BS.OTHER_NCL"), ("Long term deposits", "NON-CURRENT ASSETS", "BS", "BS.OTHER_NCA"),
    ("TOTAL EQUITY AND LIABILITIES", "", "BS", "BS.TOTAL_EQ_LIAB"), ("Accrued mark-up", "CURRENT LIABILITIES", "BS", "BS.ACCRUED_MARKUP"),
    ("Sales - net", "", "IS", "IS.REVENUE"), ("Profit for the year", "", "IS", "IS.NET_PROFIT"), ("Finance cost", "", "CF", None),
    ("Net cash (used in) / generated from operating activities", "", "CF", "CF.CFO"),
])
def test_rules_use_label_and_section(label, section, stmt, code):
    assert rule_map({"label": label, "section": section, "statement": stmt, "is_subtotal": False}, set()) == code


@pytest.mark.parametrize("v,s", [(4_850_000_000, "Rs 4,850 mn"), (-396_000_000, "-Rs 396.0 mn"), (0, "Rs 0k"), (None, "n/a")])
def test_fmt_money(v, s):
    assert A.fmt_money(v) == s


def test_ratios_never_divide_by_zero():
    cell = lambda v: {"name": "", "values": {"FY2026": {"value": v, "rows": []}}}  # noqa: E731
    out = A.compute_ratios({"BS.TOTAL_CA": cell(5), "BS.TOTAL_CL": cell(0)}, ["FY2026"])
    assert out["current_ratio"]["values"] == {}


def test_policies_only_use_ratios_that_exist():
    keys = {r[0] for r in A.RATIOS}
    for p in A.list_policies():
        assert set(A.load_policy(p["id"])["thresholds"]) <= keys


def test_same_borrower_different_policy_different_verdict(analysed):
    def st(pol):
        return {x["ratio"]: x["status"] for x in A.apply_policy(analysed["ratios"], analysed["periods"], A.load_policy(pol))}
    assert st("default")["interest_cover"] == "watch"
    assert st("sme_conservative")["interest_cover"] == "breach"


def test_taxonomy_codes_match_their_statement():
    assert all(c.split(".")[0] == v[0] for c, v in TAXONOMY.items())


def test_numbers_set_wider_than_their_year_heading_still_land_in_the_right_column(tmp_path):
    import pymupdf

    from app.parser import parse_document
    d = pymupdf.open()
    p = d.new_page()
    put = lambda x, y, t: p.insert_text((x - pymupdf.get_text_length(t, fontsize=9), y), t, fontsize=9)  # noqa: E731
    p.insert_text((60, 80), "BALANCE SHEET", fontsize=12)
    put(420, 110, "2026"), put(520, 110, "2025")
    for i, (label, a, b) in enumerate([("Trade debts", "1,420,000", "960,000"), ("Cash and bank balances", "62,000", "118,000")]):
        p.insert_text((60, 140 + i * 18), label, fontsize=9)
        put(440, 140 + i * 18, a), put(540, 140 + i * 18, b)  # 20 points right of the heading
    f = tmp_path / "wide.pdf"
    d.save(f)
    rows = parse_document(str(f))["rows"]
    assert [{k: c["value"] for k, c in r["values"].items()} for r in rows] == [{"FY2026": 1420000, "FY2025": 960000}, {"FY2026": 62000, "FY2025": 118000}]
