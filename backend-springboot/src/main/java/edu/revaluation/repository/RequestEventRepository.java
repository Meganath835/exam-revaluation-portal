package edu.revaluation.repository;

import edu.revaluation.domain.RequestEvent;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RequestEventRepository extends JpaRepository<RequestEvent, Long> {
  List<RequestEvent> findByRequestIdOrderByOccurredAtDescIdDesc(String requestId);
}
