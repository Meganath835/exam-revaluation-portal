package edu.revaluation.service;

import edu.revaluation.domain.RequestSubject;
import edu.revaluation.domain.RevaluationRequest;
import edu.revaluation.repository.RevaluationRequestRepository;
import java.util.function.Consumer;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Applies a change to a request inside one short transaction. The entity is managed, so Hibernate
 * writes only the columns that changed (@DynamicUpdate): parallel job workers working on different
 * subjects of the same request never overwrite each other's data.
 */
@Service
public class RequestUpdater {
  private final RevaluationRequestRepository requests;

  public RequestUpdater(RevaluationRequestRepository requests) {
    this.requests = requests;
  }

  @Transactional
  public void update(String requestId, Consumer<RevaluationRequest> change) {
    RevaluationRequest r = requests.findById(requestId)
        .orElseThrow(() -> new IllegalStateException("Request " + requestId + " is not in the database"));
    change.accept(r);
  }

  @Transactional
  public void updateSubject(String requestId, String subjectCode, Consumer<RequestSubject> change) {
    update(requestId, r -> {
      RequestSubject s = r.subject(subjectCode);
      if (s != null) change.accept(s);
    });
  }
}
