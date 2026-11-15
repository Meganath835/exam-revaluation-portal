"""Role-based access to the Process View, checked against the API directly (not just the UI).
Needs at least one request in the database (run t1_happy.py first)."""
from api import *

checks = []
def check(name, ok, detail=""):
    checks.append((name, ok)); print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if not ok else ""))

clerk_overview = api("GET", "/api/process-view", "examcell.clerk")
check("exam cell opens the Process View", clerk_overview[0] == 200, clerk_overview)
rows = clerk_overview[1]["instances"] if clerk_overview[0] == 200 else []
own = next(r for r in rows if r["studentId"] == "21CS042")
other = next((r for r in rows if r["studentId"] != "21CS042"), None)
rid = own["requestId"]

s, xml = api("GET", "/api/process-view/definition", "examcell.clerk")
check("exam cell gets the deployed BPMN", s == 200 and "Examination and Revaluation" in xml and "refund" not in xml.lower())
check("exam cell gets one request's process detail", api("GET", f"/api/process-view/requests/{rid}", "examcell.clerk")[0] == 200)
check("exam cell gets the instance diagram", api("GET", f"/api/requests/{rid}/diagram", "examcell.clerk")[0] == 200)
check("exam cell status includes BPMN elements", len(status(rid, "examcell.clerk")["elements"]) > 0)

for user in ["21CS042", "examiner.cs01", "coe", "hod.cse"]:
    for path in ["/api/process-view", "/api/process-view/definition", f"/api/process-view/requests/{rid}", f"/api/requests/{rid}/diagram"]:
        s, b = api("GET", path, user)
        check(f"{user} is refused {path}", s == 403, (s, b))
for path in ["/api/process-view", "/api/process-view/definition"]:
    check(f"anonymous is refused {path}", api("GET", path)[0] == 401)

st = status(rid, "21CS042")
check("student status has no BPMN element states", st["elements"] == [])
check("student still sees stages, subjects and activity", len(st["stages"]) == 8 and st["subjects"] and st["events"])
check("student still sees own requests", any(r["id"] == rid for r in api("GET", "/api/requests", "21CS042")[1]))
if other:
    check("student can't open another student's request", api("GET", f"/api/requests/{other['requestId']}/status", "21CS042")[0] == 404)
removed = {"21CS057", "21EC013", "examiner.ec01", "examiner.ec02", "examiner.ec03"}
check("trimmed demo users are gone", not removed & {u["username"] for u in api("GET", "/api/users")[1]})
check("accounts (refund) user no longer exists", not any(u["username"] == "accounts.01" for u in api("GET", "/api/users")[1]))
# The mock is served by the backend itself (nginx only proxies /api), so ask the backend directly.
import api as _api
_base, _api.BASE = _api.BASE, os.environ.get("BACKEND", "http://localhost:8080")
check("refund mock endpoint is gone", api("POST", "/mock/razorpay/v1/payments/pay_x/refund", body={"amount": 1})[0] in (404, 405))
check("order mock endpoint still works", api("POST", "/mock/razorpay/v1/orders", body={"amount": 1})[0] == 200)
_api.BASE = _base

failed = [n for n, ok in checks if not ok]
print(f"{len(checks) - len(failed)}/{len(checks)} RBAC checks passed")
raise SystemExit(1 if failed else 0)
