package edu.revaluation.service;

import edu.revaluation.domain.AppUser;
import edu.revaluation.domain.RequestSubject;
import edu.revaluation.domain.RevaluationRequest;
import edu.revaluation.dto.Dtos.*;
import java.time.LocalDate;
import java.time.Period;

/** Maps entities to API views. */
public final class Views {
  private Views() {}

  public static SubjectView subject(RequestSubject s) {
    return new SubjectView(s.getSubjectCode(), s.getSubjectName(), s.getOriginalMarks(), s.getMaxMarks(),
        s.getRevisedMarks(), s.getOutcome(), s.getStage());
  }

  public static RequestSummary summary(RevaluationRequest r) {
    return new RequestSummary(r.getId(), r.getStudent().getUsername(), r.getStudent().getDisplayName(),
        r.getStudent().getDepartment(), r.getExamSession(), r.getStatus().name(), r.getSubjects().size(),
        r.getTotalFeePaise(), r.getCreatedAt(), r.getUpdatedAt());
  }

  public static RequestDetail detail(RevaluationRequest r, String window) {
    AppUser s = r.getStudent();
    return new RequestDetail(r.getId(), s.getUsername(), s.getDisplayName(), s.getEmail(), s.getDepartment(),
        r.getExamSession(), r.getResultPublishedOn(), windowCloses(r.getResultPublishedOn(), window),
        r.getStatus().name(), r.getRejectionReason(), r.getFeePerSubjectPaise(), r.getTotalFeePaise(),
        r.getProcessInstanceKey(), r.getCreatedAt(), r.getSubjects().stream().map(Views::subject).toList());
  }

  public static LocalDate windowCloses(LocalDate published, String window) {
    return published.plus(Period.parse(window));
  }

  public static UserView user(AppUser u) {
    return new UserView(u.getUsername(), u.getDisplayName(), u.getEmail(), u.getRole().name(), u.getDepartment(), u.getGroups());
  }
}
