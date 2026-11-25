"""Read-only check of the Supabase settings in backend/.env. Never prints the key."""
import os
import sys

import httpx
from dotenv import load_dotenv

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
from app.store import BUCKET, SupabaseStore, make_store  # noqa: E402


def main() -> int:
    s = make_store()
    if not isinstance(s, SupabaseStore):
        print("Not set up: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be filled in backend/.env")
        return 1
    ok = True
    for name, path in (("cases table", "/rest/v1/cases?select=id&limit=1"), ("documents bucket", f"/storage/v1/bucket/{BUCKET}")):
        try:
            r = httpx.get(s.url + path, headers=s.h, timeout=20)
            good = r.status_code == 200
            print(f"{'OK  ' if good else 'FAIL'} {name}" + ("" if good else f": HTTP {r.status_code} {r.text[:160]}"))
        except httpx.HTTPError as e:
            good = False
            print(f"FAIL {name}: {type(e).__name__}. Check SUPABASE_URL.")
        ok = ok and good
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
