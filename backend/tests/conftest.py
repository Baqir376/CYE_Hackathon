"""Every test runs offline: no AI key, no Supabase, a throwaway data folder."""
import os
import sys
import tempfile
import time

for k in ("GROQ_API_KEY", "LLM_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"):
    os.environ[k] = ""  # load_dotenv does not override variables that already exist
os.environ["DATA_DIR"] = tempfile.mkdtemp(prefix="crediq-test-")
BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND)

import pytest  # noqa: E402

SAMPLE = os.path.join(BACKEND, "samples", "sutlej_demo_textiles.pdf")
REAL = os.path.join(BACKEND, "..", "samples", "raw", "pol_2026.pdf")


def analyse_sample(path=SAMPLE):
    from app import pipeline
    from app.mapper import map_rows
    from app.parser import parse_document
    d = parse_document(path)
    rows = pipeline._prefix_rows(d["rows"], 1, "d1", d["unit"])
    mapped, _ = map_rows(rows, use_llm=False)
    return pipeline.analyze({"rows": mapped, "overrides": {}, "policy": "default",
                             "documents": [{"id": "d1", "periods": d["periods"], "unit": d["unit"], "auditor_flags": d["auditor_flags"]}]})


def wait(client, cid, limit=40):
    end = time.time() + limit
    while time.time() < end:
        c = client.get(f"/api/cases/{cid}").json()
        if c["status"] not in ("queued", "processing"):
            return c
        time.sleep(0.05)
    raise AssertionError("analysis did not finish")


@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient

    from app.main import app
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def case(client):
    r = client.post("/api/cases/sample/sutlej_demo_textiles")
    assert r.status_code == 200
    return wait(client, r.json()["id"])


@pytest.fixture(scope="session")
def analysed():
    return analyse_sample()
