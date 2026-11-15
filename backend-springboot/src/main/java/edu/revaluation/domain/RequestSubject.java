package edu.revaluation.domain;

import jakarta.persistence.*;
import org.hibernate.annotations.DynamicUpdate;

/* Only changed columns are written, so parallel job workers don't overwrite each other. */
@Entity
@DynamicUpdate
@Table(name = "request_subject")
public class RequestSubject {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(optional = false)
  @JoinColumn(name = "request_id")
  private RevaluationRequest request;

  private String subjectCode;
  private String subjectName;
  private String department;
  private int originalMarks;
  private int maxMarks;
  private Integer revisedMarks;
  private String outcome;
  private String examinerId;
  private String scriptId;

  /** Short, human-readable stage shown in the status tracker. */
  private String stage;

  protected RequestSubject() {}

  public RequestSubject(SubjectCatalog catalog, int originalMarks) {
    this.subjectCode = catalog.getCode();
    this.subjectName = catalog.getName();
    this.department = catalog.getDepartment();
    this.maxMarks = catalog.getMaxMarks();
    this.originalMarks = originalMarks;
    this.stage = "Waiting for verification";
  }

  void setRequest(RevaluationRequest request) { this.request = request; }

  public Long getId() { return id; }
  public String getSubjectCode() { return subjectCode; }
  public String getSubjectName() { return subjectName; }
  public String getDepartment() { return department; }
  public int getOriginalMarks() { return originalMarks; }
  public int getMaxMarks() { return maxMarks; }
  public Integer getRevisedMarks() { return revisedMarks; }
  public void setRevisedMarks(Integer revisedMarks) { this.revisedMarks = revisedMarks; }
  public String getOutcome() { return outcome; }
  public void setOutcome(String outcome) { this.outcome = outcome; }
  public String getExaminerId() { return examinerId; }
  public void setExaminerId(String examinerId) { this.examinerId = examinerId; }
  public String getScriptId() { return scriptId; }
  public void setScriptId(String scriptId) { this.scriptId = scriptId; }
  public String getStage() { return stage; }
  public void setStage(String stage) { this.stage = stage; }
}
