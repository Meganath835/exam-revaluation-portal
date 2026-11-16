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

def examiner_tasks(code):
    """The open tasks of both examiners of one subject: {examiner: task}."""
    def f():
        found = {}
        for ex in CSE_EXAMINERS:
            for t in api("GET", "/api/tasks?view=mine", ex)[1]:
                if t["elementId"] == "examinerSendsMarks" and t["requestId"] == rid and t["subjectCode"] == code: found[ex] = t
        return found if len(found) == 2 else None
    return wait(f, f"both examiner tasks for {code}")

# Clerk assigns independent examiners: one task per subject (parallel multi-instance), two examiners
# per task. Suggestions and the archived script come from the backend.
assigned = {}
for code in MARKS:
    t = task_for("examcell.clerk", "clerkAssignExaminer", rid, view="group", subject=code)
    c = t["context"]
    pair = (c["suggestedExaminerId"], c["suggestedSecondExaminerId"])
    assert all(pair) and pair[0] != pair[1] and c["firstEvaluator"] not in pair, c
    s, b = api("POST", f"/api/tasks/{t['key']}/complete", "examcell.clerk", {"variables": {"firstExaminerId": pair[0], "secondExaminerId": pair[0], "scriptId": c["archivedScriptId"]}})
    assert s == 400 and "two different examiners" in b["fieldErrors"]["secondExaminerId"], (s, b)
    complete("examcell.clerk", t, {"firstExaminerId": pair[0], "secondExaminerId": pair[1], "scriptId": c["archivedScriptId"]})
    assigned[code] = pair

# Examiner sends updated marks to clerk: one task per subject and examiner (parallel multi-instance),
# so both examiners of a subject have their task at the same time. Blind; the second examiner
# answers first here to show that the order doesn't matter.
for code, marks in MARKS.items():
    tasks = examiner_tasks(code)
    assert set(tasks) == set(assigned[code]), (tasks.keys(), assigned[code])
    for ex, m in reversed(list(zip(assigned[code], marks))):
        t = tasks[ex]
        hidden = {"studentId", "studentName", "subjects", "subjectResults"} & set(t["context"]) \
            or {"originalMarks", "firstExaminerId", "secondExaminerId"} & set(t["context"]["subject"])
        assert not hidden, f"blind evaluation leaked {hidden}"
        assert t["context"]["subject"]["examinerId"] == ex, t["context"]
        complete(ex, t, {"examinerMarks": m, "examinerRemarks": "Rechecked all answers"})
    print(code, "examiners:", assigned[code][0], "->", marks[0], "|", assigned[code][1], "->", marks[1])

# Marks increased? Yes (CS301) -> straight to the CoE -> Increase approved? Yes.
t = task_for("coe", "coeApproveResult", rid, view="group")
increased = [r for r in t["context"]["subjectResults"] if r["marksIncreased"]]
assert [r["subjectCode"] for r in increased] == ["CS301"], t["context"]
assert (increased[0]["firstExaminerMarks"], increased[0]["secondExaminerMarks"], increased[0]["revisedMarks"]) == (46, 50, 48), increased
s, b = api("POST", f"/api/tasks/{t['key']}/complete", "coe", {"variables": {"decisions": []}})
assert s == 400 and "decisions" in b["fieldErrors"], (s, b)
complete("coe", t, {"decisions": [{"subjectCode": "CS301", "approve": True, "remarks": "Totalling error confirmed"}]})
print("CoE approved the CS301 increase")

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
assert len(d["tasks"]) == 1 + 1 + 1 + 2 + 2 * 2 + 1 + 1, names   # submit, verify, checkout, assign x 2 subjects, examiner x 2 subjects x 2 examiners, CoE, update result
assert not any("hod" in x["elementId"].lower() for x in d["tasks"]), names
assert all(x["state"] == "COMPLETED" for x in d["tasks"]), d["tasks"]
assert not any("refund" in x["elementId"].lower() for x in d["elements"])
print("process view tasks:", len(d["tasks"]), "| elements:", len(d["elements"]))
print("T1 PASS")
