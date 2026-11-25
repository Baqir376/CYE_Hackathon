"""Generate a FICTIONAL SME financial-statement PDF for demos.

Accounts are internally consistent (cash flow is derived from balance-sheet movements), except for ONE
deliberate typo in the FY2026 current-liabilities subtotal so the validator has something real to catch.
The company is fictional; every page is watermarked as demo data.
"""
import os
import sys

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "samples", "sutlej_demo_textiles.pdf")
CO = "Sutlej Demo Textiles (Private) Limited"
W, H = A4
X_LABEL, X_NOTE, X_Y1, X_Y2 = 60, 330, 430, 520  # right edges for numbers


def fmt(v):
    if v is None:
        return ""
    if v == 0:
        return "-"
    s = f"{abs(v):,.0f}"
    return f"({s})" if v < 0 else s


def footer(c, page):
    c.setFont("Helvetica", 7)
    c.setFillGray(0.55)
    c.drawString(60, 30, "FICTIONAL SAMPLE - generated demo data for Credence AI. Not a real company.")
    c.drawRightString(W - 60, 30, str(page))
    c.setFillGray(0)


def header(c, title, sub):
    c.setFont("Helvetica-Bold", 11)
    c.drawString(60, H - 60, CO)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(60, H - 85, title)
    c.setFont("Helvetica", 9)
    c.drawString(60, H - 100, sub)
    y = H - 130
    c.setFont("Helvetica-Bold", 9)
    c.drawRightString(X_Y1, y, "2026")
    c.drawRightString(X_Y2, y, "2025")
    y -= 13
    c.setFont("Helvetica", 8)
    c.drawRightString(X_NOTE, y, "Note")
    c.drawRightString(X_Y2, y, "Rupees in '000")
    return y - 20


def table(c, y, rows):
    for r in rows:
        kind = r[0]
        if kind == "h":
            c.setFont("Helvetica-Bold", 9)
            c.drawString(X_LABEL, y, r[1])
            y -= 15
            continue
        if kind == "gap":
            y -= 8
            continue
        _, label, note, a, b = r
        bold = kind in ("t", "T")
        c.setFont("Helvetica-Bold" if bold else "Helvetica", 9)
        if label:
            c.drawString(X_LABEL + (0 if bold else 8), y, label)
        if note:
            c.drawRightString(X_NOTE, y, str(note))
        c.drawRightString(X_Y1, y, fmt(a))
        c.drawRightString(X_Y2, y, fmt(b))
        if kind in ("t", "T"):
            c.setLineWidth(0.5)
            c.line(X_Y1 - 60, y + 10, X_Y1, y + 10)
            c.line(X_Y2 - 60, y + 10, X_Y2, y + 10)
            if kind == "T":
                c.line(X_Y1 - 60, y - 3, X_Y1, y - 3)
                c.line(X_Y2 - 60, y - 3, X_Y2, y - 3)
        y -= 15
    return y


def sign(c, y):
    y -= 40
    c.setFont("Helvetica", 8)
    c.drawString(60, y, "The annexed notes form an integral part of these financial statements.")
    y -= 50
    for x, t in ((60, "Chief Executive"), (250, "Director"), (420, "Chief Financial Officer")):
        c.drawString(x, y, t)


def build():
    # ---------------- figures (Rs '000) — FY2026, FY2025
    bs = dict(
        ppe=(2_150_000, 2_010_000), dep=(35_000, 32_000), stores=(120_000, 110_000), stock=(1_310_000, 1_020_000),
        debts=(1_420_000, 960_000), adv=(185_000, 150_000), tax=(95_000, 80_000), cash=(62_000, 118_000),
        cap=(600_000, 600_000), unapp=(1_265_000, 1_140_000), ltf=(720_000, 620_000), lease=(45_000, 52_000),
        dtax=(118_000, 108_000), pay=(760_000, 690_000), markup=(58_000, 31_000), stb=(1_580_000, 1_050_000),
        cpltf=(205_000, 165_000), cplease=(26_000, 24_000),
    )
    t = lambda *ks, i: sum(bs[k][i] for k in ks)  # noqa: E731
    nca = [t("ppe", "dep", i=i) for i in (0, 1)]
    ca = [t("stores", "stock", "debts", "adv", "tax", "cash", i=i) for i in (0, 1)]
    ta = [nca[i] + ca[i] for i in (0, 1)]
    eq = [t("cap", "unapp", i=i) for i in (0, 1)]
    ncl = [t("ltf", "lease", "dtax", i=i) for i in (0, 1)]
    cl = [t("pay", "markup", "stb", "cpltf", "cplease", i=i) for i in (0, 1)]
    tel = [eq[i] + ncl[i] + cl[i] for i in (0, 1)]
    assert ta == tel, (ta, tel)
    cl_printed = [cl[0] + 10_000, cl[1]]  # <-- deliberate typo in FY2026 subtotal

    c = canvas.Canvas(OUT, pagesize=A4)
    c.setTitle(f"{CO} - Financial Statements 2026 (FICTIONAL SAMPLE)")
    # cover
    c.setFont("Helvetica-Bold", 22)
    c.drawString(60, H - 220, CO)
    c.setFont("Helvetica", 14)
    c.drawString(60, H - 250, "Financial Statements for the year ended June 30, 2026")
    c.setFont("Helvetica", 10)
    c.drawString(60, H - 290, "Submitted in support of: renewal and enhancement of running finance facility")
    c.setFillColorRGB(0.75, 0.1, 0.1)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(60, H - 340, "FICTIONAL SAMPLE DATA FOR SOFTWARE DEMONSTRATION")
    c.setFillGray(0)
    footer(c, 1)
    c.showPage()
    # auditor's report
    c.setFont("Helvetica-Bold", 13)
    c.drawString(60, H - 70, "INDEPENDENT AUDITOR'S REPORT")
    c.setFont("Helvetica", 9)
    txt = [
        f"To the members of {CO}",
        "",
        "Opinion",
        "We have audited the annexed financial statements of the Company, which comprise the statement of",
        "financial position as at June 30, 2026, the statement of profit or loss, the statement of cash flows",
        "for the year then ended, and notes to the financial statements.",
        "",
        "Emphasis of Matter",
        "We draw attention to note 9.1 to the financial statements, which describes a sales tax demand raised",
        "by the tax authorities against the Company that is currently pending adjudication. The ultimate outcome",
        "of the matter cannot presently be determined. Our opinion is not modified in respect of this matter.",
        "",
        "Chartered Accountants (fictional)      Lahore      Date: September 30, 2026",
    ]
    y = H - 100
    for line in txt:
        if line in ("Opinion", "Emphasis of Matter"):
            c.setFont("Helvetica-Bold", 10)
        c.drawString(60, y, line)
        c.setFont("Helvetica", 9)
        y -= 14
    footer(c, 2)
    c.showPage()
    # statement of financial position
    y = header(c, "STATEMENT OF FINANCIAL POSITION", "AS AT JUNE 30, 2026")
    rows = [
        ("h", "ASSETS"), ("h", "NON-CURRENT ASSETS"),
        ("r", "Property, plant and equipment", 4, *bs["ppe"]), ("r", "Long term deposits", None, *bs["dep"]),
        ("t", "", None, *nca), ("gap",), ("h", "CURRENT ASSETS"),
        ("r", "Stores, spares and loose tools", None, *bs["stores"]), ("r", "Stock in trade", 5, *bs["stock"]),
        ("r", "Trade debts", 6, *bs["debts"]), ("r", "Loans, advances, deposits and other receivables", None, *bs["adv"]),
        ("r", "Taxation - net", None, *bs["tax"]), ("r", "Cash and bank balances", None, *bs["cash"]),
        ("t", "", None, *ca), ("gap",), ("T", "TOTAL ASSETS", None, *ta), ("gap",),
        ("h", "EQUITY AND LIABILITIES"), ("h", "SHARE CAPITAL AND RESERVES"),
        ("r", "Issued, subscribed and paid up capital", None, *bs["cap"]), ("r", "Unappropriated profit", None, *bs["unapp"]),
        ("t", "", None, *eq), ("gap",), ("h", "NON-CURRENT LIABILITIES"),
        ("r", "Long term financing", 7, *bs["ltf"]), ("r", "Lease liabilities", None, *bs["lease"]),
        ("r", "Deferred taxation", None, *bs["dtax"]), ("t", "", None, *ncl), ("gap",), ("h", "CURRENT LIABILITIES"),
        ("r", "Trade and other payables", None, *bs["pay"]), ("r", "Accrued mark-up", None, *bs["markup"]),
        ("r", "Short term borrowings", 8, *bs["stb"]), ("r", "Current portion of long term financing", 7, *bs["cpltf"]),
        ("r", "Current portion of lease liabilities", None, *bs["cplease"]), ("t", "", None, *cl_printed), ("gap",),
        ("h", "CONTINGENCIES AND COMMITMENTS"), ("gap",),
        ("T", "TOTAL EQUITY AND LIABILITIES", None, *tel),
    ]
    y = table(c, y, rows)
    sign(c, y)
    footer(c, 3)
    c.showPage()
    # profit or loss
    rev, cogs = (4_850_000, 4_450_000), (-4_074_000, -3_604_500)
    gp = [rev[i] + cogs[i] for i in (0, 1)]
    dist, adm, oox, oi = (-98_000, -90_000), (-142_000, -130_000), (-18_000, -21_000), (22_000, 15_000)
    op = [gp[i] + dist[i] + adm[i] + oox[i] + oi[i] for i in (0, 1)]
    fc = (-342_000, -228_000)
    pbt = [op[i] + fc[i] for i in (0, 1)]
    tx = (-73_000, -118_500)
    np_ = [pbt[i] + tx[i] for i in (0, 1)]
    assert np_[0] == bs["unapp"][0] - bs["unapp"][1], np_
    y = header(c, "STATEMENT OF PROFIT OR LOSS", "FOR THE YEAR ENDED JUNE 30, 2026")
    y = table(c, y, [
        ("r", "Sales - net", 10, *rev), ("r", "Cost of sales", 11, *cogs), ("t", "Gross profit", None, *gp), ("gap",),
        ("r", "Distribution cost", None, *dist), ("r", "Administrative expenses", None, *adm),
        ("r", "Other operating expenses", None, *oox), ("r", "Other income", None, *oi),
        ("t", "Operating profit", None, *op), ("r", "Finance cost", 12, *fc), ("t", "Profit before taxation", None, *pbt),
        ("r", "Taxation", None, *tx), ("T", "Profit for the year", None, *np_),
    ])
    sign(c, y)
    footer(c, 4)
    c.showPage()
    # cash flows (indirect) — FY2026 derived from balance-sheet movements
    d = lambda k: bs[k][0] - bs[k][1]  # noqa: E731
    dep_exp = (182_000, 165_000)
    wc26 = [-d("stores"), -d("stock"), -d("debts"), -d("adv"), d("pay")]
    wc25 = [-8_000, -60_000, -85_000, -10_000, 40_000]
    pre = [pbt[0] + dep_exp[0] - fc[0], pbt[1] + dep_exp[1] - fc[1]]
    gen = [pre[0] + sum(wc26), pre[1] + sum(wc25)]
    fcp = (fc[0] + d("markup"), -220_000)
    cur_tax = tx[0] + d("dtax")
    taxp = (cur_tax - d("tax"), -95_000)
    cfo = [gen[0] + fcp[0] + taxp[0], gen[1] + fcp[1] + taxp[1]]
    capex = (-(d("ppe") + dep_exp[0]), -260_000)
    depm = (-d("dep"), -2_000)
    cfi = [capex[0] + depm[0], capex[1] + depm[1]]
    lt_new, lt_rep = (300_000, 150_000), (-(300_000 - (d("ltf") + d("cpltf"))), -140_000)
    lease_p = ((d("lease") + d("cplease")), -30_000)
    cff = [lt_new[i] + lt_rep[i] + lease_p[i] for i in (0, 1)]
    net = [cfo[i] + cfi[i] + cff[i] for i in (0, 1)]
    close = [bs["cash"][0] - bs["stb"][0], bs["cash"][1] - bs["stb"][1]]
    opening = [close[1], close[1] - net[1]]
    assert opening[0] + net[0] == close[0], (opening, net, close)
    y = header(c, "STATEMENT OF CASH FLOWS", "FOR THE YEAR ENDED JUNE 30, 2026")
    y = table(c, y, [
        ("h", "CASH FLOWS FROM OPERATING ACTIVITIES"),
        ("r", "Profit before taxation", None, *pbt), ("r", "Depreciation", None, *dep_exp), ("r", "Finance cost", None, -fc[0], -fc[1]),
        ("t", "", None, *pre),
        ("r", "(Increase) in stores, spares and loose tools", None, wc26[0], wc25[0]), ("r", "(Increase) in stock in trade", None, wc26[1], wc25[1]),
        ("r", "(Increase) in trade debts", None, wc26[2], wc25[2]), ("r", "(Increase) in advances and other receivables", None, wc26[3], wc25[3]),
        ("r", "Increase in trade and other payables", None, wc26[4], wc25[4]), ("t", "Cash generated from operations", None, *gen),
        ("r", "Finance cost paid", None, *fcp), ("r", "Taxes paid", None, *taxp),
        ("t", "Net cash (used in) / generated from operating activities", None, *cfo), ("gap",),
        ("h", "CASH FLOWS FROM INVESTING ACTIVITIES"),
        ("r", "Capital expenditure", None, *capex), ("r", "Long term deposits", None, *depm),
        ("t", "Net cash used in investing activities", None, *cfi), ("gap",),
        ("h", "CASH FLOWS FROM FINANCING ACTIVITIES"),
        ("r", "Long term financing obtained", None, *lt_new), ("r", "Repayment of long term financing", None, *lt_rep),
        ("r", "Lease rentals paid", None, *lease_p), ("t", "Net cash generated from / (used in) financing activities", None, *cff), ("gap",),
        ("t", "Net (decrease) / increase in cash and cash equivalents", None, *net),
        ("r", "Cash and cash equivalents at beginning of the year", None, *opening),
        ("T", "Cash and cash equivalents at end of the year", 13, *close),
    ])
    sign(c, y)
    footer(c, 5)
    c.showPage()
    # notes (short)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(60, H - 60, "NOTES TO THE FINANCIAL STATEMENTS")
    c.setFont("Helvetica", 9)
    notes = [
        "8. SHORT TERM BORROWINGS",
        "Running finance facilities are available from commercial banks under mark-up arrangements with an",
        "aggregate limit of Rs 1,800 million (2025: Rs 1,300 million), carrying mark-up at 3-month KIBOR plus 2.0%",
        "per annum, secured by joint pari passu hypothecation charge over current assets of the Company.",
        "",
        "9. CONTINGENCIES AND COMMITMENTS",
        "9.1 The tax authorities have raised a sales tax demand of Rs 96 million for tax year 2023. The Company has",
        "filed an appeal and, based on the advice of its tax consultant, expects a favourable outcome.",
        "",
        "13. CASH AND CASH EQUIVALENTS",
        "Cash and cash equivalents comprise cash and bank balances net of short term borrowings (running finance).",
    ]
    y = H - 90
    for n in notes:
        c.drawString(60, y, n)
        y -= 14
    footer(c, 6)
    c.showPage()
    c.save()
    print("written", OUT, "| TA", ta, "| CL true", cl, "printed", cl_printed, "| CFO", cfo, "| net", net)


if __name__ == "__main__":
    build()
