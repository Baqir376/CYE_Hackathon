"""API fuzzing: Schemathesis reads our OpenAPI schema and throws odd input at every endpoint. Nothing may cause a 500."""
import schemathesis
from hypothesis import HealthCheck, settings

from app.main import app

schema = schemathesis.openapi.from_asgi("/openapi.json", app)


@schema.parametrize()
@settings(max_examples=40, deadline=None, suppress_health_check=list(HealthCheck))
def test_no_endpoint_crashes(case):
    r = case.call()
    assert r.status_code < 500, (case.method, case.path, r.text[:200])
