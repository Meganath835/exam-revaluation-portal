package edu.revaluation.service;

import edu.revaluation.domain.AppUser;
import edu.revaluation.domain.Role;
import edu.revaluation.domain.SubjectCatalog;
import edu.revaluation.repository.AppUserRepository;
import edu.revaluation.repository.RequestSubjectRepository;
import edu.revaluation.repository.SubjectCatalogRepository;
import java.util.*;
import org.springframework.stereotype.Service;

/**
 * Rules for the exam cell's examiner assignments. An independent examiner is from the subject's
 * department and is never the examiner who did the first evaluation (nor, for the second
 * assignment, the first revaluation examiner). The suggestion is the least busy such examiner.
 */
@Service
public class ExaminerAssignment {
  private final AppUserRepository users;
  private final SubjectCatalogRepository catalog;
  private final RequestSubjectRepository subjects;

  public ExaminerAssignment(AppUserRepository users, SubjectCatalogRepository catalog, RequestSubjectRepository subjects) {
    this.users = users;
    this.catalog = catalog;
    this.subjects = subjects;
  }

  /** Who did the first evaluation of this subject, or null when unknown. */
  public String firstEvaluator(String subjectCode) {
    return catalog.findById(subjectCode).map(SubjectCatalog::getFirstEvaluator).orElse(null);
  }

  public List<AppUser> independentExaminers(String subjectCode, String department, Collection<String> alsoExclude) {
    String first = firstEvaluator(subjectCode);
    return users.findByRoleAndDepartmentOrderByUsername(Role.EXAMINER, department).stream()
        .filter(u -> !u.getUsername().equals(first))
        .filter(u -> !alsoExclude.contains(u.getUsername()))
        .toList();
  }

  public Optional<AppUser> suggest(String subjectCode, String department, Collection<String> alsoExclude) {
    return independentExaminers(subjectCode, department, alsoExclude).stream()
        .min(Comparator.comparingLong(u -> subjects.countOpenAssignments(u.getUsername())));
  }

  /** Returns an error message when the examiner may not take this subject, otherwise null. */
  public String problemWith(String examinerId, String subjectCode, String department, Collection<String> alsoExclude) {
    if (examinerId == null || examinerId.isBlank()) return "Choose an examiner.";
    Optional<AppUser> u = users.findById(examinerId);
    if (u.isEmpty() || u.get().getRole() != Role.EXAMINER) return examinerId + " is not an examiner.";
    if (!Objects.equals(u.get().getDepartment(), department)) return examinerId + " is not from the " + department + " department.";
    if (examinerId.equals(firstEvaluator(subjectCode))) return examinerId + " did the first evaluation, so is not independent.";
    if (alsoExclude.contains(examinerId)) return examinerId + " already revalued this script; choose a different examiner.";
    return null;
  }

  /**
   * The scanned answer script in the archive (the subject catalog in this demo), or empty when no
   * scan exists and the exam cell has to retrieve the physical script.
   */
  public Optional<String> archivedScriptId(String studentId, String subjectCode) {
    return catalog.findById(subjectCode)
        .filter(SubjectCatalog::isScriptAvailable)
        .map(c -> "SCR-" + Integer.toHexString((studentId + subjectCode).hashCode()).toUpperCase());
  }
}
