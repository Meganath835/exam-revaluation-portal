package edu.revaluation.service;

import static edu.revaluation.service.ProcessElements.*;

import edu.revaluation.domain.*;
import edu.revaluation.dto.Dtos.TaskView;
import edu.revaluation.repository.RevaluationRequestRepository;
import io.camunda.client.api.search.enums.UserTaskState;
import io.camunda.client.api.search.response.UserTask;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The custom Tasklist. Reads user tasks from Camunda, adds the request context the forms need,
 * and validates what each kind of task may be completed with before passing it to the engine.
 */
@Service
public class TaskService {
  /** Variables copied into the task view, per task. Anything else stays on the server. */
  private static final List<String> CONTEXT_VARS = List.of(
      "requestId", "studentId", "studentName", "department", "examSession", "subject", "subjects", "subjectResults", "resultPublishedOn");

  /** Blind evaluation: the examiner must not see who wrote the script, the original marks or who the other examiner is. */
  private static final Set<String> HIDDEN_FROM_EXAMINER = Set.of("studentId", "studentName", "subjects", "subjectResults");
  private static final Set<String> SUBJECT_FIELDS_HIDDEN_FROM_EXAMINER = Set.of("originalMarks", "firstExaminerId", "secondExaminerId");

  private static final String STAGE_WITH_EXAMINERS = "With two independent examiners";
  private static final String STAGE_ONE_RECEIVED = "One of two evaluations received";

  private final CamundaGateway camunda;
  private final RevaluationRequestRepository requests;
  private final ExaminerAssignment assignment;
  private final EventLog events;

  public TaskService(CamundaGateway camunda, RevaluationRequestRepository requests, ExaminerAssignment assignment, EventLog events) {
    this.camunda = camunda;
    this.requests = requests;
    this.assignment = assignment;
    this.events = events;
  }

  public List<TaskView> list(AppUser user, String view) {
    List<UserTask> tasks = switch (view) {
      case "group" -> {
        Map<Long, UserTask> byKey = new LinkedHashMap<>();
        for (String g : user.getGroups()) for (UserTask t : camunda.tasksForGroup(g)) byKey.putIfAbsent(t.getUserTaskKey(), t);
        yield new ArrayList<>(byKey.values());
      }
      case "completed" -> camunda.tasksAssignedTo(user.getUsername(), UserTaskState.COMPLETED, 25);
      default -> camunda.tasksAssignedTo(user.getUsername(), UserTaskState.CREATED, 100);
    };
    return tasks.stream()
        .sorted(Comparator.comparing(UserTask::getCreationDate, Comparator.nullsLast(Comparator.reverseOrder())))
        .map(t -> view(user, t, !"completed".equals(view)))
        .toList();
  }

  public TaskView get(AppUser user, long key) {
    UserTask t = camunda.task(key);
    requireVisible(user, t);
    return view(user, t, true);
  }

  public void claim(AppUser user, long key) {
    UserTask t = camunda.task(key);
    requireVisible(user, t);
    if (t.getAssignee() != null && !t.getAssignee().equals(user.getUsername())) {
      throw new ApiException(HttpStatus.CONFLICT, "This task is already claimed by " + t.getAssignee() + ".");
    }
    camunda.claim(key, user.getUsername());
  }

  public void unclaim(AppUser user, long key) {
    UserTask t = camunda.task(key);
    if (!user.getUsername().equals(t.getAssignee())) throw ApiException.forbidden("Only the person who claimed this task can release it.");
    if (t.getCandidateGroups() == null || t.getCandidateGroups().isEmpty()) {
      throw ApiException.badRequest("This task is assigned to you personally and can't be released.");
    }
    camunda.unclaim(key);
  }

  @Transactional
  public void complete(AppUser user, long key, Map<String, Object> input) {
    UserTask t = camunda.task(key);
    requireVisible(user, t);
    if (t.getAssignee() == null) {
      camunda.claim(key, user.getUsername());
    } else if (!t.getAssignee().equals(user.getUsername())) {
      throw new ApiException(HttpStatus.CONFLICT, "This task is claimed by " + t.getAssignee() + ".");
    }
    Map<String, Object> ctx = camunda.taskVariables(key);
    Map<String, Object> vars = validate(user, t.getElementId(), input, ctx);
    // Write our side first and flush: the row lock is held until commit, so a job worker that
    // reacts to this completion (e.g. consolidate-results) writes after us and its update wins.
    // If completing in Camunda fails, the exception rolls our changes back.
    afterComplete(user, t.getElementId(), vars, ctx);
    requests.flush();
    camunda.complete(key, vars);
  }

  // ---------------------------------------------------------------------------------------------

  private Map<String, Object> validate(AppUser user, String elementId, Map<String, Object> in, Map<String, Object> ctx) {
    Map<String, String> errors = new LinkedHashMap<>();
    Map<String, Object> out = new LinkedHashMap<>();
    Map<String, Object> subject = map(ctx.get("subject"));
    String code = str(subject.get("subjectCode"));
    String department = str(subject.get("department"));
    int max = intOf(subject.get("maxMarks"), 100);
    switch (elementId) {
      case SUBMIT_REQUEST -> {
        if (!Boolean.TRUE.equals(bool(in.get("declarationAccepted")))) {
          errors.put("declarationAccepted", "Confirm that these marks match your published marks card.");
        }
        out.put("declarationAccepted", true);
      }
      case VERIFY_APPLICATION -> {
        Boolean accept = bool(in.get("applicationComplete"));
        if (accept == null) errors.put("applicationComplete", "Accept or reject the application.");
        String remarks = str(in.get("verificationRemarks"));
        if (Boolean.FALSE.equals(accept) && remarks.isBlank()) errors.put("verificationRemarks", "Explain why; the student will see this.");
        out.put("applicationComplete", accept);
        out.put("verificationRemarks", remarks);
        out.put("verifiedBy", user.getUsername());
      }
      case ASSIGN_EXAMINER -> {
        // Two different independent examiners, who then evaluate the script at the same time.
        String first = str(in.get("firstExaminerId"));
        String second = str(in.get("secondExaminerId"));
        String problem = assignment.problemWith(first, code, department, List.of());
        if (problem != null) errors.put("firstExaminerId", problem);
        problem = assignment.problemWith(second, code, department, first.isBlank() ? List.of() : List.of(first));
        if (problem != null) errors.put("secondExaminerId", problem);
        String scriptId = str(in.get("scriptId"));
        if (scriptId.isBlank()) {
          scriptId = assignment.archivedScriptId(str(ctx.get("studentId")), code).orElse("");
          if (scriptId.isBlank()) errors.put("scriptId", "No scanned script for " + code + " in the archive. Retrieve the physical script and enter its ID.");
        }
        out.put("firstExaminerId", first);
        out.put("secondExaminerId", second);
        out.put("scriptId", scriptId);
      }
      case EXAMINER_MARKS -> {
        // The same task for both examiners. The process averages the two marks once both are in.
        Integer marks = marks(in.get("examinerMarks"), max, "examinerMarks", errors);
        String remarks = str(in.get("examinerRemarks"));
        if (remarks.isBlank()) errors.put("examinerRemarks", "Add remarks for the exam cell.");
        out.put("examinerMarks", marks);
        out.put("examinerRemarks", remarks);
      }
      case COE_APPROVAL -> {
        Map<String, Map<String, Object>> decisions = decisions(in, ctx, errors);
        // The CoE's decision is final: a rejected increase is withheld and the original marks stand.
        List<Map<String, Object>> results = new ArrayList<>();
        for (Object o : list(ctx.get("subjectResults"))) {
          Map<String, Object> r = new LinkedHashMap<>(map(o));
          Map<String, Object> d = decisions.get(str(r.get("subjectCode")));
          if (d != null) {
            boolean approved = Boolean.TRUE.equals(d.get("approve"));
            r.put("coeApproved", approved);
            r.put("coeRemarks", d.get("remarks"));
            if (!approved) {
              r.put("revisedMarks", r.get("originalMarks"));
              r.put("markDifference", 0);
              r.put("marksIncreased", false);
              r.put("outcome", "WITHHELD");
            }
          }
          results.add(r);
        }
        out.put("subjectResults", results);
        out.put("coeReviewedBy", user.getUsername());
      }
      case UPDATE_RESULT -> {
        if (!Boolean.TRUE.equals(bool(in.get("resultUpdated")))) errors.put("resultUpdated", "Confirm the result system is updated.");
        out.put("resultUpdated", true);
        out.put("resultReference", str(in.get("resultReference")));
      }
      case CHECKOUT -> throw ApiException.badRequest("Use the payment page to complete this task.");
      default -> throw ApiException.badRequest("This task can't be completed from the portal.");
    }
    if (!errors.isEmpty()) throw ApiException.invalid(errors);
    return out;
  }

  /**
   * Reads {decisions: [{subjectCode, approve, remarks}]}: one decision for every subject whose marks
   * increased, and a reason whenever an increase is rejected.
   */
  private static Map<String, Map<String, Object>> decisions(Map<String, Object> in, Map<String, Object> ctx, Map<String, String> errors) {
    Map<String, Map<String, Object>> given = new LinkedHashMap<>();
    for (Object o : list(in.get("decisions"))) given.put(str(map(o).get("subjectCode")), map(o));
    Map<String, Map<String, Object>> out = new LinkedHashMap<>();
    for (Object o : list(ctx.get("subjectResults"))) {
      Map<String, Object> r = map(o);
      if (!Boolean.TRUE.equals(r.get("marksIncreased"))) continue;
      String code = str(r.get("subjectCode"));
      Map<String, Object> d = given.get(code);
      Boolean approve = d == null ? null : bool(d.get("approve"));
      String remarks = d == null ? "" : str(d.get("remarks"));
      if (approve == null) errors.put("decisions", "Approve or reject the increase for " + code + ".");
      else if (!approve && remarks.isBlank()) errors.put("decisions", "Give a reason for rejecting the increase for " + code + ".");
      out.put(code, Map.of("approve", Boolean.TRUE.equals(approve), "remarks", remarks));
    }
    if (out.isEmpty()) errors.put("decisions", "There is no mark increase to review.");
    return out;
  }

  /** Keeps the database (tracker and reports) in step with what people decided. */
  private void afterComplete(AppUser user, String elementId, Map<String, Object> vars, Map<String, Object> ctx) {
    String requestId = str(ctx.get("requestId"));
    if (requestId.isBlank()) return;
    Optional<RevaluationRequest> req = requests.findById(requestId);
    String code = str(map(ctx.get("subject")).get("subjectCode"));
    RequestSubject subject = req.map(r -> r.subject(code)).orElse(null);
    switch (elementId) {
      case SUBMIT_REQUEST -> events.record(requestId, "Submission confirmed by the student.");
      case VERIFY_APPLICATION -> {
        boolean accepted = Boolean.TRUE.equals(vars.get("applicationComplete"));
        req.ifPresent(r -> r.getSubjects().forEach(s -> s.setStage(accepted ? "Application accepted: checking eligibility" : "Application not accepted")));
        events.record(requestId, accepted ? "Exam cell verified and accepted the application." : "Exam cell did not accept the application.");
      }
      case ASSIGN_EXAMINER -> {
        if (subject != null) {
          subject.setExaminerId(str(vars.get("firstExaminerId")));
          subject.setSecondExaminerId(str(vars.get("secondExaminerId")));
          subject.setScriptId(str(vars.get("scriptId")));
          subject.setStage(STAGE_WITH_EXAMINERS);
        }
        events.record(requestId, "Exam cell assigned two independent examiners for " + code + ".");
      }
      case EXAMINER_MARKS -> {
        // Both examiners work in parallel, so either may finish first.
        if (subject != null) {
          subject.setStage(STAGE_ONE_RECEIVED.equals(subject.getStage()) ? "Both evaluations received: comparing marks" : STAGE_ONE_RECEIVED);
        }
        events.record(requestId, "An examiner sent updated marks for " + code + " to the exam cell.");
      }
      case COE_APPROVAL -> {
        long rejected = list(vars.get("subjectResults")).stream().filter(o -> "WITHHELD".equals(map(o).get("outcome"))).count();
        events.record(requestId, "Controller of Examinations " + (rejected == 0 ? "approved the revised result." : "withheld " + rejected + " increase(s)."));
      }
      case UPDATE_RESULT -> events.record(requestId, "Official result updated by " + user.getDisplayName() + ".");
      default -> {}
    }
    req.ifPresent(requests::save);
  }

  private void requireVisible(AppUser user, UserTask t) {
    boolean mine = user.getUsername().equals(t.getAssignee());
    boolean group = t.getCandidateGroups() != null && t.getCandidateGroups().stream().anyMatch(user.getGroups()::contains);
    if (!mine && !group) throw ApiException.notFound("Task " + t.getUserTaskKey());
  }

  private TaskView view(AppUser user, UserTask t, boolean withContext) {
    Map<String, Object> ctx = new LinkedHashMap<>();
    if (withContext) {
      Map<String, Object> all = camunda.taskVariables(t.getUserTaskKey());
      for (String k : CONTEXT_VARS) if (all.containsKey(k)) ctx.put(k, all.get(k));
      if (EXAMINER_TASKS.contains(t.getElementId())) {
        HIDDEN_FROM_EXAMINER.forEach(ctx::remove);
        Map<String, Object> subject = new LinkedHashMap<>(map(ctx.get("subject")));
        SUBJECT_FIELDS_HIDDEN_FROM_EXAMINER.forEach(subject::remove);
        ctx.put("subject", subject);
      }
      addAssignmentHints(t.getElementId(), ctx);
    }
    Map<String, Object> subject = map(ctx.get("subject"));
    boolean mine = user.getUsername().equals(t.getAssignee());
    boolean open = t.getState() == UserTaskState.CREATED;
    return new TaskView(t.getUserTaskKey(), t.getElementId(), t.getName(), String.valueOf(t.getState()), t.getAssignee(),
        t.getCandidateGroups() == null ? List.of() : t.getCandidateGroups(), t.getCreationDate(), t.getDueDate(),
        t.getProcessInstanceKey(), (String) ctx.get("requestId"), (String) subject.get("subjectCode"),
        (String) subject.get("subjectName"), ctx, open && t.getAssignee() == null,
        open && (mine || t.getAssignee() == null) && !CHECKOUT.equals(t.getElementId()));
  }

  /** What the exam cell needs to pick two independent examiners: who to avoid, two suggestions, the archived script. */
  private void addAssignmentHints(String elementId, Map<String, Object> ctx) {
    if (!ASSIGN_EXAMINER.equals(elementId)) return;
    Map<String, Object> subject = map(ctx.get("subject"));
    String code = str(subject.get("subjectCode"));
    List<AppUser> suggested = assignment.suggestions(code, str(subject.get("department")));
    ctx.put("firstEvaluator", assignment.firstEvaluator(code));
    ctx.put("suggestedExaminerId", suggested.isEmpty() ? null : suggested.get(0).getUsername());
    ctx.put("suggestedSecondExaminerId", suggested.size() < 2 ? null : suggested.get(1).getUsername());
    ctx.put("archivedScriptId", assignment.archivedScriptId(str(ctx.get("studentId")), code).orElse(null));
  }

  // ---- small conversion helpers -----------------------------------------------------------------

  private static Integer marks(Object value, int max, String field, Map<String, String> errors) {
    Integer marks = integer(value);
    if (marks == null) errors.put(field, "Enter the marks.");
    else if (marks < 0 || marks > max) errors.put(field, "Marks must be between 0 and " + max + ".");
    return marks;
  }

  private static List<?> list(Object o) {
    return o instanceof List<?> l ? l : List.of();
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> map(Object o) {
    return o instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
  }

  private static String str(Object o) {
    return o == null ? "" : String.valueOf(o).trim();
  }

  private static Boolean bool(Object o) {
    if (o instanceof Boolean b) return b;
    if ("true".equals(o)) return true;
    if ("false".equals(o)) return false;
    return null;
  }

  private static Integer integer(Object o) {
    if (o instanceof Number n) return n.doubleValue() == Math.rint(n.doubleValue()) ? n.intValue() : null;
    try {
      return o == null ? null : Integer.valueOf(String.valueOf(o).trim());
    } catch (NumberFormatException e) {
      return null;
    }
  }

  private static int intOf(Object o, int fallback) {
    Integer i = integer(o);
    return i == null ? fallback : i;
  }
}
