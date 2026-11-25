"""Persistence: Supabase (Postgres + Storage) in production, local disk for development.

Supabase is used through its REST APIs with the service-role key, which stays on the server only.
"""
from __future__ import annotations

import json
import os
import re
import threading
import time
from datetime import datetime, timezone

import httpx

DATA_DIR = os.getenv("DATA_DIR", os.path.join(os.path.dirname(os.path.dirname(__file__)), "data"))
BUCKET = os.getenv("SUPABASE_BUCKET", "documents")


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


ID_RE = re.compile(r"[0-9a-f]{8,12}")


def safe_id(x: str) -> str:
    """Ids are our own hex strings; anything else (.., slashes, null bytes) never reaches the file system."""
    if not isinstance(x, str) or not ID_RE.fullmatch(x):
        raise ValueError("invalid id")
    return x


class LocalStore:
    kind = "local"

    def __init__(self):
        os.makedirs(os.path.join(DATA_DIR, "cases"), exist_ok=True)
        self._lock = threading.RLock()

    def _dir(self, cid):
        d = os.path.join(DATA_DIR, "cases", safe_id(cid))
        os.makedirs(d, exist_ok=True)
        return d

    def save_case(self, case: dict):
        case["updated_at"] = now()
        with self._lock:
            p = os.path.join(self._dir(case["id"]), "case.json")
            with open(p + ".tmp", "w", encoding="utf-8") as f:
                json.dump(case, f)
            for attempt in range(20):
                try:
                    os.replace(p + ".tmp", p)
                    break
                except PermissionError:  # antivirus or an indexer may hold the file for a moment
                    if attempt == 19:
                        raise
                    time.sleep(0.05)

    def get_case(self, cid: str) -> dict | None:
        p = os.path.join(DATA_DIR, "cases", safe_id(cid), "case.json")
        with self._lock:  # on Windows even an exists() check can make os.replace fail
            try:
                with open(p, encoding="utf-8") as f:
                    return json.load(f)
            except FileNotFoundError:
                return None

    def list_cases(self) -> list[dict]:
        out = []
        base = os.path.join(DATA_DIR, "cases")
        for cid in os.listdir(base):
            c = self.get_case(cid) if ID_RE.fullmatch(cid) else None
            if c:
                out.append(summary(c))
        return sorted(out, key=lambda x: x["created_at"], reverse=True)

    def put_document(self, cid: str, doc_id: str, data: bytes):
        with open(os.path.join(self._dir(cid), f"{safe_id(doc_id)}.pdf"), "wb") as f:
            f.write(data)

    def document_path(self, cid: str, doc_id: str) -> str:
        return os.path.join(self._dir(cid), f"{safe_id(doc_id)}.pdf")


class SupabaseStore(LocalStore):
    """Case JSON in table `cases`; PDFs in Storage bucket. Local disk is only a cache."""
    kind = "supabase"

    def __init__(self, url: str, key: str):
        super().__init__()
        self.url = url.rstrip("/")
        self.h = {"apikey": key}
        if not key.startswith("sb_"):  # only the legacy service_role key is a JWT; new secret keys go on apikey alone
            self.h["Authorization"] = f"Bearer {key}"

    def save_case(self, case: dict):
        case["updated_at"] = now()
        row = {"id": case["id"], "borrower": case.get("borrower"), "status": case.get("status"),
               "created_at": case.get("created_at"), "updated_at": case["updated_at"], "data": case}
        r = httpx.post(f"{self.url}/rest/v1/cases", json=row, timeout=30,
                       headers={**self.h, "Prefer": "resolution=merge-duplicates,return=minimal"})
        r.raise_for_status()

    def get_case(self, cid: str):
        r = httpx.get(f"{self.url}/rest/v1/cases", params={"id": f"eq.{safe_id(cid)}", "select": "data"}, headers=self.h, timeout=30)
        r.raise_for_status()
        rows = r.json()
        return rows[0]["data"] if rows else None

    def list_cases(self):
        r = httpx.get(f"{self.url}/rest/v1/cases", headers=self.h, timeout=30,
                      params={"select": "id,borrower,status,created_at,updated_at,"
                                        "facility:data->>facility,periods:data->periods,signal_count:data->signal_count,"
                                        "exception_count:data->exception_count,documents:data->documents",
                              "order": "created_at.desc", "limit": "100"})
        r.raise_for_status()
        return r.json()

    def put_document(self, cid, doc_id, data):
        super().put_document(cid, doc_id, data)
        r = httpx.post(f"{self.url}/storage/v1/object/{BUCKET}/{cid}/{doc_id}.pdf", content=data, timeout=120,
                       headers={**self.h, "Content-Type": "application/pdf", "x-upsert": "true"})
        r.raise_for_status()

    def document_path(self, cid, doc_id):
        p = super().document_path(cid, doc_id)
        if not os.path.exists(p):
            r = httpx.get(f"{self.url}/storage/v1/object/{BUCKET}/{cid}/{doc_id}.pdf", headers=self.h, timeout=120)
            r.raise_for_status()
            with open(p, "wb") as f:
                f.write(r.content)
        return p


def summary(c: dict) -> dict:
    return {k: c.get(k) for k in ("id", "borrower", "status", "created_at", "updated_at", "facility", "periods",
                                  "signal_count", "exception_count", "documents")}


def make_store():
    url, key = (os.getenv("SUPABASE_URL") or "").strip(), (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if url and key:
        return SupabaseStore(url, key)
    return LocalStore()
