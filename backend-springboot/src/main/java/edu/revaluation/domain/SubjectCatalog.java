package edu.revaluation.domain;

import jakarta.persistence.*;

@Entity
@Table(name = "subject_catalog")
public class SubjectCatalog {
  @Id private String code;
  private String name;
  private String department;
  private int maxMarks;

  /** False for a subject whose scanned script is missing, to demo the SCRIPT_NOT_FOUND path. */
  private boolean scriptAvailable;

  /** Examiner who did the first evaluation; never chosen again for revaluation. */
  private String firstEvaluator;

  protected SubjectCatalog() {}

  public String getCode() { return code; }
  public String getName() { return name; }
  public String getDepartment() { return department; }
  public int getMaxMarks() { return maxMarks; }
  public boolean isScriptAvailable() { return scriptAvailable; }
  public String getFirstEvaluator() { return firstEvaluator; }
}
