"""Integration tests: the real API, pipeline and storage together."""
import pymupdf
import pytest
from conftest import SAMPLE, wait

PDF = open(SAMPLE, "rb").read()


def up(client, data, name="a.pdf", **form):
    return client.post("/api/cases", files=[("files", (name, data, "application/pdf"))], data=form)


def many(client, *blobs):
    return client.post("/api/cases", files=[("files", (f"{i}.pdf", b, "application/pdf")) for i, b in enumerate(blobs)])


def test_health_and_meta(client):
    assert client.get("/api/health").json()["llm"]["configured"] is False
    assert "sutlej_demo_textiles" in {s["id"] for s in client.get("/api/meta").json()["samples"]}


def test_upload_runs_the_pipeline(client):
    c = wait(client, up(client, PDF, facility="RF Rs 500 mn", policy="sme_conservative").json()["id"])
    assert (c["status"], c["borrower"]) == ("ready", "Sutlej Demo Textiles (Private) Limited")
    assert c["policy_name"] == "SME Lending Policy (Conservative)"
    assert c["id"] in [x["id"] for x in client.get("/api/cases").json()]
    assert "error_trace" not in c


def test_full_review_flow(client, case):
    cid = case["id"]
    chk = next(x for x in case["checks"] if x["id"].startswith("ARITH:") and x["status"] == "fail")
    c = client.post(f"/api/cases/{cid}/overrides", json={"row_id": chk["rows"][0], "period": "FY2026", "value": 2629000, "reason": "casting error"}).json()
    assert not [x for x in c["checks"] if x["status"] == "fail"]
    assert c["ratios"]["current_ratio"]["values"]["FY2026"] == pytest.approx(3192 / 2629)
    r = client.post(f"/api/cases/{cid}/status", json={"status": "submitted"})
    assert r.status_code == 400 and "Redraft" in r.json()["detail"]
    assert not client.post(f"/api/cases/{cid}/memo/regenerate", json={"use_llm": False}).json()["memo"].get("stale")
    assert client.post(f"/api/cases/{cid}/status", json={"status": "submitted"}).json()["status"] == "submitted"
    assert [a["action"] for a in client.get(f"/api/cases/{cid}").json()["audit"]][-3:] == ["override", "memo_regenerated", "status_submitted"]


def test_blocked_sentence_stops_submission(client, case):
    c = client.post(f"/api/cases/{case['id']}/memo/edit", json={"section": 0, "body": "Revenue will reach Rs 6,200 mn."}).json()
    assert c["memo"]["stats"]["unverified"] == 1
    assert client.post(f"/api/cases/{case['id']}/status", json={"status": "submitted"}).status_code == 400


def test_dispute_must_be_decided(client, case):
    from app.main import store
    c = store.get_case(case["id"])
    c["rows"][1].update(confidence="disputed", ai_code="BS.LT_INVESTMENTS")
    store.save_case(c)
    r = client.post(f"/api/cases/{case['id']}/status", json={"status": "submitted"})
    assert r.status_code == 400 and "confirmation" in r.json()["detail"]
    client.post(f"/api/cases/{case['id']}/confirm", json={"row_id": c["rows"][1]["id"]})
    assert client.post(f"/api/cases/{case['id']}/status", json={"status": "submitted"}).status_code == 200


ROW = "D1:BS3-1"


@pytest.mark.parametrize("body,code", [
    ({"row_id": "nope", "reason": "x"}, 404), ({"row_id": ROW, "reason": " ", "period": "FY2026", "value": 1}, 400),
    ({"row_id": ROW, "reason": "x"}, 400), ({"row_id": ROW, "reason": "x", "set_code": True, "code": "FAKE"}, 400),
    ({"row_id": ROW, "reason": "x", "set_code": True, "code": "IS.REVENUE"}, 400),
    ({"row_id": ROW, "reason": "x", "period": "FY1999", "value": 1}, 400), ({"reason": "x"}, 422),
    ({"row_id": ROW, "reason": "x", "period": "FY2026", "value": 1e300}, 422),
])
def test_bad_overrides_are_rejected_and_change_nothing(client, case, body, code):
    assert client.post(f"/api/cases/{case['id']}/overrides", json=body).status_code == code
    now = client.get(f"/api/cases/{case['id']}").json()
    assert now["overrides"] == {} and now["spread"] == case["spread"]


def test_submitted_case_is_locked(client, case):
    cid = case["id"]
    assert client.post(f"/api/cases/{cid}/status", json={"status": "submitted"}).status_code == 200
    assert client.post(f"/api/cases/{cid}/overrides", json={"row_id": ROW, "period": "FY2026", "value": 1, "reason": "sneaky"}).status_code == 409
    assert client.post(f"/api/cases/{cid}/memo/edit", json={"section": 0, "body": "Edited."}).status_code == 409
    assert client.post(f"/api/cases/{cid}/status", json={"status": "returned"}).status_code == 200
    assert client.post(f"/api/cases/{cid}/memo/edit", json={"section": 0, "body": "Edited."}).status_code == 200


def test_not_a_pdf(client):
    before = len(client.get("/api/cases").json())
    assert up(client, b"hello").status_code == 400
    assert many(client, PDF, b"hello").status_code == 400
    assert client.post("/api/cases").status_code == 422
    assert len(client.get("/api/cases").json()) == before


@pytest.mark.parametrize("data", [b"%PDF-1.7 garbage", b"%PDF-1.4\n%%EOF", PDF[:3000]])
def test_corrupt_pdf_fails_politely(client, data):
    c = wait(client, up(client, data).json()["id"])
    assert c["status"] == "failed"
    assert "Traceback" not in c["error"] and "\\" not in c["error"] and ":/" not in c["error"]


def test_password_protected_pdf_says_so(client):
    locked = pymupdf.open(SAMPLE).tobytes(encryption=pymupdf.PDF_ENCRYPT_AES_256, user_pw="x", owner_pw="y")
    c = wait(client, up(client, locked).json()["id"])
    assert c["status"] == "failed" and "password" in c["error"].lower()


def test_pdf_without_statements(client):
    d = pymupdf.open()
    d.new_page().insert_text((72, 72), "A letter about nothing.")
    c = wait(client, up(client, d.tobytes()).json()["id"])
    assert c["status"] == "failed" and "statement" in c["error"].lower()


def test_one_bad_file_does_not_sink_the_case(client):
    assert wait(client, many(client, b"%PDF-1.7 x", PDF).json()["id"])["status"] == "ready"


def test_too_many_files(client):
    assert many(client, *[PDF] * 5).status_code == 400


def test_page_images(client, case):
    base = f"/api/cases/{case['id']}/documents/{case['documents'][0]['id']}/page"
    assert client.get(f"{base}/3").headers["content-type"] == "image/png"
    assert client.get(f"{base}/99").status_code == 404 and client.get(f"{base}/0").status_code == 404
    for odd in ("0", "-1", "nan", "inf", "1e9"):
        assert client.get(f"{base}/3?scale={odd}").status_code in (200, 422), odd


def test_two_documents_that_disagree_are_flagged(client):
    d = pymupdf.open(SAMPLE)
    page = d[2]
    box = page.search_for("960,000")[0]
    page.add_redact_annot(box)
    page.apply_redactions()
    page.insert_text((box.x1 - pymupdf.get_text_length("991,000", fontsize=9), box.y1 - 2.5), "991,000", fontsize=9)
    c = wait(client, many(client, PDF, d.tobytes()).json()["id"])
    assert any(x["id"] == "RESTATED:BS.TRADE_RECEIVABLES:FY2025" for x in c["checks"])
