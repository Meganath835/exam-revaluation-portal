package edu.revaluation.domain;

import jakarta.persistence.*;
import java.util.Arrays;
import java.util.List;

/** Demo user. Students, staff and examiners share one table; the role decides what they can do. */
@Entity
@Table(name = "app_user")
public class AppUser {
  @Id private String username;
  private String displayName;
  private String email;

  @Enumerated(EnumType.STRING)
  private Role role;

  private String department;

  /** Comma-separated Camunda candidate groups, for example "exam-cell". */
  private String candidateGroups;

  protected AppUser() {}

  public String getUsername() { return username; }
  public String getDisplayName() { return displayName; }
  public String getEmail() { return email; }
  public Role getRole() { return role; }
  public String getDepartment() { return department; }

  public List<String> getGroups() {
    if (candidateGroups == null || candidateGroups.isBlank()) return List.of();
    return Arrays.stream(candidateGroups.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
  }
}
