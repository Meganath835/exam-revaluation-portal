package edu.revaluation.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import edu.revaluation.domain.AppUser;
import edu.revaluation.domain.Role;
import edu.revaluation.domain.SubjectCatalog;
import edu.revaluation.repository.AppUserRepository;
import edu.revaluation.repository.RequestSubjectRepository;
import edu.revaluation.repository.SubjectCatalogRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ExaminerAssignmentTest {
  private final AppUserRepository users = mock(AppUserRepository.class);
  private final SubjectCatalogRepository catalog = mock(SubjectCatalogRepository.class);
  private final RequestSubjectRepository subjects = mock(RequestSubjectRepository.class);
  private final ExaminerAssignment assignment = new ExaminerAssignment(users, catalog, subjects);

  private static AppUser user(String name, Role role, String department) {
    AppUser u = mock(AppUser.class);
    when(u.getUsername()).thenReturn(name);
    when(u.getRole()).thenReturn(role);
    when(u.getDepartment()).thenReturn(department);
    return u;
  }

  @BeforeEach
  void setUp() {
    SubjectCatalog cs305 = mock(SubjectCatalog.class);
    when(cs305.getFirstEvaluator()).thenReturn("examiner.cs02");
    when(cs305.isScriptAvailable()).thenReturn(true);
    when(catalog.findById("CS305")).thenReturn(Optional.of(cs305));
    SubjectCatalog cs399 = mock(SubjectCatalog.class);
    when(cs399.isScriptAvailable()).thenReturn(false);
    when(catalog.findById("CS399")).thenReturn(Optional.of(cs399));

    List<AppUser> pool = List.of(user("examiner.cs01", Role.EXAMINER, "CSE"), user("examiner.cs02", Role.EXAMINER, "CSE"),
        user("examiner.cs03", Role.EXAMINER, "CSE"));
    when(users.findByRoleAndDepartmentOrderByUsername(Role.EXAMINER, "CSE")).thenReturn(pool);
    pool.forEach(u -> when(users.findById(u.getUsername())).thenReturn(Optional.of(u)));
    AppUser ece = user("examiner.ec01", Role.EXAMINER, "ECE");
    when(users.findById("examiner.ec01")).thenReturn(Optional.of(ece));
    AppUser student = user("21CS042", Role.STUDENT, "CSE");
    when(users.findById("21CS042")).thenReturn(Optional.of(student));
  }

  @Test
  void neverOffersTheFirstEvaluatorOrTheFirstRevaluationExaminer() {
    assertThat(assignment.independentExaminers("CS305", "CSE", List.of("examiner.cs01")))
        .extracting(AppUser::getUsername).containsExactly("examiner.cs03");
  }

  @Test
  void suggestsTheLeastBusyIndependentExaminer() {
    when(subjects.countOpenAssignments("examiner.cs01")).thenReturn(4L);
    when(subjects.countOpenAssignments("examiner.cs03")).thenReturn(1L);
    assertThat(assignment.suggest("CS305", "CSE", List.of())).map(AppUser::getUsername).contains("examiner.cs03");
  }

  @Test
  void rejectsAssignmentsThatAreNotIndependent() {
    assertThat(assignment.problemWith("examiner.cs02", "CS305", "CSE", List.of())).contains("first evaluation");
    assertThat(assignment.problemWith("examiner.cs01", "CS305", "CSE", List.of("examiner.cs01"))).contains("already revalued");
    assertThat(assignment.problemWith("examiner.ec01", "CS305", "CSE", List.of())).contains("department");
    assertThat(assignment.problemWith("21CS042", "CS305", "CSE", List.of())).contains("not an examiner");
    assertThat(assignment.problemWith("", "CS305", "CSE", List.of())).isNotNull();
    assertThat(assignment.problemWith("examiner.cs03", "CS305", "CSE", List.of("examiner.cs01"))).isNull();
  }

  @Test
  void archivedScriptOnlyWhenAScanExists() {
    assertThat(assignment.archivedScriptId("21CS042", "CS305")).hasValueSatisfying(id -> assertThat(id).startsWith("SCR-"));
    assertThat(assignment.archivedScriptId("21CS042", "CS399")).isEmpty();
  }
}
