"""T2-T8: every non-happy path of the workflow. Run after t1_happy.py on a fresh database.

There is one demo student, who may have one open request per exam session, so the scenarios run one
after another, each starting once the previous request has closed.

T2  window closed (DEC-2025)        -> Eligible? No -> Notify: request rejected -> Closed
T2b exam cell rejects the application -> Eligible? No (with the clerk's remarks) -> Closed
T4  forged payment signature        -> Payment successful? No -> Notify Payment Failure -> Closed
T8  second open request, same session -> 409 before anything starts
T3  student doesn't pay             -> payment window timer -> Notify Payment Failure -> Closed (unpaid)
T7  no mark increases               -> Marks increased? No -> straight to publication
T5  no scanned script (CS399)       -> clerk must enter the physical script id
T6  examiner not independent, or the same examiner twice -> clerk's choice rejected; CoE rejects the increase -> WITHHELD
"""
import traceback
from api import *

S = "21CS042"
results = {}

def create(student, session, subjects, accept=True):
    s, r = api("POST", "/api/requests", student, {"examSession": session, "subjects": subjects}); assert s == 201, (s, r)
    if accept is not None: verify(r["id"], accept, "" if accept else "Marks card copy missing")
    return r["id"]

def final(rid, student, want, timeout=240):
    return wait(lambda: (lambda x: x if x["status"] == want else None)(status(rid, student)), want, timeout=timeout, every=3)

def pay_info(rid, student):
    return wait(lambda: (lambda x: x[1] if x[0] == 200 and x[1]["razorpayOrderId"] else None)(api("GET", f"/api/requests/{rid}/payment", student)), "payment")

def pay(rid, student):
    pay_info(rid, student)
    s, b = api("POST", f"/api/payments/{rid}/mock-checkout", student, {"outcome": "success"}); assert s == 200 and b["status"] == "PAID", b

def examiner_tasks(rid, code, pool):
    """The open tasks of both examiners of one subject (they work in parallel): {examiner: task}."""
    def f():
        found = {}
        for ex in pool:
            for t in api("GET", "/api/tasks?view=mine", ex)[1]:
                if t["elementId"] == "examinerSendsMarks" and t["requestId"] == rid and t["subjectCode"] == code: found[ex] = t
        return found if len(found) == 2 else None
    return wait(f, f"both examiner tasks for {code}")

def evaluate(rid, code, m1, m2, pool):
    tasks = examiner_tasks(rid, code, pool)
    for (ex, t), m in zip(sorted(tasks.items()), (m1, m2)): complete(ex, t, {"examinerMarks": m, "examinerRemarks": "ok"})
    return tasks

def revalue(rid, code, m1, m2, pool, script=None):
    t = task_for("examcell.clerk", "clerkAssignExaminer", rid, view="group", subject=code)
    c = t["context"]
    complete("examcell.clerk", t, {"firstExaminerId": c["suggestedExaminerId"], "secondExaminerId": c["suggestedSecondExaminerId"], "scriptId": script or c["archivedScriptId"]})
    evaluate(rid, code, m1, m2, pool)

def run(name, fn):
    try: results[name] = "PASS " + str(fn())
    except BaseException as e: results[name] = "FAIL: " + repr(e) + traceback.format_exc()[-600:]

def t2():
    rid = create(S, "DEC-2025", [{"subjectCode": "CS310", "originalMarks": 40}])
    st = final(rid, S, "REJECTED")
    reason = api("GET", f"/api/requests/{rid}", S)[1]["rejectionReason"]
    assert "window" in reason, reason
    states = {x["key"]: x["state"] for x in st["stages"]}
    assert (states["verified"], states["eligible"]) == ("done", "stopped"), st["stages"]
    return reason

def t2b():
    rid = create(S, "MAY-2026", [{"subjectCode": "CS310", "originalMarks": 40}], accept=False)
    st = final(rid, S, "REJECTED")
    reason = api("GET", f"/api/requests/{rid}", S)[1]["rejectionReason"]
    assert "exam cell did not accept" in reason and "Marks card copy missing" in reason, reason
    states = {x["key"]: x["state"] for x in st["stages"]}
    assert (states["verified"], states["eligible"]) == ("done", "stopped"), st["stages"]
    return reason

def t4():
    rid = create(S, "MAY-2026", [{"subjectCode": "CS301", "originalMarks": 50}]); pay_info(rid, S)
    s, b = api("POST", f"/api/payments/{rid}/mock-checkout", S, {"outcome": "failure"}); assert s == 200 and b["status"] == "PAYMENT_FAILED", b
    return final(rid, S, "CLOSED_PAYMENT_FAILED")["status"]

def t8():
    global T8_CREATED, T8_RID
    T8_RID = create(S, "MAY-2026", [{"subjectCode": "CS310", "originalMarks": 61}])
    T8_CREATED = time.time()
    s, b = api("POST", "/api/requests", S, {"examSession": "MAY-2026", "subjects": [{"subjectCode": "CS320", "originalMarks": 30}]})
    assert s == 409 and "examSession" in b["fieldErrors"], (s, b)
    return b["message"] + f" (open request {T8_RID} is left unpaid for T3)"

def t3_t7():
    # T8's request is left unpaid, so the payment window (PT1M) closes it (T3). Nobody looks at it in
    # between, so the new submission itself must notice that it closed.
    time.sleep(max(0, T8_CREATED + 80 - time.time()))
    rid = create(S, "MAY-2026", [{"subjectCode": "CS310", "originalMarks": 61}])
    old = status(T8_RID, S)
    assert old["status"] == "CLOSED_UNPAID", old["status"]
    assert {x["key"]: x["state"] for x in old["stages"]}["paid"] == "stopped", old["stages"]
    # T7: no increase, so no CoE approval and no Update official result.
    pay(rid, S)
    revalue(rid, "CS310", 60, 59, ["examiner.cs01", "examiner.cs02"])   # 61 -> 60 (rounded half up): not increased
    st = final(rid, S, "COMPLETED")
    s, d = api("GET", f"/api/process-view/requests/{rid}", "examcell.clerk")
    assert not {"coeApproveResult", "updateOfficialResult"} & {x["elementId"] for x in d["tasks"]}, "No-branch must skip approval and update"
    return "T3 CLOSED_UNPAID; T7 " + str([(x["subjectCode"], x["originalMarks"], x["revisedMarks"], x["outcome"]) for x in st["subjects"]])

def t5_t6():
    rid = create(S, "MAY-2026", [{"subjectCode": "CS399", "originalMarks": 33}])
    pay(rid, S)
    t = task_for("examcell.clerk", "clerkAssignExaminer", rid, view="group", subject="CS399")
    c = t["context"]
    assert c["archivedScriptId"] is None, c
    first, second = c["suggestedExaminerId"], c["suggestedSecondExaminerId"]
    url = f"/api/tasks/{t['key']}/complete"
    s, b = api("POST", url, "examcell.clerk", {"variables": {"firstExaminerId": first, "secondExaminerId": second, "scriptId": ""}})
    assert s == 400 and "scriptId" in b["fieldErrors"], (s, b)
    s, b = api("POST", url, "examcell.clerk", {"variables": {"firstExaminerId": c["firstEvaluator"], "secondExaminerId": second, "scriptId": "SCR-PHYS-77"}})
    assert s == 400 and "first evaluation" in b["fieldErrors"]["firstExaminerId"], (s, b)
    s, b = api("POST", url, "examcell.clerk", {"variables": {"firstExaminerId": first, "secondExaminerId": first, "scriptId": "SCR-PHYS-77"}})
    assert s == 400 and "two different examiners" in b["fieldErrors"]["secondExaminerId"], (s, b)
    complete("examcell.clerk", t, {"firstExaminerId": first, "secondExaminerId": second, "scriptId": "SCR-PHYS-77"})
    tasks = evaluate(rid, "CS399", 45, 47, ["examiner.cs01", "examiner.cs03"])
    assert all(x["context"]["subject"]["scriptId"] == "SCR-PHYS-77" for x in tasks.values()), tasks
    # The CoE rejects the increase: it is withheld and nothing is updated.
    t = task_for("coe", "coeApproveResult", rid, view="group")
    s, b = api("POST", f"/api/tasks/{t['key']}/complete", "coe", {"variables": {"decisions": [{"subjectCode": "CS399", "approve": False, "remarks": ""}]}})
    assert s == 400 and "reason" in b["fieldErrors"]["decisions"], (s, b)
    complete("coe", t, {"decisions": [{"subjectCode": "CS399", "approve": False, "remarks": "Answer to Q3 does not merit the increase"}]})
    st = final(rid, S, "COMPLETED")
    s, d = api("GET", f"/api/process-view/requests/{rid}", "examcell.clerk")
    assert "updateOfficialResult" not in [x["elementId"] for x in d["tasks"]], "a withheld increase must skip Update official result"
    sub = st["subjects"][0]
    assert (sub["revisedMarks"], sub["outcome"]) == (33, "WITHHELD"), sub
    return str([(x["subjectCode"], x["originalMarks"], x["revisedMarks"], x["outcome"]) for x in st["subjects"]])

run("T2 window closed", t2)
run("T2b exam cell rejects", t2b)
run("T4 payment failed", t4)
run("T8 duplicate", t8)
if results["T8 duplicate"].startswith("PASS"): run("T3 payment window + T7 no increase", t3_t7)
run("T5/T6 missing script + independence + CoE rejects", t5_t6)
for k, v in results.items(): print(f"{k}: {v}")
raise SystemExit(0 if all(v.startswith("PASS") for v in results.values()) else 1)
