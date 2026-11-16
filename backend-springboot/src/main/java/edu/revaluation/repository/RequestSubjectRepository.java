package edu.revaluation.repository;

import edu.revaluation.domain.RequestSubject;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface RequestSubjectRepository extends JpaRepository<RequestSubject, Long> {
  /** Open revaluation assignments per examiner (as either of a subject's two examiners), used to spread work evenly. */
  @Query("select count(s) from RequestSubject s where (s.examinerId = ?1 or s.secondExaminerId = ?1) and s.outcome is null")
  long countOpenAssignments(String examinerId);
}
