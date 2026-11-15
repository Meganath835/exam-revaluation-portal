"""T1: two subjects from submission to result publication, following the BPMN lanes.

CS301 38 -> examiner 1 gives 46, examiner 2 gives 50 -> final 48: increased.
CS305 54 -> examiner 1 gives 54, examiner 2 gives 52 -> final 53: not increased.
At least one increase, so the exam cell updates the official result before it is published.
"""
from api import *

S = "21CS042"
CSE_EXAMINERS = ["examiner.cs01", "examiner.cs02", "examiner.cs03"]
MARKS = {"CS301": (46, 50), "CS305": (54, 52)}

s, r = api("POST", "/api/requests", S, {"examSession": "MAY-2026", "subjects": [{"subjectCode": "CS301", "originalMarks": 38}, {"subjectCode": "CS305", "originalMarks": 54}]})
assert s == 201, (s, r); rid = r["id"]; print("created", rid, r["totalFeePaise"])

# Request and Eligibility: the portal completed "Submit revaluation request"; the exam cell verifies it.
wait(lambda: (lambda x: x if x["status"] == "AWAITING_VERIFICATION" else None)(status(rid, S)), "AWAITING_VERIFICATION")
t = task_for("examcell.clerk", "verifyApplication", rid, view="group")
assert [x["subjectCode"] for x in t["context"]["subjects"]] == ["CS301", "CS305"], t["context"]
assert api("GET", f"/api/tasks/{t['key']}", "examiner.cs01")[0] == 404, "only the exam cell may verify"
s, b = api("POST", f"/api/tasks/{t['key']}/complete", "examcell.clerk", {"variables": {"applicationComplete": False, "verificationRemarks": ""}})
assert s == 400 and "verificationRemarks" in b["fieldErrors"], (s, b)
complete("examcell.clerk", t, {"applicationComplete": True, "verificationRemarks": "Marks card checked"})
# ... and the eligibility DMN said yes.
st = wait(lambda: (lambda x: x if x["status"] == "AWAITING_PAYMENT" else None)(status(rid, S)), "AWAITING_PAYMENT")
assert st["elements"] == [], "students must not receive BPMN element states"
print("stages:", [(x["key"], x["state"]) for x in st["stages"]])

# Payment Processing: REST connector order, mock Checkout, server-side signature check.
p = wait(lambda: (lambda x: x[1] if x[0] == 200 and x[1]["razorpayOrderId"] else None)(api("GET", f"/api/requests/{rid}/payment", S)), "payment order")
print("payment order:", p["razorpayOrderId"], p["amountPaise"])
s, b = api("POST", f"/api/payments/{rid}/mock-checkout", S, {"outcome": "success"}); assert s == 200 and b["status"] == "PAID", b

def examiner_task(element, code):
    def f():
        for ex in CSE_EXAMINERS:
            for t in api("GET", "/api/tasks?view=mine", ex)[1]:
                if t["elementId"] == element and t["requestId"] == rid and t["subjectCode"] == code: return ex, t
    return wait(f, f"{element} {code}")

# Each examination step runs once per subject (parallel multi-instance); the next step starts when
# every subject has finished the current one, so the test works step by step across both subjects.
first, second = {}, {}

# Clerk assigns independent examiner (suggestion and archived script come from the backend).
for code in MARKS:
    t = task_for("examcell.clerk", "clerkAssignExaminer", rid, view="group", subject=code)
    first[code] = t["context"]["suggestedExaminerId"]
    assert first[code] and first[code] != t["context"]["firstEvaluator"], t["context"]
    complete("examcell.clerk", t, {"firstExaminerId": first[code], "scriptId": t["context"]["archivedScriptId"]})

# Examiner sends updated marks to clerk (blind).
for code, (m1, _) in MARKS.items():
    ex, t = examiner_task("examinerSendsMarks", code)
    assert ex == first[code]
    hidden = {"studentId", "studentName", "subjects"} & set(t["context"]) or {"originalMarks"} & set(t["context"]["subject"])
    assert not hidden, f"blind evaluation leaked {hidden}"
    complete(ex, t, {"firstExaminerMarks": m1, "firstExaminerRemarks": "Rechecked all answers"})

# Clerk assigns second independent examiner, seeing the first examiner's marks.
for code, (m1, _) in MARKS.items():
    t = task_for("examcell.clerk", "clerkAssignSecondExaminer", rid, view="group", subject=code)
    assert t["context"]["subject"]["firstExaminerMarks"] == m1
    second[code] = t["context"]["suggestedExaminerId"]
    assert second[code] not in (first[code], t["context"]["firstEvaluator"]), t["context"]
    complete("examcell.clerk", t, {"secondExaminerId": second[code]})

# Re-evaluate answer script (blind, first examiner's marks hidden too).
for code, (m1, m2) in MARKS.items():
    ex2, t = examiner_task("reEvaluateScript", code)
    assert ex2 == second[code] and "firstExaminerMarks" not in t["context"]["subject"], t["context"]
    complete(ex2, t, {"secondExaminerMarks": m2, "examinerRemarks": "Second evaluation done"})
    print(code, "examiners:", first[code], "->", m1, "|", second[code], "->", m2)

# Marks increased? Yes (CS301) -> HOD reviews -> CoE approves -> Increase approved? Yes.
t = task_for("hod.cse", "hodReviewIncrease", rid, view="group")
assert [r["subjectCode"] for r in t["context"]["subjectResults"] if r["marksIncreased"]] == ["CS301"]
assert api("GET", f"/api/tasks/{t['key']}", "hod.ece")[0] == 404, "another department's HOD must not see it"
s, b = api("POST", f"/api/tasks/{t['key']}/complete", "hod.cse", {"variables": {"decisions": []}})
assert s == 400 and "decisions" in b["fieldErrors"], (s, b)
complete("hod.cse", t, {"decisions": [{"subjectCode": "CS301", "approve": True, "remarks": "Totalling error confirmed"}]})
t = task_for("coe", "coeApproveResult", rid, view="group")
assert t["context"]["hodReview"][0]["recommendation"] == "APPROVE", t["context"]
complete("coe", t, {"decisions": [{"subjectCode": "CS301", "approve": True, "remarks": ""}]})
print("HOD and CoE approved the CS301 increase")

t = task_for("examcell.clerk", "updateOfficialResult", rid, view="group")
print("update result:", [(x["subjectCode"], x["originalMarks"], x["revisedMarks"], x["outcome"]) for x in t["context"]["subjectResults"]])
complete("examcell.clerk", t, {"resultUpdated": True, "resultReference": "RES-1"})

st = wait(lambda: (lambda x: x if x["status"] == "COMPLETED" else None)(status(rid, S)), "COMPLETED", timeout=90)
print("FINAL", st["status"], [(x["key"], x["state"]) for x in st["stages"]])
subjects = {x["subjectCode"]: x for x in st["subjects"]}
assert (subjects["CS301"]["revisedMarks"], subjects["CS301"]["outcome"]) == (48, "REVISED"), subjects["CS301"]
assert (subjects["CS305"]["revisedMarks"], subjects["CS305"]["outcome"]) == (53, "UNCHANGED"), subjects["CS305"]
assert all(x["state"] == "done" for x in st["stages"]), st["stages"]
for e in reversed(st["events"]): print("  -", e["message"])

# The exam cell's Process View shows the same instance with all of its tasks.
s, d = api("GET", f"/api/process-view/requests/{rid}", "examcell.clerk"); assert s == 200, d
names = [x["name"] for x in d["tasks"]]
assert len(d["tasks"]) == 1 + 1 + 1 + 4 * 2 + 2 + 1, names   # submit, verify, checkout, 4 examination tasks x 2 subjects, HOD, CoE, update result
assert all(x["state"] == "COMPLETED" for x in d["tasks"]), d["tasks"]
assert not any("refund" in x["elementId"].lower() for x in d["elements"])
print("process view tasks:", len(d["tasks"]), "| elements:", len(d["elements"]))
print("T1 PASS")
