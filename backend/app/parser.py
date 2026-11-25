"""Deterministic financial-statement parser.

Turns a PDF into statement rows where every number carries its exact page + bounding box.
No LLM is involved here: numbers are read from the PDF text layer, never generated.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field, asdict
from typing import Optional

import pymupdf

NUM_RE = re.compile(r"^\(?-?[\d,]*\d(?:\.\d+)?\)?$")
DASH_TOKENS = {"-", "–", "—", "--"}
YEAR_RE = re.compile(r"^(19|20)\d{2}$")
NOTE_RE = re.compile(r"^\d{1,2}(\.\d{1,2})?$")

TITLE_PATTERNS = {
    "BS": re.compile(r"^(un)?(consolidated\s+)?(statement of financial position|balance sheet)\s*(\(.*\))?\s*$", re.I),
    "IS": re.compile(
        r"^(un)?(consolidated\s+)?(statement of profit or loss|profit and loss account|income statement"
        r"|statement of profit and loss)( and other comprehensive income)?\s*$",
        re.I,
    ),
    "CF": re.compile(r"^(un)?(consolidated\s+)?(statement of cash ?flows?|cash flow statement)\s*$", re.I),
}
NOTES_RE = re.compile(r"notes to (and forming part of )?(the )?(consolidated )?financial statements", re.I)
UNIT_PATTERNS = [
    (re.compile(r"rupees\W*(in\W*)?\W*million|rs\.?\W*in\W*million|\(rs\.?\W*m\)", re.I), 1_000_000),
    (re.compile(r"rupees\W*(in\W*)?\W{0,4}000|rupees in thousands?|rs\.?\W*(in\W*)?\W{0,3}000|in thousands", re.I), 1000),
]
AUDIT_FLAGS = [
    ("qualified opinion", "Auditor issued a QUALIFIED opinion", "high"),
    ("adverse opinion", "Auditor issued an ADVERSE opinion", "high"),
    ("disclaimer of opinion", "Auditor DISCLAIMED an opinion", "high"),
    ("material uncertainty related to going concern", "Material uncertainty related to going concern", "high"),
    ("emphasis of matter", "Auditor included an Emphasis of Matter paragraph", "medium"),
    ("contingencies and commitments", "Contingencies and commitments disclosed (review note)", "low"),
]


@dataclass
class Cell:
    value: float
    raw: str
    bbox: list[float]


@dataclass
class Row:
    id: str
    statement: str  # BS / IS / CF
    page: int  # 1-based
    section: str
    label: str
    note: Optional[str]
    values: dict[str, Cell]  # period -> cell
    label_bbox: Optional[list[float]] = None
    is_subtotal: bool = False
    verified_sum_of: list[str] = field(default_factory=list)


@dataclass
class StatementPage:
    page: int
    statement: str
    consolidated: bool
    title: str
    periods: list[str]
    unit: int
    width: float
    height: float


def parse_number(tok: str) -> Optional[float]:
    t = tok.strip()
    if t in DASH_TOKENS:
        return 0.0
    if not NUM_RE.match(t):
        return None
    neg = t.startswith("(") and t.endswith(")") or t.startswith("-")
    t = t.strip("()").replace(",", "").lstrip("-")
    try:
        v = float(t)
    except ValueError:
        return None
    return -v if neg else v


def _group_rows(words, tol=3.0):
    words = sorted(words, key=lambda w: ((w[1] + w[3]) / 2, w[0]))
    rows, cur, cy = [], [], None
    for w in words:
        yc = (w[1] + w[3]) / 2
        if cy is None or abs(yc - cy) <= tol:
            cur.append(w)
            cy = yc if cy is None else (cy * (len(cur) - 1) + yc) / len(cur)
        else:
            rows.append(sorted(cur, key=lambda x: x[0]))
            cur, cy = [w], yc
    if cur:
        rows.append(sorted(cur, key=lambda x: x[0]))
    return rows


def classify_page(page) -> Optional[tuple[str, bool, str]]:
    lines = [l.strip() for l in page.get_text().splitlines() if l.strip()]
    if any(NOTES_RE.search(l) for l in lines[:12]):
        return None
    for l in lines:
        if len(l) > 90:
            continue
        for code, pat in TITLE_PATTERNS.items():
            if pat.match(l):
                if code == "IS" and re.search(r"comprehensive income", l, re.I) and not re.search(r"profit or loss and", l, re.I):
                    continue
                return code, "consolidated" in l.lower() and not l.lower().startswith("un"), l
    return None


def detect_unit(text: str) -> int:
    for pat, mult in UNIT_PATTERNS:
        if pat.search(text):
            return mult
    return 1


def _find_year_columns(rows):
    for r in rows:
        years = [w for w in r if YEAR_RE.match(w[4])]
        if len(years) >= 2 and len(years) >= len(r) - 3:
            cols = []
            for w in years:
                if w[4] not in [c[0] for c in cols]:
                    cols.append((w[4], w[2]))  # (year, x1 right edge)
            return cols, r
    return None, None


def parse_statement_page(page, page_no: int, statement: str, row_prefix: str, carry_periods=None):
    words = page.get_text("words")
    rows = _group_rows(words)
    cols, header_row = _find_year_columns(rows)
    if not cols and carry_periods:
        cols = carry_periods
    if not cols:
        return [], None
    periods = [f"FY{y}" for y, _ in cols]
    first_col_left = min(x for _, x in cols) - 75
    out: list[Row] = []
    section = ""
    pending_label: Optional[tuple[str, list[float]]] = None
    idx = 0
    started = header_row is None
    for r in rows:
        if r is header_row:
            started = True
            continue
        if not started:
            continue
        values: dict[str, Cell] = {}
        label_words, note = [], None
        for w in r:
            x0, y0, x1, y1, text = w[0], w[1], w[2], w[3], w[4]
            num = parse_number(text)
            if num is not None:
                best = min(cols, key=lambda c: abs(c[1] - x1))
                if abs(best[1] - x1) <= 45 and x0 > first_col_left - 10:
                    key = f"FY{best[0]}"
                    if key not in values:
                        values[key] = Cell(num, text, [round(x0, 1), round(y0, 1), round(x1, 1), round(y1, 1)])
                    continue
                if NOTE_RE.match(text) and x1 < first_col_left + 40 and label_words:
                    note = text
                    continue
            label_words.append(w)
        label = " ".join(w[4] for w in label_words).strip()
        lbbox = None
        if label_words:
            lbbox = [round(min(w[0] for w in label_words), 1), round(min(w[1] for w in label_words), 1),
                     round(max(w[2] for w in label_words), 1), round(max(w[3] for w in label_words), 1)]
        if re.match(r"^(the annexed notes|note|rupees|rs\.?)\b", label, re.I) and not values:
            continue
        if re.search(r"chief (executive|financial)|director$", label, re.I):
            break
        if not values:
            if not label or len(label) > 120:
                continue
            if pending_label and (label[:1].islower() or re.match(r"^(and|of|&|\()", label, re.I)):
                pending_label = (pending_label[0] + " " + label, pending_label[1])
            else:
                if pending_label and pending_label[0].isupper():
                    section = pending_label[0]
                pending_label = (label, lbbox)
            continue
        if pending_label:
            if label and (label[:1].islower() or re.match(r"^(and|of|&|\()", label, re.I)):
                label = pending_label[0] + " " + label
                lbbox = pending_label[1]
            elif not label and not pending_label[0].isupper():
                label, lbbox = pending_label
            else:
                section = pending_label[0] if pending_label[0].upper() == pending_label[0] else section
            pending_label = None
        if label and label.upper() == label and len(label) > 3 and re.search(r"[A-Z]", label):
            # uppercase labelled row with values (e.g. "NET SALES") — keep section unchanged
            pass
        idx += 1
        out.append(Row(
            id=f"{row_prefix}{page_no}-{idx}", statement=statement, page=page_no, section=section,
            label=label, note=note, values=values, label_bbox=lbbox, is_subtotal=not label,
        ))
    _verify_subtotals(out)
    return out, [(y, x) for y, x in cols]


TOTALISH_RE = re.compile(r"^(total|net|gross|sub-?total|profit|loss|cash (generated|provided|used)|.*\bactivities$)", re.I)


def _verify_subtotals(rows: list[Row]):
    """Check whether total-like rows equal the sum of the rows printed above them.

    Walks backwards over *top-level* items: once a row is verified as a sum, its components are
    skipped, so grand totals (sum of subtotals) verify too. Turns layout into arithmetic facts we can
    show the analyst ("verified: sum of 6 lines").
    """
    by_id = {r.id: r for r in rows}
    consumed: set[str] = set()
    for i, r in enumerate(rows):
        candidate = r.is_subtotal or TOTALISH_RE.match(r.label or "") or (r.label.isupper() and len(r.label) > 3)
        if not candidate or not r.values:
            continue
        periods = list(r.values.keys())
        p = periods[0]
        target = r.values[p].value
        if target == 0:
            continue
        acc, comps = 0.0, []
        for j in range(i - 1, -1, -1):
            prev = rows[j]
            if prev.id in consumed or p not in prev.values:
                continue
            acc += prev.values[p].value
            comps.append(prev.id)
            if len(comps) >= 2 and abs(acc - target) <= max(2, abs(target) * 1e-6):
                ok = all(abs(sum(by_id[c].values[q].value for c in comps if q in by_id[c].values)
                             - r.values[q].value) <= 2 for q in periods)
                if ok:
                    r.verified_sum_of = list(reversed(comps))
                    consumed.update(comps)
                break
            if len(comps) > 25:
                break
        if r.is_subtotal:
            if r.verified_sum_of:
                comp_rows = [by_id[c] for c in r.verified_sum_of]
                if any(c.verified_sum_of for c in comp_rows):
                    r.label = "Grand total (" + " + ".join(c.label for c in comp_rows)[:90] + ")"
                else:
                    names = ", ".join(c.label for c in comp_rows[:3]) + (" …" if len(comp_rows) > 3 else "")
                    r.label = f"Subtotal of {names}"
            else:
                r.label = "Unlabelled total (not verified)"


def scan_auditor_flags(doc) -> list[dict]:
    flags = []
    seen = set()
    for pno, page in enumerate(doc, start=1):
        text = page.get_text().lower()
        if "auditor" not in text and "audit" not in text:
            continue
        for phrase, msg, sev in AUDIT_FLAGS:
            if phrase in text and phrase not in seen:
                if phrase == "qualified opinion" and re.search(r"unqualified opinion|basis for qualified", text) is None and "basis for" not in text:
                    continue
                hits = page.search_for(phrase)
                if not hits:
                    continue
                seen.add(phrase)
                h = hits[0]
                flags.append({"phrase": phrase, "message": msg, "severity": sev, "page": pno,
                              "bbox": [round(h.x0, 1), round(h.y0, 1), round(h.x1, 1), round(h.y1, 1)]})
    return flags


def guess_company(doc, pages: list[int]) -> Optional[str]:
    counts: dict[str, int] = {}
    for p in pages:
        for l in doc[p - 1].get_text().splitlines():
            l = l.strip()
            if 4 < len(l) < 80 and re.search(r"\b(limited|ltd\.?|\(private\)|\(pvt\.?\))\s*$", l, re.I):
                counts[l] = counts.get(l, 0) + 1
    return max(counts, key=counts.get) if counts else None


class UnreadablePDF(Exception):
    """Message is shown to the analyst."""


def open_pdf(path: str):
    try:
        doc = pymupdf.open(path)
    except Exception as e:
        raise UnreadablePDF("This PDF is damaged and can't be opened.") from e
    if doc.needs_pass:
        raise UnreadablePDF("This PDF is password protected. Remove the password and upload it again.")
    if doc.page_count == 0:
        raise UnreadablePDF("This PDF has no pages.")
    return doc


def parse_document(path: str, prefer_consolidated: bool = False) -> dict:
    doc = open_pdf(path)
    candidates: list[StatementPage] = []
    empty_pages = 0
    for i, page in enumerate(doc, start=1):
        if len(page.get_text().strip()) < 30:
            empty_pages += 1
        c = classify_page(page)
        if c and _find_year_columns(_group_rows(page.get_text("words")))[0]:
            code, cons, title = c
            candidates.append(StatementPage(i, code, cons, title, [], detect_unit(page.get_text()),
                                            page.rect.width, page.rect.height))
    # choose standalone vs consolidated basis
    has_standalone = any(not c.consolidated for c in candidates)
    basis_cons = prefer_consolidated if (has_standalone and any(c.consolidated for c in candidates)) else not has_standalone
    chosen: dict[str, list[StatementPage]] = {}
    for c in candidates:
        if c.consolidated == basis_cons:
            chosen.setdefault(c.statement, [])
            if not chosen[c.statement] or c.page - chosen[c.statement][-1].page <= 1:
                chosen[c.statement].append(c)
    rows: list[Row] = []
    pages_meta = []
    for code, plist in chosen.items():
        carry = None
        for sp in plist:
            r, cols = parse_statement_page(doc[sp.page - 1], sp.page, code, code, carry)
            carry = cols or carry
            sp.periods = [f"FY{y}" for y, _ in (cols or [])]
            rows.extend(r)
            pages_meta.append(asdict(sp))
            # continuation page without its own title
            nxt = sp.page + 1
            if nxt <= doc.page_count and not classify_page(doc[nxt - 1]) and code == "BS":
                np_ = doc[nxt - 1]
                if not NOTES_RE.search(np_.get_text()[:400]):
                    r2, cols2 = parse_statement_page(np_, nxt, code, code, carry)
                    if r2 and len(r2) > 3:
                        rows.extend(r2)
                        pages_meta.append(asdict(StatementPage(nxt, code, sp.consolidated, sp.title + " (cont.)",
                                                               sp.periods, sp.unit, np_.rect.width, np_.rect.height)))
    stmt_pages = [p["page"] for p in pages_meta]
    periods = []
    for p in pages_meta:
        for per in p["periods"]:
            if per not in periods:
                periods.append(per)
    periods.sort(reverse=True)
    unit = max((p["unit"] for p in pages_meta), default=1)
    return {
        "page_count": doc.page_count,
        "scanned_pages": empty_pages,
        "basis": "consolidated" if basis_cons else "standalone",
        "statement_pages": pages_meta,
        "periods": periods,
        "unit": unit,
        "company_guess": guess_company(doc, stmt_pages) if stmt_pages else None,
        "rows": [asdict(r) for r in rows],
        "auditor_flags": scan_auditor_flags(doc),
    }
