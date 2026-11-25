from __future__ import annotations

import math
import os
import threading
import uuid
from collections import defaultdict
from contextlib import contextmanager

from dotenv import load_dotenv

load_dotenv()

import pymupdf  # noqa: E402
from fastapi import FastAPI, File, Form, HTTPException, UploadFile  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import Response  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

from . import analysis  # noqa: E402
from .guard import guard, stats  # noqa: E402
from .parser import UnreadablePDF, open_pdf  # noqa: E402
from .memo import build_facts, write_memo  # noqa: E402
from .pipeline import analyze, audit, llm_status, run_pipeline  # noqa: E402
from .store import make_store, now  # noqa: E402
from .taxonomy import TAXONOMY  # noqa: E402

SAMPLES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "samples")
MAX_MB = int(os.getenv("MAX_UPLOAD_MB", "40"))

app = FastAPI(title="Credence AI API", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",")],
    allow_methods=["*"], allow_headers=["*"],
)
store = make_store()
MAX_FILES = 4


@app.middleware("http")
async def headers(request, call_next):
    r = await call_next(request)
    r.headers["X-Content-Type-Options"] = "nosniff"
    r.headers["X-Frame-Options"] = "DENY"
    r.headers["Referrer-Policy"] = "no-referrer"
    return r


_locks: dict[str, threading.RLock] = defaultdict(threading.RLock)


@contextmanager
def _edit(cid: str, allow_submitted=False):
    """Read, change and save one case at a time, so two people's edits can't overwrite each other."""
    with _locks[cid]:
        c = _get(cid)
        if c["status"] in ("queued", "processing"):
            raise HTTPException(409, "This case is still being analysed.")
        if c["status"] == "failed":
            raise HTTPException(400, "This analysis failed, so there is nothing to change or submit.")
        if c["status"] == "submitted" and not allow_submitted:
            raise HTTPException(409, "This case has been submitted. Return it to the analyst before changing it.")
        yield c
        store.save_case(c)


def _recover_interrupted():
    """A restart kills the analysis thread; mark those cases so the screen doesn't wait for ever."""
    try:
        for s in store.list_cases():
            if s.get("status") in ("processing", "queued"):
                c = store.get_case(s["id"])
                c.update(status="failed", error="The server restarted during this analysis. Please start the case again.")
                store.save_case(c)
    except Exception as e:  # never block startup on this
        print("recover skipped:", type(e).__name__)


_recover_interrupted()


def _get(cid):
    try:
        c = store.get_case(cid)
    except ValueError:
        c = None
    if not c:
        raise HTTPException(404, "Case not found")
    return c


def _start(case, use_llm=True):
    threading.Thread(target=run_pipeline, args=(case, store, use_llm), daemon=True).start()


@app.get("/api/health")
def health():
    return {"ok": True, "llm": llm_status(), "store": store.kind}


@app.get("/api/meta")
def meta():
    return {"policies": analysis.list_policies(),
            "taxonomy": [{"code": c, "statement": v[0], "name": v[1]} for c, v in TAXONOMY.items()],
            "samples": _samples()}


def _samples():
    out = []
    if os.path.isdir(SAMPLES_DIR):
        for fn in sorted(os.listdir(SAMPLES_DIR)):
            if fn.endswith(".pdf"):
                out.append({"id": fn[:-4], "filename": fn})
    return out


@app.get("/api/cases")
def list_cases():
    return store.list_cases()


def _new_case(borrower, facility, policy, analyst):
    if policy not in [p["id"] for p in analysis.list_policies()]:
        policy = "default"
    return {"id": uuid.uuid4().hex[:10], "borrower": (borrower or "").strip() or "auto", "facility": facility,
            "policy": policy, "analyst": analyst or "Credit Analyst", "created_at": now(), "status": "queued",
            "documents": [], "audit": [], "overrides": {}, "trace": []}


@app.post("/api/cases")
async def create_case(files: list[UploadFile] = File(...), borrower: str = Form("", max_length=200), facility: str = Form("", max_length=200),
                      policy: str = Form("default", max_length=60), analyst: str = Form("", max_length=120)):
    if not files:
        raise HTTPException(400, "Upload at least one PDF")
    if len(files) > MAX_FILES:
        raise HTTPException(400, f"Upload at most {MAX_FILES} documents per case")
    case = _new_case(borrower, facility, policy, analyst)
    blobs = []
    for f in files:
        data = await f.read(MAX_MB * 1024 * 1024 + 1)
        if len(data) > MAX_MB * 1024 * 1024:
            raise HTTPException(413, f"{f.filename} is larger than {MAX_MB} MB")
        if not data.startswith(b"%PDF"):
            raise HTTPException(400, f"{f.filename} is not a PDF")
        blobs.append((f.filename, data))
    for filename, data in blobs:  # only store once every file has passed
        did = uuid.uuid4().hex[:8]
        store.put_document(case["id"], did, data)
        case["documents"].append({"id": did, "filename": (filename or "document.pdf")[:200], "size": len(data)})
    audit(case, case["analyst"], "case_created", f"{len(case['documents'])} document(s) uploaded")
    store.save_case(case)
    _start(case)
    return case


@app.post("/api/cases/sample/{sample_id}")
def create_sample(sample_id: str, policy: str = "default"):
    if sample_id not in [x["id"] for x in _samples()]:
        raise HTTPException(404, "Sample not found")
    fn = os.path.join(SAMPLES_DIR, f"{sample_id}.pdf")
    case = _new_case("auto", "Running finance facility (demo)", policy, "Demo Analyst")
    did = uuid.uuid4().hex[:8]
    with open(fn, "rb") as f:
        store.put_document(case["id"], did, f.read())
    case["documents"].append({"id": did, "filename": os.path.basename(fn), "size": os.path.getsize(fn)})
    audit(case, case["analyst"], "case_created", "Sample case")
    store.save_case(case)
    _start(case)
    return case


@app.get("/api/cases/{cid}")
def get_case(cid: str):
    c = _get(cid)
    c.pop("error_trace", None)
    return c


_page_cache: dict[tuple, bytes] = {}


@app.get("/api/cases/{cid}/documents/{did}/page/{n}")
def page_image(cid: str, did: str, n: int, scale: float = 1.6):
    scale = round(min(3.0, max(0.2, scale)), 1) if math.isfinite(scale) else 1.6
    key = (cid, did, n, scale)
    if key not in _page_cache:
        c = _get(cid)
        if did not in [d["id"] for d in c["documents"]]:
            raise HTTPException(404, "Document not found")
        try:
            doc = open_pdf(store.document_path(cid, did))
        except UnreadablePDF as e:
            raise HTTPException(422, str(e)) from e
        if not 1 <= n <= doc.page_count:
            raise HTTPException(404, "Page out of range")
        pix = doc[n - 1].get_pixmap(matrix=pymupdf.Matrix(scale, scale))
        if len(_page_cache) > 200:
            _page_cache.clear()
        _page_cache[key] = pix.tobytes("png")
    return Response(_page_cache[key], media_type="image/png", headers={"Cache-Control": "public, max-age=86400"})


Actor = Field("Credit Analyst", max_length=120)


class Override(BaseModel):
    row_id: str = Field(max_length=80)
    code: str | None = Field(None, max_length=40)
    set_code: bool = False
    period: str | None = Field(None, max_length=10)
    value: float | None = Field(None, allow_inf_nan=False, ge=-1e15, le=1e15)
    reason: str = Field(max_length=500)
    actor: str = Actor


def _row(c, rid):
    row = next((r for r in c["rows"] if r["id"] == rid), None)
    if not row:
        raise HTTPException(404, "Row not found")
    return row


@app.post("/api/cases/{cid}/overrides")
def add_override(cid: str, o: Override):
    with _edit(cid) as c:
        row = _row(c, o.row_id)
        if not o.reason.strip():
            raise HTTPException(400, "A reason is required for every change")
        change, parts = {}, []
        if o.set_code:
            if o.code is not None and (o.code not in TAXONOMY or TAXONOMY[o.code][0] != row["statement"]):
                raise HTTPException(400, "That template item doesn't belong to this statement")
            change["code"] = o.code
            name = lambda k: TAXONOMY[k][1] if k in TAXONOMY else "not used"  # noqa: E731
            parts.append(f"classification → {name(o.code)} (was {name(row.get('code'))})")
        if o.period and o.value is not None:
            if o.period not in row["values"]:
                raise HTTPException(400, "Period not in row")
            parts.append(f"{o.period} value → {o.value:,.0f} (printed {row['values'][o.period]['raw']})")
        if not parts:
            raise HTTPException(400, "Nothing to change")
        ov = c.setdefault("overrides", {}).setdefault(o.row_id, {})
        ov.update(change, reason=o.reason, actor=o.actor, ts=now())
        if o.period and o.value is not None:
            ov.setdefault("values", {})[o.period] = o.value
        audit(c, o.actor, "override", f"{row['label'][:60]}: " + "; ".join(parts) + f" — reason: {o.reason}")
        analyze(c)
        if c.get("memo"):
            c["memo"]["stale"] = True
    return c


class Confirm(BaseModel):
    row_id: str = Field(max_length=80)
    actor: str = Actor


@app.post("/api/cases/{cid}/confirm")
def confirm_row(cid: str, b: Confirm):
    with _edit(cid) as c:
        row = _row(c, b.row_id)
        c.setdefault("confirmed", {})[b.row_id] = {"actor": b.actor, "ts": now()}
        audit(c, b.actor, "confirmed", f"{row['label'][:60]} → {TAXONOMY[row['code']][1] if row.get('code') else 'not used'}")
        analyze(c)
    return c


class Regenerate(BaseModel):
    use_llm: bool = True
    actor: str = Actor


@app.post("/api/cases/{cid}/memo/regenerate")
def regenerate_memo(cid: str, b: Regenerate | None = None):
    b = b or Regenerate()
    with _edit(cid) as c:
        c["memo"] = write_memo(c, c["spread"], c["ratios"], c["signals"], c["checks"], c["periods"], b.use_llm)
        audit(c, b.actor, "memo_regenerated", c["memo"]["engine"])
    return c


class MemoEdit(BaseModel):
    section: int = Field(ge=0, le=50)
    body: str = Field(max_length=8000)
    actor: str = Actor


@app.post("/api/cases/{cid}/memo/edit")
def edit_memo(cid: str, e: MemoEdit):
    with _edit(cid) as c:
        m = c.get("memo")
        if not m or e.section >= len(m["sections"]):
            raise HTTPException(400, "Invalid section")
        m["facts"] = build_facts(c["spread"], c["ratios"], c["periods"], c["signals"])  # always the current figures
        m["sections"][e.section].update(guard(e.body, m["facts"]))
        m["sections"][e.section]["edited_by"] = e.actor
        m["stats"] = stats(m["sections"])
        audit(c, e.actor, "memo_edited", m["sections"][e.section]["title"])
    return c


class StatusChange(BaseModel):
    status: str = Field(max_length=20)
    actor: str = Actor
    note: str = Field("", max_length=1000)


FLOW = {"in_review": ("ready", "returned", "in_review"), "submitted": ("ready", "in_review", "returned"), "returned": ("submitted",)}


@app.post("/api/cases/{cid}/status")
def change_status(cid: str, s: StatusChange):
    if s.status not in FLOW:
        raise HTTPException(400, "Invalid status")
    with _edit(cid, allow_submitted=True) as c:
        if c["status"] not in FLOW[s.status]:
            raise HTTPException(409, f"A case that is '{c['status']}' can't become '{s.status}'.")
        if s.status == "submitted":
            m = c.get("memo") or {}
            if not m.get("sections"):
                raise HTTPException(400, "There is no memo to submit.")
            if m.get("stale"):
                raise HTTPException(400, "Figures changed after the memo was drafted. Redraft the memo first.")
            if m["stats"]["unverified"]:
                raise HTTPException(400, f"{m['stats']['unverified']} memo sentence(s) contain unverified figures. Fix or remove them first.")
            # from the rows themselves, so a check that was never re-run can't hide an open dispute
            n = sum(r.get("confidence") == "disputed" and r["id"] not in c.get("confirmed", {}) and r["id"] not in c.get("overrides", {}) for r in c["rows"])
            if n:
                raise HTTPException(400, f"{n} disputed classification(s) still need analyst confirmation.")
        c["status"] = s.status
        audit(c, s.actor, f"status_{s.status}", s.note)
    return c
