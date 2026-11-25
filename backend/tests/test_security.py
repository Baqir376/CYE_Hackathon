"""Security tests: what someone would try first on a public demo. Read-only: nothing here can delete files."""
import time

import pytest
from conftest import SAMPLE, wait

PDF = open(SAMPLE, "rb").read()


@pytest.mark.parametrize("cid", ["..", "%2e%2e", "..%2f..", "..%5c..", "a%00b", "x" * 300, "case.json", "ABCDEF12"])
def test_case_id_cannot_escape(client, cid):
    assert client.get(f"/api/cases/{cid}").status_code in (404, 405, 422)


def test_ids_are_checked_before_touching_a_path():
    from app.store import safe_id
    assert safe_id("0123abcdef") == "0123abcdef"
    for bad in ("..", "../..", "..\\..", "a/b", "", "0123abcde\n", "c:", None):
        with pytest.raises(ValueError):
            safe_id(bad)


def test_there_is_no_delete(client, case):
    assert client.request("DELETE", f"/api/cases/{case['id']}").status_code == 405


@pytest.mark.parametrize("sid", ["..%2f..%2f.env", "%2e%2e", "nope"])
def test_sample_traversal(client, sid):
    assert client.post(f"/api/cases/sample/{sid}").status_code in (404, 405)


@pytest.mark.parametrize("did", ["..", "%2e%2e%2fcase", "zzzz"])
def test_document_traversal(client, case, did):
    assert client.get(f"/api/cases/{case['id']}/documents/{did}/page/1").status_code in (404, 405, 422)


def test_keys_never_leave_the_server(client, case, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "gsk_SECRETSECRET")
    assert "SECRET" not in client.get("/api/health").text + client.get("/api/meta").text + client.get(f"/api/cases/{case['id']}").text


def test_html_is_returned_as_json_not_a_page(client):
    r = client.post("/api/cases", files=[("files", ("<img src=x onerror=1>.pdf", PDF, "application/pdf"))], data={"borrower": "<script>alert(1)</script>"})
    assert r.status_code == 200 and r.headers["content-type"].startswith("application/json")


def test_status_cannot_be_forged(client, case):
    for s in ("approved", "ready", "", "processing"):
        assert client.post(f"/api/cases/{case['id']}/status", json={"status": s}).status_code == 400


def test_failed_case_cannot_be_submitted(client):
    cid = client.post("/api/cases", files=[("files", ("x.pdf", b"%PDF-1.7 x", "application/pdf"))]).json()["id"]
    wait(client, cid)
    assert client.post(f"/api/cases/{cid}/status", json={"status": "submitted"}).status_code == 400


def test_long_inputs_are_limited(client, case):
    cid = case["id"]
    assert client.post(f"/api/cases/{cid}/memo/edit", json={"section": 0, "body": "a" * 200_000}).status_code == 422
    assert client.post(f"/api/cases/{cid}/overrides", json={"row_id": "D1:BS3-1", "period": "FY2026", "value": 1, "reason": "r" * 50_000}).status_code == 422
    assert client.post("/api/cases", files=[("files", ("x.pdf", PDF, "application/pdf"))], data={"borrower": "b" * 10_000}).status_code == 422


def test_guard_cannot_be_hung(analysed):
    from app.guard import guard
    from app.memo import build_facts
    f = build_facts(analysed["spread"], analysed["ratios"], analysed["periods"], analysed["signals"])
    t = time.time()
    for nasty in ("[F:" + "A" * 8000, "{{" * 4000, "1," * 4000, " " * 8000 + "x", "FY2026 " * 1100, ". A" * 2600, "revenue " * 1000):
        guard(nasty, f)
    assert time.time() - t < 4


def test_security_headers(client):
    h = client.get("/api/health").headers
    assert h["x-content-type-options"] == "nosniff" and h["x-frame-options"] == "DENY"
