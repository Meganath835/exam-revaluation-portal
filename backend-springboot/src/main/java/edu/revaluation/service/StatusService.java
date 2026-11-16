package edu.revaluation.service;

import static edu.revaluation.service.ProcessElements.*;

import edu.revaluation.domain.RequestStatus;
import edu.revaluation.domain.RevaluationRequest;
import edu.revaluation.dto.Dtos.*;
import edu.revaluation.repository.RequestEventRepository;
import edu.revaluation.repository.RevaluationRequestRepository;
import io.camunda.client.api.search.enums.ElementInstanceState;
import io.camunda.client.api.search.response.ElementInstance;
import java.time.OffsetDateTime;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Builds the live status tracker from two sources: element instances from Camunda (where the
 * process is right now) and the database (per-subject progress and the activity log). It also keeps
 * the request's status column in step with the engine.
 */
@Service
public class StatusService {
  private static final Logger LOG = LoggerFactory.getLogger(StatusService.class);

  /** Main-process element id → status while that element is active. */
  private static final Map<String, RequestStatus> ACTIVE_STATUS = Map.ofEntries(
      Map.entry(SUBMIT_REQUEST, RequestStatus.SUBMITTED),
      Map.entry(VERIFY_APPLICATION, RequestStatus.AWAITING_VERIFICATION),
      Map.entry(EVALUATE_ELIGIBILITY, RequestStatus.AWAITING_VERIFICATION),
      Map.entry(CREATE_ORDER, RequestStatus.AWAITING_PAYMENT),
      Map.entry(CHECKOUT, RequestStatus.AWAITING_PAYMENT),
      Map.entry(ASSIGN_EXAMINER, RequestStatus.UNDER_REVALUATION),
      Map.entry(EXAMINER_MARKS, RequestStatus.UNDER_REVALUATION),
      Map.entry(EVALUATE_MARKS, RequestStatus.UNDER_REVALUATION),
      Map.entry(COE_APPROVAL, RequestStatus.AWAITING_APPROVAL),
      Map.entry(UPDATE_RESULT, RequestStatus.RESULTS_READY),
      Map.entry(NOTIFY_RESULT, RequestStatus.RESULTS_READY));

  private final CamundaGateway camunda;
  private final RevaluationRequestRepository requests;
  private final RequestEventRepository events;
  private final RequestUpdater updater;

  public StatusService(CamundaGateway camunda, RevaluationRequestRepository requests, RequestEventRepository events,
      RequestUpdater updater) {
    this.camunda = camunda;
    this.requests = requests;
    this.events = events;
    this.updater = updater;
  }

  /**
   * @param withProcessDetail true only for the exam cell's Process View: includes the BPMN element
   *     instances. Students and other roles get the stages, subjects and activity log only.
   */
  public StatusView status(RevaluationRequest current, boolean withProcessDetail) {
    RevaluationRequest r = current;
    List<ElementInstance> elements = List.of();
    boolean live = false;
    if (r.getProcessInstanceKey() != null) {
      try {
        elements = camunda.elements(r.getProcessInstanceKey());
        live = true;
      } catch (Exception e) {
        // Search data can lag a moment behind the engine, or the engine may be unreachable.
        LOG.warn("Could not read element instances for {}: {}", r.getId(), e.getMessage());
      }
    }
    if (live && syncStatus(r, elements)) r = requests.findById(r.getId()).orElse(r);

    List<ElementState> elementStates = !withProcessDetail ? List.of() : elements.stream()
        .map(e -> new ElementState(e.getElementId(), e.getElementName(), String.valueOf(e.getType()),
            String.valueOf(e.getState()), Boolean.TRUE.equals(e.getIncident())))
        .toList();
    int incidents = (int) elements.stream().filter(e -> Boolean.TRUE.equals(e.getIncident())).count();

    return new StatusView(r.getId(), r.getStatus().name(), live, stages(r, elements), elementStates,
        r.getSubjects().stream().map(Views::subject).toList(),
        events.findByRequestIdOrderByOccurredAtDescIdDesc(r.getId()).stream()
            .map(ev -> new EventView(ev.getOccurredAt(), ev.getMessage())).toList(),
        incidents, OffsetDateTime.now());
  }

  /** Returns true when the stored status changed. */
  private boolean syncStatus(RevaluationRequest r, List<ElementInstance> elements) {
    RequestStatus next = null;
    if (completed(elements, REQUEST_COMPLETED)) next = RequestStatus.COMPLETED;
    else if (completed(elements, REQUEST_REJECTED)) next = RequestStatus.REJECTED;
    else if (completed(elements, CLOSED_PAYMENT_FAILED)) {
      next = present(elements, PAYMENT_WINDOW_EXPIRED) ? RequestStatus.CLOSED_UNPAID : RequestStatus.CLOSED_PAYMENT_FAILED;
    }
    if (next == null) {
      for (ElementInstance e : elements) {
        if (e.getState() == ElementInstanceState.ACTIVE && ACTIVE_STATUS.containsKey(e.getElementId())) {
          next = ACTIVE_STATUS.get(e.getElementId());
        }
      }
    }
    if (next == null || next == r.getStatus()) return false;
    String reason = next == RequestStatus.REJECTED && r.getRejectionReason() == null
        ? camunda.processVariable(r.getProcessInstanceKey(), "rejectionReason").map(String::valueOf).orElse(null)
        : null;
    RequestStatus finalNext = next;
    updater.update(r.getId(), x -> {
      x.setStatus(finalNext);
      if (reason != null) x.setRejectionReason(reason);
    });
    return true;
  }

  /** The eight stages of the tracker, following the five lanes of the BPMN diagram. */
  List<Stage> stages(RevaluationRequest r, List<ElementInstance> elements) {
    List<Stage> out = new ArrayList<>();
    out.add(new Stage("submitted", "Submitted", completed(elements, SUBMIT_REQUEST) || elements.isEmpty() ? "done" : "active",
        r.getCreatedAt()));
    out.add(stage("verified", "Verified by exam cell", elements, VERIFY_APPLICATION));
    // The gateway said yes as soon as the Razorpay order step started.
    out.add(present(elements, CREATE_ORDER) ? done("eligible", "Eligible", start(elements, CREATE_ORDER))
        : stage("eligible", "Eligible", elements, EVALUATE_ELIGIBILITY));
    out.add(present(elements, ASSIGN_EXAMINER) ? done("paid", "Paid", start(elements, ASSIGN_EXAMINER))
        : stage("paid", "Paid", elements, CREATE_ORDER, CHECKOUT));
    out.add(completed(elements, EXAMINER_MARKS) && !active(elements, EXAMINATION.toArray(String[]::new))
        ? done("revaluation", "Revaluation", end(elements, EXAMINER_MARKS))
        : stage("revaluation", "Revaluation", elements, EXAMINATION.toArray(String[]::new)));
    out.add(stage("compared", "Marks compared", elements, EVALUATE_MARKS));
    // CoE approval only happens when marks increased; otherwise the stage is skipped.
    Stage approval = stage("approved", "CoE approval", elements, COE_APPROVAL);
    if (approval.state().equals("pending") && (present(elements, NOTIFY_RESULT) || completed(elements, REQUEST_COMPLETED))) {
      approval = new Stage("approved", "CoE approval", "skipped", null);
    }
    out.add(approval);
    out.add(completed(elements, REQUEST_COMPLETED) ? done("published", "Result published", end(elements, REQUEST_COMPLETED))
        : stage("published", "Result published", elements, UPDATE_RESULT, NOTIFY_RESULT));

    // An ending that stops the request early marks the stage where it stopped.
    RequestStatus s = r.getStatus();
    if (s == RequestStatus.REJECTED || s == RequestStatus.CLOSED_UNPAID || s == RequestStatus.CLOSED_PAYMENT_FAILED) {
      String stopAt = s == RequestStatus.REJECTED ? "eligible" : "paid";
      for (int i = 0; i < out.size(); i++) {
        Stage st = out.get(i);
        if (st.key().equals(stopAt)) out.set(i, new Stage(st.key(), st.label(), "stopped", st.at()));
        else if (!st.state().equals("done") && !st.state().equals("stopped")) out.set(i, new Stage(st.key(), st.label(), "skipped", null));
      }
    }
    return out;
  }

  /**
   * State across every instance of the given elements (a multi-instance task has one per subject):
   * active while any instance runs, done once all have completed.
   */
  private Stage stage(String key, String label, List<ElementInstance> elements, String... elementIds) {
    List<ElementInstance> mine = of(elements, elementIds);
    if (mine.isEmpty()) return new Stage(key, label, "pending", null);
    Optional<ElementInstance> running = mine.stream().filter(e -> e.getState() == ElementInstanceState.ACTIVE).findFirst();
    if (running.isPresent()) {
      boolean incident = mine.stream().anyMatch(e -> Boolean.TRUE.equals(e.getIncident()));
      return new Stage(key, label, incident ? "incident" : "active", running.get().getStartDate());
    }
    if (mine.stream().anyMatch(e -> e.getState() == ElementInstanceState.COMPLETED)) {
      return new Stage(key, label, "done", latestEnd(mine));
    }
    return new Stage(key, label, "stopped", latestEnd(mine));
  }

  private static Stage done(String key, String label, OffsetDateTime at) {
    return new Stage(key, label, "done", at);
  }

  private static List<ElementInstance> of(List<ElementInstance> elements, String... ids) {
    Set<String> wanted = Set.of(ids);
    return elements.stream().filter(e -> wanted.contains(e.getElementId())).toList();
  }

  private static boolean present(List<ElementInstance> elements, String id) {
    return !of(elements, id).isEmpty();
  }

  private static boolean active(List<ElementInstance> elements, String... ids) {
    return of(elements, ids).stream().anyMatch(e -> e.getState() == ElementInstanceState.ACTIVE);
  }

  private static boolean completed(List<ElementInstance> elements, String id) {
    List<ElementInstance> mine = of(elements, id);
    return !mine.isEmpty() && mine.stream().allMatch(e -> e.getState() == ElementInstanceState.COMPLETED);
  }

  private static OffsetDateTime start(List<ElementInstance> elements, String id) {
    return of(elements, id).stream().map(ElementInstance::getStartDate).filter(Objects::nonNull).min(Comparator.naturalOrder()).orElse(null);
  }

  private static OffsetDateTime end(List<ElementInstance> elements, String id) {
    return latestEnd(of(elements, id));
  }

  private static OffsetDateTime latestEnd(List<ElementInstance> mine) {
    return mine.stream().map(ElementInstance::getEndDate).filter(Objects::nonNull).max(Comparator.naturalOrder()).orElse(null);
  }
}
