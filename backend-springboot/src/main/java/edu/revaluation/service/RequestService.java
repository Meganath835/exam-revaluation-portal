package edu.revaluation.service;

import edu.revaluation.config.AppProperties;
import edu.revaluation.domain.*;
import edu.revaluation.dto.Dtos.*;
import edu.revaluation.repository.*;
import io.camunda.client.api.search.response.UserTask;
import java.time.Duration;
import java.time.Year;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class RequestService {
  private static final Logger LOG = LoggerFactory.getLogger(RequestService.class);
  private static final List<RequestStatus> CLOSED = Arrays.stream(RequestStatus.values()).filter(RequestStatus::isTerminal).toList();
  /** How long to wait for the new "Submit revaluation request" task to become searchable. */
  private static final Duration SUBMIT_TASK_WAIT = Duration.ofSeconds(15);

  private final RevaluationRequestRepository requests;
  private final SubjectCatalogRepository catalog;
  private final ExamSessionRepository sessions;
  private final CamundaGateway camunda;
  private final EventLog events;
  private final AppProperties props;
  private final TransactionTemplate tx;
  private final StatusService status;

  public RequestService(RevaluationRequestRepository requests, SubjectCatalogRepository catalog,
      ExamSessionRepository sessions, CamundaGateway camunda, EventLog events, AppProperties props,
      TransactionTemplate tx, StatusService status) {
    this.tx = tx;
    this.status = status;
    this.requests = requests;
    this.catalog = catalog;
    this.sessions = sessions;
    this.camunda = camunda;
    this.events = events;
    this.props = props;
  }

  /**
   * Validates the form, saves the request, starts revaluationProcess with the start payload and
   * completes the student's "Submit revaluation request" task with the validated application.
   * The row is committed BEFORE the process starts, so every later step can always find it.
   */
  public RevaluationRequest create(AppUser student, CreateRequest body) {
    ExamSession session = sessions.findById(body.examSession())
        .orElseThrow(() -> ApiException.invalid(Map.of("examSession", "Unknown exam session.")));
    // One open request per student and exam session. The stored status follows the engine lazily,
    // so bring the student's open requests up to date first (one may have just been closed by a timer).
    requests.findByStudentUsernameOrderByCreatedAtDesc(student.getUsername()).stream()
        .filter(r -> r.getExamSession().equals(session.getCode()) && !r.getStatus().isTerminal())
        .forEach(r -> status.status(r, false));
    if (requests.existsByStudentUsernameAndExamSessionAndStatusNotIn(student.getUsername(), session.getCode(), CLOSED)) {
      throw new ApiException(HttpStatus.CONFLICT, "You already have an open revaluation request for " + session.getCode() + ".",
          Map.of("examSession", "You already have an open revaluation request for this session."));
    }

    Map<String, String> errors = new LinkedHashMap<>();
    Set<String> seen = new HashSet<>();
    List<RequestSubject> subjects = new ArrayList<>();
    for (int i = 0; i < body.subjects().size(); i++) {
      SubjectInput in = body.subjects().get(i);
      String field = "subjects[" + i + "]";
      Optional<SubjectCatalog> found = catalog.findById(in.subjectCode());
      if (found.isEmpty()) {
        errors.put(field + ".subjectCode", "Unknown subject " + in.subjectCode() + ".");
        continue;
      }
      if (!seen.add(in.subjectCode())) {
        errors.put(field + ".subjectCode", in.subjectCode() + " is already in the list.");
        continue;
      }
      SubjectCatalog c = found.get();
      if (!Objects.equals(c.getDepartment(), student.getDepartment())) {
        errors.put(field + ".subjectCode", in.subjectCode() + " is not a " + student.getDepartment() + " subject.");
        continue;
      }
      if (in.originalMarks() > c.getMaxMarks()) {
        errors.put(field + ".originalMarks", "Marks must be between 0 and " + c.getMaxMarks() + ".");
        continue;
      }
      subjects.add(new RequestSubject(c, in.originalMarks()));
    }
    if (!errors.isEmpty()) throw ApiException.invalid(errors);

    RevaluationRequest saved = tx.execute(status -> {
      String id = "REV-%d-%04d".formatted(Year.now().getValue(), requests.nextSequence());
      RevaluationRequest request = new RevaluationRequest(id, student, session, props.feePerSubjectPaise());
      subjects.forEach(request::addSubject);
      return requests.save(request);
    });
    String id = saved.getId();
    events.record(id, "Request submitted for " + subjects.size() + " subject(s).");

    long key;
    try {
      key = camunda.startRevaluation(startVariables(saved));
    } catch (RuntimeException e) {
      requests.deleteById(id);
      throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "The workflow engine is not reachable, so the request was not submitted. Try again shortly.");
    }
    tx.executeWithoutResult(status -> requests.setProcessInstanceKey(id, key));
    submitApplication(id, key);
    return get(id);
  }

  /**
   * The portal form is the "Submit revaluation request" user task: the backend has validated every
   * subject and mark, so it completes the task with declarationAccepted = true. Camunda's search
   * index lags the engine slightly, so wait briefly for the task. If it does not appear in time the
   * task stays in the student's inbox, where they can confirm it themselves.
   */
  private void submitApplication(String id, long processInstanceKey) {
    long deadline = System.nanoTime() + SUBMIT_TASK_WAIT.toNanos();
    try {
      while (System.nanoTime() < deadline) {
        Optional<UserTask> task = camunda.openTask(processInstanceKey, ProcessElements.SUBMIT_REQUEST);
        if (task.isPresent()) {
          camunda.complete(task.get().getUserTaskKey(), Map.of("declarationAccepted", true));
          events.record(id, "Application submitted; waiting for the exam cell to verify it.");
          return;
        }
        Thread.sleep(300);
      }
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    } catch (RuntimeException e) {
      LOG.warn("Could not complete the submit task for {}: {}", id, e.getMessage());
    }
    LOG.warn("Submit task for {} not completed automatically; it stays in the student's task inbox.", id);
  }

  /** The process start payload. Documented in the README and report section 4.2. */
  Map<String, Object> startVariables(RevaluationRequest r) {
    AppUser s = r.getStudent();
    List<Map<String, Object>> subjects = r.getSubjects().stream().map(sub -> Map.<String, Object>of(
        "subjectCode", sub.getSubjectCode(),
        "subjectName", sub.getSubjectName(),
        "department", sub.getDepartment(),
        "originalMarks", sub.getOriginalMarks(),
        "maxMarks", sub.getMaxMarks())).toList();
    Map<String, Object> config = Map.of(
        "revaluationWindow", props.revaluationWindow(),
        "paymentWindow", props.paymentWindow(),
        "examinerSla", props.examinerSla(),
        "razorpayBaseUrl", props.razorpay().connectorBaseUrl());
    Map<String, Object> vars = new LinkedHashMap<>();
    vars.put("requestId", r.getId());
    vars.put("studentId", s.getUsername());
    vars.put("studentName", s.getDisplayName());
    vars.put("studentEmail", s.getEmail());
    vars.put("department", s.getDepartment());
    vars.put("examSession", r.getExamSession());
    vars.put("resultPublishedOn", r.getResultPublishedOn().toString());
    vars.put("feePerSubject", r.getFeePerSubjectPaise());
    vars.put("subjects", subjects);
    vars.put("config", config);
    return vars;
  }

  public RevaluationRequest get(String id) {
    return requests.findById(id).orElseThrow(() -> ApiException.notFound("Request " + id));
  }

  /** Students only see their own requests; staff see all. */
  public RevaluationRequest getFor(AppUser user, String id) {
    RevaluationRequest r = get(id);
    if (user.getRole() == Role.STUDENT && !r.getStudent().getUsername().equals(user.getUsername())) {
      throw ApiException.notFound("Request " + id);
    }
    return r;
  }

  public List<RevaluationRequest> list(AppUser user) {
    return user.getRole() == Role.STUDENT
        ? requests.findByStudentUsernameOrderByCreatedAtDesc(user.getUsername())
        : requests.findAllByOrderByCreatedAtDesc();
  }
}
