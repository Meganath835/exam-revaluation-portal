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
 * Rules for the exam cell's examiner assignments. Every subject gets two independent examiners:
 * both from the subject's department, neither the examiner who did the first evaluation, and not
 * the same person twice. The suggestions are the least busy such examiners.
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

  /** The independent examiners of a subject, least busy first. */
  public List<AppUser> suggestions(String subjectCode, String department) {
    return independentExaminers(subjectCode, department, List.of()).stream()
        .sorted(Comparator.comparingLong(u -> subjects.countOpenAssignments(u.getUsername())))
        .toList();
  }

  /** Returns an error message when the examiner may not take this subject, otherwise null. */
  public String problemWith(String examinerId, String subjectCode, String department, Collection<String> alsoExclude) {
    if (examinerId == null || examinerId.isBlank()) return "Choose an examiner.";
    Optional<AppUser> u = users.findById(examinerId);
    if (u.isEmpty() || u.get().getRole() != Role.EXAMINER) return examinerId + " is not an examiner.";
    if (!Objects.equals(u.get().getDepartment(), department)) return examinerId + " is not from the " + department + " department.";
    if (examinerId.equals(firstEvaluator(subjectCode))) return examinerId + " did the first evaluation, so is not independent.";
    if (alsoExclude.contains(examinerId)) return examinerId + " is already the other examiner of this script; choose two different examiners.";
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
