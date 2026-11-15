package edu.revaluation.repository;

import edu.revaluation.domain.ExamSession;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExamSessionRepository extends JpaRepository<ExamSession, String> {}
