package edu.revaluation.service;

import edu.revaluation.domain.RequestStatus;
import edu.revaluation.domain.RevaluationRequest;
import edu.revaluation.dto.Dtos.*;
import edu.revaluation.repository.RevaluationRequestRepository;
import io.camunda.client.api.search.enums.UserTaskState;
import io.camunda.client.api.search.response.ProcessDefinition;
import io.camunda.client.api.search.response.UserTask;
import java.time.OffsetDateTime;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * The exam cell's Process View: live workflow data read from Camunda (deployed model, per-element
 * statistics, element instances and user tasks), joined with the requests in the database.
 * Every caller has already been checked with {@link CurrentUserService#requireProcessViewer}.
 */
@Service
public class ProcessViewService {
  private static final Logger LOG = LoggerFactory.getLogger(ProcessViewService.class);
  private static final int MAX_ROWS = 100;
  private static final Set<String> STEP_TYPES = Set.of("USER_TASK", "SERVICE_TASK", "BUSINESS_RULE_TASK", "SEND_TASK");

  private final CamundaGateway camunda;
  private final RevaluationRequestRepository requests;
  private final StatusService status;

  public ProcessViewService(CamundaGateway camunda, RevaluationRequestRepository requests, StatusService status) {
    this.camunda = camunda;
    this.requests = requests;
    this.status = status;
  }

  /** The latest deployed BPMN of revaluationProcess. */
  public String definitionXml() {
    ProcessDefinition def = camunda.latestDefinition()
        .orElseThrow(() -> new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "revaluationProcess is not deployed yet."));
    return camunda.processXml(def.getProcessDefinitionKey());
  }

  public ProcessOverview overview() {
    Optional<ProcessDefinition> def = camunda.latestDefinition();
    List<ElementCount> counts = def.map(d -> camunda.elementStatistics(d.getProcessDefinitionKey()).stream()
            .map(s -> new ElementCount(s.getElementId(), n(s.getActive()), n(s.getCompleted()), n(s.getCanceled()), n(s.getIncidents())))
            .toList())
        .orElse(List.of());

    List<UserTask> open = camunda.openTasksOfProcess();
    Map<Long, String> subjectCodes = camunda.subjectCodeByScope(open.stream().map(UserTask::getElementInstanceKey).filter(Objects::nonNull).toList());
    Map<Long, List<ProcessTaskView>> openByInstance = new HashMap<>();
    for (UserTask t : open) openByInstance.computeIfAbsent(t.getProcessInstanceKey(), k -> new ArrayList<>()).add(task(t, subjectCodes));

    List<ProcessInstanceRow> rows = new ArrayList<>();
    for (RevaluationRequest r : requests.findAllByOrderByCreatedAtDesc().stream().limit(MAX_ROWS).toList()) {
      rows.add(row(r, openByInstance.getOrDefault(r.getProcessInstanceKey(), List.of())));
    }

    Map<String, Long> totals = new LinkedHashMap<>();
    totals.put("running", rows.stream().filter(x -> !RequestStatus.valueOf(x.status()).isTerminal()).count());
    totals.put("waitingForExamCell", open.stream().filter(t -> t.getCandidateGroups() != null && t.getCandidateGroups().contains("exam-cell")).count());
    totals.put("waitingForApproval", open.stream().filter(t -> ProcessElements.COE_APPROVAL.equals(t.getElementId())).count());
    totals.put("withExaminers", open.stream().filter(t -> ProcessElements.EXAMINER_TASKS.contains(t.getElementId())).count());
    totals.put("waitingForStudents", open.stream().filter(t -> ProcessElements.SUBMIT_REQUEST.equals(t.getElementId())
        || ProcessElements.CHECKOUT.equals(t.getElementId())).count());
    totals.put("completed", rows.stream().filter(x -> RequestStatus.COMPLETED.name().equals(x.status())).count());
    totals.put("closed", rows.stream().filter(x -> RequestStatus.valueOf(x.status()).isTerminal()
        && !RequestStatus.COMPLETED.name().equals(x.status())).count());
    totals.put("incidents", rows.stream().filter(x -> x.incidents() > 0).count());

    return new ProcessOverview(CamundaGateway.MAIN_PROCESS, def.map(ProcessDefinition::getName).orElse(null),
        def.map(ProcessDefinition::getVersion).orElse(null), def.map(ProcessDefinition::getProcessDefinitionKey).orElse(null),
        totals, counts, rows, OffsetDateTime.now());
  }

  /** Element states and every user task (pending and completed) of one request's process instance. */
  public ProcessInstanceDetail instance(RevaluationRequest r) {
    if (r.getProcessInstanceKey() == null) throw ApiException.notFound("Process for " + r.getId());
    StatusView s = status.status(r, true);
    List<UserTask> tasks = camunda.tasksOfInstance(r.getProcessInstanceKey());
    Map<Long, String> subjectCodes = camunda.subjectCodeByScope(tasks.stream().map(UserTask::getElementInstanceKey).filter(Objects::nonNull).toList());
    List<ProcessTaskView> views = tasks.stream()
        .sorted(Comparator.comparing(UserTask::getCreationDate, Comparator.nullsLast(Comparator.naturalOrder())))
        .map(t -> task(t, subjectCodes))
        .toList();
    return new ProcessInstanceDetail(r.getId(), r.getProcessInstanceKey(), s.elements(), views, s.incidents());
  }

  // ---------------------------------------------------------------------------------------------

  private ProcessInstanceRow row(RevaluationRequest r, List<ProcessTaskView> openTasks) {
    List<Stage> stages = List.of();
    List<String> steps = List.of();
    boolean live = false;
    int incidents = 0;
    String state = r.getStatus().name();
    // Finished requests don't change any more: only running ones are read live from Camunda.
    if (r.getProcessInstanceKey() != null && !r.getStatus().isTerminal()) {
      try {
        StatusView s = status.status(r, true);
        state = s.status();
        stages = s.stages();
        live = s.live();
        incidents = s.incidents();
        steps = s.elements().stream()
            .filter(e -> "ACTIVE".equals(e.state()) && STEP_TYPES.contains(e.type()))
            .map(ElementState::name).distinct().toList();
      } catch (RuntimeException e) {
        LOG.warn("Process view could not read {}: {}", r.getId(), e.getMessage());
      }
    }
    return new ProcessInstanceRow(r.getId(), r.getStudent().getUsername(), r.getStudent().getDisplayName(), r.getExamSession(),
        state, r.getSubjects().size(), r.getProcessInstanceKey(), live, stages, steps, openTasks, incidents,
        r.getCreatedAt(), r.getUpdatedAt());
  }

  private static ProcessTaskView task(UserTask t, Map<Long, String> subjectCodes) {
    return new ProcessTaskView(t.getUserTaskKey(), t.getElementId(), t.getName(),
        t.getState() == UserTaskState.CREATED ? "OPEN" : String.valueOf(t.getState()), t.getAssignee(),
        t.getCandidateGroups() == null ? List.of() : t.getCandidateGroups(), subjectCodes.get(t.getElementInstanceKey()),
        t.getCreationDate(), t.getCompletionDate(), t.getDueDate());
  }

  private static long n(Long v) {
    return v == null ? 0 : v;
  }
}
