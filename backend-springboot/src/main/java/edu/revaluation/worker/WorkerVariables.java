package edu.revaluation.worker;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;
import java.util.Map;

/** Strongly typed views of the process variables each job worker reads. */
public final class WorkerVariables {
  private WorkerVariables() {}

  // consolidate-results (start execution listener on "Notify: Revaluation Result Published")
  @JsonIgnoreProperties(ignoreUnknown = true)
  public record ConsolidateInput(String requestId, List<Map<String, Object>> subjectResults) {}
}
