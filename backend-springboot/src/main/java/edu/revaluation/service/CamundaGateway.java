package edu.revaluation.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.camunda.client.CamundaClient;
import io.camunda.client.api.search.enums.UserTaskState;
import io.camunda.client.api.search.response.ElementInstance;
import io.camunda.client.api.search.response.ProcessDefinition;
import io.camunda.client.api.search.response.ProcessInstance;
import io.camunda.client.api.statistics.response.ProcessElementStatistics;
import io.camunda.client.api.search.response.UserTask;
import io.camunda.client.api.search.response.Variable;
import java.util.*;
import org.springframework.stereotype.Service;

/**
 * Every call from Spring Boot to the Camunda 8 Orchestration Cluster goes through this class
 * (CamundaClient wraps the Zeebe gRPC API and the v2 REST API). The browser never talks to Camunda.
 */
@Service
public class CamundaGateway {
  public static final String MAIN_PROCESS = "revaluationProcess";

  private final CamundaClient client;
  private final ObjectMapper json;

  public CamundaGateway(CamundaClient client, ObjectMapper json) {
    this.client = client;
    this.json = json;
  }

  public long startRevaluation(Map<String, Object> variables) {
    return client.newCreateInstanceCommand()
        .bpmnProcessId(MAIN_PROCESS)
        .latestVersion()
        .variables(variables)
        .send()
        .join()
        .getProcessInstanceKey();
  }

  public List<UserTask> tasksAssignedTo(String username, UserTaskState state, int limit) {
    return client.newUserTaskSearchRequest()
        .filter(f -> f.assignee(username).state(state))
        .page(p -> p.limit(limit))
        .send().join().items();
  }

  public List<UserTask> tasksForGroup(String group) {
    return client.newUserTaskSearchRequest()
        .filter(f -> f.candidateGroup(group).state(UserTaskState.CREATED))
        .page(p -> p.limit(100))
        .send().join().items();
  }

  public Optional<UserTask> openTask(long processInstanceKey, String elementId) {
    return client.newUserTaskSearchRequest()
        .filter(f -> f.processInstanceKey(processInstanceKey).elementId(elementId).state(UserTaskState.CREATED))
        .send().join().items().stream().findFirst();
  }

  public UserTask task(long key) {
    return client.newUserTaskGetRequest(key).send().join();
  }

  /** Variables visible from the task's scope (its own, its sub-process and its process instance). */
  public Map<String, Object> taskVariables(long key) {
    List<Variable> vars = client.newUserTaskEffectiveVariableSearchRequest(key).page(p -> p.limit(200)).send().join().items();
    Map<String, Object> out = new LinkedHashMap<>();
    for (Variable v : vars) out.putIfAbsent(v.getName(), parse(v.getValue()));
    return out;
  }

  public void claim(long key, String username) {
    client.newAssignUserTaskCommand(key).assignee(username).allowOverride(false).send().join();
  }

  public void unclaim(long key) {
    client.newUnassignUserTaskCommand(key).send().join();
  }

  public void complete(long key, Map<String, Object> variables) {
    client.newCompleteUserTaskCommand(key).variables(variables).send().join();
  }

  public Optional<Object> processVariable(long processInstanceKey, String name) {
    return client.newVariableSearchRequest()
        .filter(f -> f.processInstanceKey(processInstanceKey).name(name))
        .send().join().items().stream()
        .filter(v -> Objects.equals(v.getScopeKey(), processInstanceKey))
        .findFirst().map(v -> parse(v.getValue()));
  }

  public ProcessInstance processInstance(long key) {
    return client.newProcessInstanceGetRequest(key).send().join();
  }

  public List<ElementInstance> elements(long processInstanceKey) {
    return client.newElementInstanceSearchRequest()
        .filter(f -> f.processInstanceKey(processInstanceKey))
        .page(p -> p.limit(200))
        .send().join().items();
  }

  public String processXml(long processDefinitionKey) {
    return client.newProcessDefinitionGetXmlRequest(processDefinitionKey).send().join();
  }

  // ---- Process View (exam cell) ----------------------------------------------------------------

  /** The latest deployed version of revaluationProcess. */
  public Optional<ProcessDefinition> latestDefinition() {
    return client.newProcessDefinitionSearchRequest()
        .filter(f -> f.processDefinitionId(MAIN_PROCESS).isLatestVersion(true))
        .send().join().items().stream().findFirst();
  }

  /** Active, completed, canceled and incident counts per BPMN element of one process version. */
  public List<ProcessElementStatistics> elementStatistics(long processDefinitionKey) {
    return client.newProcessDefinitionElementStatisticsRequest(processDefinitionKey).send().join();
  }

  /** Every open user task of revaluationProcess, whoever it belongs to. */
  public List<UserTask> openTasksOfProcess() {
    return client.newUserTaskSearchRequest()
        .filter(f -> f.bpmnProcessId(MAIN_PROCESS).state(UserTaskState.CREATED))
        .page(p -> p.limit(500))
        .send().join().items();
  }

  /** All user tasks (open and completed) of one process instance. */
  public List<UserTask> tasksOfInstance(long processInstanceKey) {
    return client.newUserTaskSearchRequest()
        .filter(f -> f.processInstanceKey(processInstanceKey))
        .page(p -> p.limit(200))
        .send().join().items();
  }

  /**
   * Subject code per task: each examination task is a multi-instance whose local "subject" variable
   * lives in the task's own element instance scope.
   */
  public Map<Long, String> subjectCodeByScope(Collection<Long> elementInstanceKeys) {
    if (elementInstanceKeys.isEmpty()) return Map.of();
    List<Long> keys = List.copyOf(elementInstanceKeys);
    Map<Long, String> out = new HashMap<>();
    client.newVariableSearchRequest()
        .filter(f -> f.name("subject").scopeKey(p -> p.in(keys)))
        .page(p -> p.limit(Math.max(keys.size(), 1)))
        .send().join().items()
        .forEach(v -> {
          if (parse(v.getValue()) instanceof Map<?, ?> m && m.get("subjectCode") != null) {
            out.put(v.getScopeKey(), String.valueOf(m.get("subjectCode")));
          }
        });
    return out;
  }

  private Object parse(String value) {
    if (value == null) return null;
    try {
      return json.readValue(value, new TypeReference<Object>() {});
    } catch (Exception e) {
      return value;
    }
  }
}
