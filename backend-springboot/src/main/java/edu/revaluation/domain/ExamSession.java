package edu.revaluation.domain;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "exam_session")
public class ExamSession {
  @Id private String code;
  private String name;
  private LocalDate resultPublishedOn;

  protected ExamSession() {}

  public String getCode() { return code; }
  public String getName() { return name; }
  public LocalDate getResultPublishedOn() { return resultPublishedOn; }
}
