"""Property tests: Hypothesis invents thousands of inputs and hunts for one that breaks a rule."""
import functools

from conftest import analyse_sample
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from app.guard import check_sentence, guard
from app.memo import build_facts
from app.parser import parse_number

SET = settings(max_examples=400, deadline=None, suppress_health_check=list(HealthCheck))
NAMES = {"IS.REVENUE": "Net revenue", "IS.NET_PROFIT": "Net profit", "BS.TOTAL_ASSETS": "Total assets"}


@functools.lru_cache
def facts():
    c = analyse_sample()
    return build_facts(c["spread"], c["ratios"], c["periods"], c["signals"])


NUMERIC = sorted(k for k in facts() if k[0] in "FR")


@SET
@given(st.integers(-10**12, 10**12))
def test_printed_numbers_round_trip(n):
    assert parse_number(f"({abs(n):,})" if n < 0 else f"{n:,}") == n


@SET
@given(st.text(max_size=300))
def test_guard_survives_any_text(t):
    assert all(s["status"] in ("verified", "unverified", "narrative") for s in guard(t, facts())["sentences"])


@SET
@given(st.integers(0, 10**9), st.sampled_from(sorted(NAMES)))
def test_wrong_figure_is_never_verified(n, code):
    fig = f"Rs {n:,} mn"
    if fig != facts()[f"F:{code}:FY2026"]["display"]:
        assert check_sentence(f"{NAMES[code]} was {fig} [F:{code}:FY2026].", facts())["status"] == "unverified"


@SET
@given(st.sampled_from(NUMERIC), st.sampled_from(NUMERIC))
def test_swapping_any_two_facts_is_caught(a, b):
    if facts()[a]["display"] != facts()[b]["display"]:
        assert check_sentence(f"The figure was {facts()[a]['display']} [{b}].", facts())["status"] == "unverified"


@SET
@given(st.text(alphabet=st.characters(categories=["Nd", "No", "Nl"]), min_size=1, max_size=8))
def test_numerals_in_any_script_are_blocked(d):
    assert check_sentence(f"We expect {d} next year.", facts())["status"] == "unverified"


@SET
@given(st.sampled_from(NUMERIC), st.text(alphabet="0123456789,.-", min_size=1, max_size=4))
def test_characters_added_to_a_figure_are_caught(k, extra):
    f = facts()[k]
    s = check_sentence(f"Value {extra}{f['display']} [{k}].", facts())
    if any(ch.isdigit() for ch in extra):
        assert s["status"] == "unverified"
