"""Run: python -m unittest discover -s tests   (from the backend folder)"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import analysis, pipeline  # noqa: E402
from app.guard import check_sentence, guard  # noqa: E402
from app.mapper import map_rows  # noqa: E402
from app.memo import build_facts, write_memo  # noqa: E402
from app.parser import parse_document  # noqa: E402

SAMPLE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "samples", "sutlej_demo_textiles.pdf")


def analysed():
    d = parse_document(SAMPLE)
    rows = pipeline._prefix_rows(d["rows"], 1, "d1", d["unit"])
    mapped, _ = map_rows(rows, use_llm=False)
    case = {"rows": mapped, "overrides": {}, "policy": "default",
            "documents": [{"id": "d1", "periods": d["periods"], "unit": d["unit"], "auditor_flags": d["auditor_flags"]}]}
    return pipeline.analyze(case)


class GuardTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.case = analysed()
        cls.facts = build_facts(cls.case["spread"], cls.case["ratios"], cls.case["periods"], cls.case["signals"])

    def status(self, text):
        r = check_sentence(text, self.facts)
        return r["status"], r["problems"]

    def test_wrong_sentences_are_blocked(self):
        bad = [
            "Net profit was Rs 4,850 mn [F:IS.NET_PROFIT:FY2026].",                       # real figure, wrong fact
            "Net profit was Rs 4,850 mn [F:IS.REVENUE:FY2026].",                          # right citation, wrong name
            "Interest cover was 125.0x [R:interest_cover:FY2026].",
            "Net profit was Rs 125.0 bn [F:IS.NET_PROFIT:FY2026].",                       # wrong unit
            "Net profit was Rs 125.0 billion [F:IS.NET_PROFIT:FY2026].",
            "Net profit was -Rs 125.0 mn [F:IS.NET_PROFIT:FY2026].",                      # wrong sign
            "Cash flow from operations was Rs 396.0 mn [F:CF.CFO:FY2026].",               # dropped minus
            "Net revenue was Rs 14,850 mn [F:IS.REVENUE:FY2026].",
            "Net revenue tripled to Rs 4,850 mn [F:IS.REVENUE:FY2026].",
            "Net revenue was Rs 4,850 mn [F:IS.REVENUE:FY2026], up 40%.",
            "Revenue will reach Rs 6,200 mn [F:IS.REVENUE:FY2026].",
            "Revenue will reach Rs 6,200 mn.",
            "Net revenue in FY2025 was Rs 4,850 mn [F:IS.REVENUE:FY2026].",               # wrong year
            "Net revenue was Rs 4,850 mn [F:IS.REVENUE:FY2026] in FY2025.",
            "Net profit rose to Rs 125.0 mn [F:IS.NET_PROFIT:FY2026] from Rs 273.0 mn [F:IS.NET_PROFIT:FY2025].",  # it fell
            "Finance cost fell to Rs 342.0 mn [F:IS.FINANCE_COST:FY2026] from Rs 228.0 mn [F:IS.FINANCE_COST:FY2025].",
            "The company reported Rs 125.0 mn [F:IS.NET_PROFIT:FY2026].",                 # never says what it is
            "Net revenue was Rs 4,850 mn [F:IS.MADE_UP:FY2026].",
            "Operations consumed Rs 99.0 mn of cash in FY2026 [S:NEG_CFO:FY2026].",
        ]
        for t in bad:
            with self.subTest(t):
                self.assertEqual(self.status(t)[0], "unverified", t)

    def test_correct_sentences_pass(self):
        ok = [
            "Net revenue was Rs 4,850 mn [F:IS.REVENUE:FY2026], compared with Rs 4,450 mn [F:IS.REVENUE:FY2025] in FY2025.",
            "Net profit fell to Rs 125.0 mn [F:IS.NET_PROFIT:FY2026] from Rs 273.0 mn [F:IS.NET_PROFIT:FY2025].",
            "Finance cost increased to Rs 342.0 mn [F:IS.FINANCE_COST:FY2026] from Rs 228.0 mn [F:IS.FINANCE_COST:FY2025].",
            "Cash flow from operations was -Rs 396.0 mn [F:CF.CFO:FY2026].",
            "Cash flow from operations was Rs -396.0 mn [F:CF.CFO:FY2026].",
            "Debt / Equity rose to 1.38x [R:debt_to_equity:FY2026] from 1.10x [R:debt_to_equity:FY2025].",
            "Interest cover weakened to 1.58x [R:interest_cover:FY2026] from 2.72x [R:interest_cover:FY2025].",
        ]
        for t in ok:
            with self.subTest(t):
                st, why = self.status(t)
                self.assertEqual(st, "verified", (t, why))

    def test_qualitative_text_is_not_called_verified(self):
        self.assertEqual(self.status("Working capital management deserves attention.")[0], "narrative")

    def test_placeholders_are_filled_by_python(self):
        s = guard("Net revenue was {{F:IS.REVENUE:FY2026}}. Net profit was {{F:IS.REVENUE:FY2026}}.", self.facts)["sentences"]
        self.assertEqual([x["status"] for x in s], ["verified", "unverified"])
        self.assertIn("Rs 4,850 mn [F:IS.REVENUE:FY2026]", s[0]["text"])
        self.assertEqual(guard("Net revenue was {{F:NOPE:FY2026}}.", self.facts)["sentences"][0]["status"], "unverified")

    def test_template_memo_passes_its_own_guard(self):
        c = self.case
        m = write_memo(c, c["spread"], c["ratios"], c["signals"], c["checks"], c["periods"], use_llm=False)
        bad = [(s["text"], s["problems"]) for sec in m["sections"] for s in sec["sentences"] if s["status"] == "unverified"]
        self.assertEqual(bad, [])
        self.assertGreater(m["stats"]["verified"], 10)

    def test_planted_typo_is_caught(self):
        fails = [x for x in self.case["checks"] if x["status"] == "fail" and x["id"].startswith("ARITH:")]
        self.assertEqual(len(fails), 1)
        self.assertEqual(fails[0]["difference"], 10_000 * 1000)
        self.assertEqual(analysis.fmt_money(fails[0]["difference"]), "Rs 10.0 mn")


if __name__ == "__main__":
    unittest.main()
