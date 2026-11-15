package edu.revaluation.worker;

import edu.revaluation.domain.RequestStatus;
import edu.revaluation.service.EventLog;
import edu.revaluation.service.RequestUpdater;
import edu.revaluation.worker.WorkerVariables.*;
import io.camunda.client.annotation.JobWorker;
import io.camunda.client.annotation.VariablesAsType;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Start execution listener on "Notify: Revaluation Result Published". Saves the per-subject results
 * collected by the "Evaluate Marks Difference" multi-instance into the database, so the student sees
 * the published marks. It runs on both gateway branches and is idempotent.
 */
@Component
public class ConsolidateResultsWorker {
  private final RequestUpdater updater;
  private final EventLog events;

  public ConsolidateResultsWorker(RequestUpdater updater, EventLog events) {
    this.updater = updater;
    this.events = events;
  }

  @JobWorker(type = "consolidate-results")
  public void consolidate(@VariablesAsType ConsolidateInput in) {
    int increased = (int) in.subjectResults().stream().filter(x -> Boolean.TRUE.equals(x.get("marksIncreased"))).count();
    updater.update(in.requestId(), request -> {
      for (Map<String, Object> result : in.subjectResults()) {
        var s = request.subject(String.valueOf(result.get("subjectCode")));
        if (s == null) continue;
        Object revised = result.get("revisedMarks");
        if (revised instanceof Number n) s.setRevisedMarks(n.intValue());
        String outcome = String.valueOf(result.getOrDefault("outcome", "UNCHANGED"));
        s.setOutcome(outcome);
        s.setStage(switch (outcome) {
          case "REVISED" -> "Marks increased";
          case "WITHHELD" -> "Increase not approved: original marks stand";
          default -> "Marks unchanged";
        });
      }
      request.setStatus(RequestStatus.RESULTS_READY);
    });
    events.record(in.requestId(), "Revaluation result published; " + increased + " of " + in.subjectResults().size() + " subject(s) increased.");
  }
}
