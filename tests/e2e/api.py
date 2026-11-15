import json, time, urllib.request, urllib.error, os
BASE = os.environ.get("BASE", "http://localhost:3000")
def api(method, path, user=None, body=None, ok=(200, 201)):
    req = urllib.request.Request(BASE + path, method=method, data=None if body is None else json.dumps(body).encode())
    req.add_header("Content-Type", "application/json")
    if user: req.add_header("X-User", user)
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read().decode(); return r.status, (json.loads(raw) if raw and raw[0] in "[{" else raw)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        return e.code, (json.loads(raw) if raw and raw[0] in "[{" else raw)
def wait(fn, desc, timeout=60, every=1.5):
    t = time.time()
    while time.time() - t < timeout:
        v = fn()
        if v: return v
        time.sleep(every)
    raise SystemExit("TIMEOUT waiting for " + desc)
def task_for(user, element, request_id, view="mine", subject=None):
    def f():
        for v in ([view] if view else ["mine", "group"]):
            s, ts = api("GET", "/api/tasks?view=" + v, user)
            for t in ts if s == 200 else []:
                if t["elementId"] == element and t["requestId"] == request_id and (subject is None or t["subjectCode"] == subject):
                    return t
    return wait(f, f"{element} for {user}")
def status(rid, user):
    return api("GET", f"/api/requests/{rid}/status", user)[1]
def verify(rid, accept=True, remarks=""):
    """Exam cell verifies the application (first step after submission)."""
    t = task_for("examcell.clerk", "verifyApplication", rid, view="group")
    return complete("examcell.clerk", t, {"applicationComplete": accept, "verificationRemarks": remarks})
def complete(user, task, variables):
    s, b = api("POST", f"/api/tasks/{task['key']}/complete", user, {"variables": variables})
    assert s == 200, (s, b); return b
