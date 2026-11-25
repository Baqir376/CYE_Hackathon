"""Mutation testing: break the code on purpose, in a temporary copy, and check the tests notice.

Run: python scripts/mutate.py     (the real source is never modified)
"""
import os
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MUTANTS = [
    ("guard.py", "if not _same_metric(names[-1][1], f[\"code\"]):", "if False:"),
    ("guard.py", "if (up and nv < ov) or (down and nv > ov):", "if False:"),
    ("guard.py", "if len(yrs) == 1 and f[\"period\"] not in yrs:", "if False:"),
    ("guard.py", "problems += [f\"figure {n} has no source\"", "problems += [] and [f\"figure {n} has no source\""),
    ("guard.py", "if hit and before and", "if False and before and"),
    ("analysis.py", "if comps and abs(exp - cell[\"value\"]) > 1:", "if comps and abs(exp - cell[\"value\"]) > 1e9:"),
    ("analysis.py", "v = _div(g(\"BS.TOTAL_CA\"), g(\"BS.TOTAL_CL\"))", "v = _div(g(\"BS.TOTAL_CL\"), g(\"BS.TOTAL_CA\"))"),
    ("analysis.py", "status = \"breach\"\n            elif \"max\"", "status = \"pass\"\n            elif \"max\""),
    ("analysis.py", "if recv_g - rg > 0.10:", "if recv_g - rg < 0.10:"),
    ("parser.py", "return -v if neg else v", "return v"),
    ("parser.py", "if abs(best[1] - x1) <= 45", "if abs(best[1] - x1) <= 5"),
    ("mapper.py", "code, conf, src = rc, \"disputed\", \"rules\"", "code, conf, src = ac, \"disputed\", \"ai\""),
    ("mapper.py", "ac in held or", "False or"),
    ("main.py", "if m.get(\"stale\"):", "if False:"),
    ("main.py", "if m[\"stats\"][\"unverified\"]:", "if False:"),
    ("main.py", "if c[\"status\"] == \"submitted\" and not allow_submitted:", "if False:"),
    ("main.py", "    with _locks[cid]:", "    if True:"),
    ("store.py", "or not ID_RE.fullmatch(x)", "or False"),
    ("llm.py", "if wait > MAX_WAIT or attempt == retries:", "if attempt == retries:"),
]
FILES = ["tests/test_guard.py", "tests/test_unit.py", "tests/test_golden.py", "tests/test_api.py", "tests/test_ai.py", "tests/test_security.py", "tests/test_performance.py"]


def main():
    tmp = tempfile.mkdtemp(prefix="crediq-mutants-")
    for d in ("app", "tests", "samples", "policies"):
        shutil.copytree(os.path.join(ROOT, d), os.path.join(tmp, d), ignore=shutil.ignore_patterns("__pycache__"))
    shutil.copy(os.path.join(ROOT, "pytest.ini"), tmp)
    run = lambda: subprocess.run([sys.executable, "-B", "-W", "ignore", "-m", "pytest", "-q", "-x", "-p", "no:cacheprovider", *FILES],  # noqa: E731
                                 cwd=tmp, capture_output=True, text=True, timeout=300).returncode
    if run() != 0:
        sys.exit("the tests must pass before mutating")
    survived = []
    for f, a, b in MUTANTS:
        p = os.path.join(tmp, "app", f)
        src = open(p, encoding="utf-8").read()
        assert src.count(a) >= 1, (f, a)
        open(p, "w", encoding="utf-8").write(src.replace(a, b, 1))
        killed = run() != 0
        open(p, "w", encoding="utf-8").write(src)
        print("caught  " if killed else "SURVIVED", f, "|", a[:70].replace("\n", " "), flush=True)
        if not killed:
            survived.append(a)
    print(f"{len(MUTANTS) - len(survived)}/{len(MUTANTS)} caught")


if __name__ == "__main__":
    main()
