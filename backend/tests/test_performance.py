"""Performance and concurrency. Limits are generous so slow CI machines still pass."""
import concurrent.futures as cf
import os
import time

import pytest
from conftest import REAL, SAMPLE, wait

from app.parser import parse_document


def timed(path):
    t = time.perf_counter()
    parse_document(path)
    return time.perf_counter() - t


def test_sample_parses_fast():
    assert timed(SAMPLE) < 1


@pytest.mark.skipif(not os.path.exists(REAL), reason="the real report is not in the repository")
def test_227_pages_under_six_seconds():
    assert timed(REAL) < 6


def test_ten_cases_at_once_stay_separate(client):
    with cf.ThreadPoolExecutor(10) as ex:
        ids = list(ex.map(lambda i: client.post("/api/cases/sample/sutlej_demo_textiles").json()["id"], range(10)))
        done = list(ex.map(lambda i: wait(client, i, 60), ids))
    assert len(set(ids)) == 10 and all(c["status"] == "ready" for c in done)


def test_polling_while_saving_never_breaks(client):
    """Regression: on Windows a reader could make the save fail and kill the analysis."""
    cid = client.post("/api/cases/sample/sutlej_demo_textiles").json()["id"]
    with cf.ThreadPoolExecutor(8) as ex:
        codes = list(ex.map(lambda _: client.get(f"/api/cases/{cid}").status_code, range(200)))
    assert set(codes) == {200} and wait(client, cid)["status"] == "ready"


def test_simultaneous_edits_are_not_lost(client, case):
    ids = [r["id"] for r in case["rows"][:12]]
    with cf.ThreadPoolExecutor(12) as ex:
        list(ex.map(lambda i: client.post(f"/api/cases/{case['id']}/confirm", json={"row_id": i}), ids))
    assert set(client.get(f"/api/cases/{case['id']}").json()["confirmed"]) == set(ids)
