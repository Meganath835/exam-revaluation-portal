package edu.revaluation.repository;

import edu.revaluation.domain.RequestStatus;
import edu.revaluation.domain.RevaluationRequest;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface RevaluationRequestRepository extends JpaRepository<RevaluationRequest, String> {
  List<RevaluationRequest> findByStudentUsernameOrderByCreatedAtDesc(String username);

  List<RevaluationRequest> findAllByOrderByCreatedAtDesc();

  boolean existsByStudentUsernameAndExamSessionAndStatusNotIn(
      String username, String examSession, Collection<RequestStatus> statuses);

  @Modifying
  @Query("update RevaluationRequest r set r.processInstanceKey = ?2 where r.id = ?1")
  int setProcessInstanceKey(String id, long processInstanceKey);

  @Query(value = "select nextval('request_seq')", nativeQuery = true)
  long nextSequence();
}
