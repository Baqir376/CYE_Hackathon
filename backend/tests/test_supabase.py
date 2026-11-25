"""Storage contract tests: Supabase replaced by an in-memory fake that behaves like its REST API."""
import json
import os

import httpx
import pytest
from conftest import SAMPLE

from app import store as S


class Reply:
    def __init__(self, code=200, body=None, content=b""):
        self.status_code, self._b, self.content = code, body, content

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError(str(self.status_code), request=None, response=None)

    def json(self):
        return json.loads(json.dumps(self._b))


@pytest.fixture
def fake(monkeypatch, tmp_path):
    monkeypatch.setattr(S, "DATA_DIR", str(tmp_path))
    db, files, seen = {}, {}, []

    def post(url, json=None, content=None, headers=None, timeout=None):
        seen.append((url, headers))
        if "/rest/v1/cases" in url:
            db[json["id"]] = json
        else:
            files[url.split("/object/")[1]] = content
        return Reply(201)

    def get(url, params=None, headers=None, timeout=None):
        seen.append((url, headers))
        if "/storage/" in url:
            k = url.split("/object/")[1]
            return Reply(200, content=files[k]) if k in files else Reply(404)
        if "id" in params:
            row = db.get(params["id"][3:])
            return Reply(200, [{"data": row["data"]}] if row else [])
        return Reply(200, [{"id": r["id"], "borrower": r["borrower"], "status": r["status"], "created_at": r["created_at"]} for r in db.values()])
    monkeypatch.setattr(S.httpx, "post", post)
    monkeypatch.setattr(S.httpx, "get", get)
    return S.SupabaseStore("https://x.supabase.co/", "service-key"), db, files, seen


CASE = {"id": "0123abcdef", "borrower": "B", "status": "queued", "created_at": "2026-11-25T00:00:00", "documents": []}


def test_case_round_trip(fake):
    st, *_ = fake
    st.save_case(dict(CASE))
    assert st.get_case("0123abcdef")["borrower"] == "B"
    assert st.get_case("ffffffffff") is None
    assert [c["id"] for c in st.list_cases()] == ["0123abcdef"]


def test_pdf_survives_a_server_restart(fake):
    st, _, files, _ = fake
    pdf = open(SAMPLE, "rb").read()
    st.put_document("0123abcdef", "0a0b0c0d", pdf)
    os.rename(os.path.join(S.DATA_DIR, "cases"), os.path.join(S.DATA_DIR, "gone"))  # Render wipes its disk on restart
    assert open(st.document_path("0123abcdef", "0a0b0c0d"), "rb").read() == pdf


def test_bad_ids_never_reach_supabase(fake):
    st, _, _, seen = fake
    for bad in ("..", "1,or=(id.neq.0)", "x&select=*"):
        with pytest.raises(ValueError):
            st.get_case(bad)
        with pytest.raises(ValueError):
            st.document_path("0123abcdef", bad)
    assert seen == []


def test_supabase_errors_are_not_swallowed(fake, monkeypatch):
    st, *_ = fake
    monkeypatch.setattr(S.httpx, "post", lambda *a, **k: Reply(500))
    with pytest.raises(httpx.HTTPStatusError):
        st.save_case(dict(CASE))


def test_store_choice_follows_the_environment(monkeypatch):
    assert S.make_store().kind == "local"
    monkeypatch.setenv("SUPABASE_URL", "https://x.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "k")
    assert S.make_store().kind == "supabase"


def test_new_secret_keys_are_not_sent_as_bearer_tokens():
    new, old = S.SupabaseStore("https://x.supabase.co", "sb_secret_abc"), S.SupabaseStore("https://x.supabase.co", "legacy.jwt.key")
    assert new.h == {"apikey": "sb_secret_abc"}
    assert old.h == {"apikey": "legacy.jwt.key", "Authorization": "Bearer legacy.jwt.key"}
