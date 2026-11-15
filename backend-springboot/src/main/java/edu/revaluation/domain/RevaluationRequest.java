package edu.revaluation.domain;

import jakarta.persistence.*;
import org.hibernate.annotations.DynamicUpdate;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/* Only changed columns are written, so parallel job workers don't overwrite each other. */
@Entity
@DynamicUpdate
@Table(name = "revaluation_request")
public class RevaluationRequest {
  @Id private String id;

  @ManyToOne(optional = false, fetch = FetchType.EAGER)
  @JoinColumn(name = "student_id")
  private AppUser student;

  private String examSession;
  private LocalDate resultPublishedOn;

  @Enumerated(EnumType.STRING)
  private RequestStatus status;

  private Long processInstanceKey;
  private int feePerSubjectPaise;
  private int totalFeePaise;
  private String rejectionReason;
  private OffsetDateTime createdAt;
  private OffsetDateTime updatedAt;

  @OneToMany(mappedBy = "request", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
  @OrderBy("id")
  private List<RequestSubject> subjects = new ArrayList<>();

  protected RevaluationRequest() {}

  public RevaluationRequest(String id, AppUser student, ExamSession session, int feePerSubjectPaise) {
    this.id = id;
    this.student = student;
    this.examSession = session.getCode();
    this.resultPublishedOn = session.getResultPublishedOn();
    this.feePerSubjectPaise = feePerSubjectPaise;
    this.status = RequestStatus.SUBMITTED;
    this.createdAt = OffsetDateTime.now();
    this.updatedAt = createdAt;
  }

  public void addSubject(RequestSubject subject) {
    subject.setRequest(this);
    subjects.add(subject);
    totalFeePaise = subjects.size() * feePerSubjectPaise;
  }

  public RequestSubject subject(String code) {
    return subjects.stream().filter(s -> s.getSubjectCode().equals(code)).findFirst().orElse(null);
  }

  public void setStatus(RequestStatus status) {
    this.status = status;
    this.updatedAt = OffsetDateTime.now();
  }

  public String getId() { return id; }
  public AppUser getStudent() { return student; }
  public String getExamSession() { return examSession; }
  public LocalDate getResultPublishedOn() { return resultPublishedOn; }
  public RequestStatus getStatus() { return status; }
  public Long getProcessInstanceKey() { return processInstanceKey; }
  public void setProcessInstanceKey(Long key) { this.processInstanceKey = key; }
  public int getFeePerSubjectPaise() { return feePerSubjectPaise; }
  public int getTotalFeePaise() { return totalFeePaise; }
  public String getRejectionReason() { return rejectionReason; }
  public void setRejectionReason(String reason) { this.rejectionReason = reason; }
  public OffsetDateTime getCreatedAt() { return createdAt; }
  public OffsetDateTime getUpdatedAt() { return updatedAt; }
  public List<RequestSubject> getSubjects() { return subjects; }
}
