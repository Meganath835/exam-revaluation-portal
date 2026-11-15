package edu.revaluation.web;

import edu.revaluation.config.AppProperties;
import edu.revaluation.domain.Role;
import edu.revaluation.dto.Dtos.*;
import edu.revaluation.repository.AppUserRepository;
import edu.revaluation.repository.ExamSessionRepository;
import edu.revaluation.repository.SubjectCatalogRepository;
import edu.revaluation.service.CurrentUserService;
import edu.revaluation.service.Views;
import java.time.LocalDate;
import java.util.List;
import org.springframework.web.bind.annotation.*;

/** Reference data for forms and the demo sign-in screen. */
@RestController
@RequestMapping("/api")
public class LookupController {
  private final AppUserRepository users;
  private final SubjectCatalogRepository subjects;
  private final ExamSessionRepository sessions;
  private final CurrentUserService currentUser;
  private final AppProperties props;

  public LookupController(AppUserRepository users, SubjectCatalogRepository subjects, ExamSessionRepository sessions,
      CurrentUserService currentUser, AppProperties props) {
    this.users = users;
    this.subjects = subjects;
    this.sessions = sessions;
    this.currentUser = currentUser;
    this.props = props;
  }

  /** Demo users for the sign-in screen. */
  @GetMapping("/users")
  public List<UserView> users() {
    return users.findAll().stream().map(Views::user)
        .sorted((a, b) -> a.role().equals(b.role()) ? a.username().compareTo(b.username()) : Role.valueOf(a.role()).compareTo(Role.valueOf(b.role())))
        .toList();
  }

  @GetMapping("/me")
  public UserView me(@RequestHeader(value = "X-User", required = false) String user) {
    return Views.user(currentUser.require(user));
  }

  @GetMapping("/subjects")
  public List<SubjectOption> subjects(@RequestParam(required = false) String department) {
    var list = department == null ? subjects.findAll() : subjects.findByDepartmentOrderByCode(department);
    return list.stream().map(s -> new SubjectOption(s.getCode(), s.getName(), s.getDepartment(), s.getMaxMarks()))
        .sorted((a, b) -> a.code().compareTo(b.code())).toList();
  }

  @GetMapping("/exam-sessions")
  public List<SessionOption> sessions() {
    return sessions.findAll().stream().map(s -> {
      LocalDate closes = Views.windowCloses(s.getResultPublishedOn(), props.revaluationWindow());
      return new SessionOption(s.getCode(), s.getName(), s.getResultPublishedOn(), closes, !LocalDate.now().isAfter(closes));
    }).sorted((a, b) -> b.resultPublishedOn().compareTo(a.resultPublishedOn())).toList();
  }

  @GetMapping("/examiners")
  public List<UserView> examiners(@RequestParam(required = false) String department) {
    var list = department == null ? users.findByRoleOrderByUsername(Role.EXAMINER)
        : users.findByRoleAndDepartmentOrderByUsername(Role.EXAMINER, department);
    return list.stream().map(Views::user).toList();
  }
}
