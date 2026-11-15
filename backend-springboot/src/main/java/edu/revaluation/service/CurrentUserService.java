package edu.revaluation.service;

import edu.revaluation.domain.AppUser;
import edu.revaluation.domain.Role;
import edu.revaluation.repository.AppUserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * Demo sign-in: the React app sends the chosen user in the X-User header. In production this would
 * be replaced by the university's single sign-on (OIDC) and Spring Security.
 */
@Service
public class CurrentUserService {
  private final AppUserRepository users;

  public CurrentUserService(AppUserRepository users) {
    this.users = users;
  }

  public AppUser require(String username) {
    if (username == null || username.isBlank()) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, "Sign in to continue.");
    }
    return users.findById(username)
        .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Unknown user " + username + ". Sign in again."));
  }

  public AppUser requireRole(String username, Role... roles) {
    AppUser user = require(username);
    for (Role r : roles) if (user.getRole() == r) return user;
    throw ApiException.forbidden("Your role can't do this.");
  }

  public static boolean isStaff(AppUser u) {
    return u.getRole() != Role.STUDENT;
  }

  /** Process View (BPMN diagram, element states, workflow tasks) is for the exam cell clerk only. */
  public static boolean canViewProcess(AppUser u) {
    return u.getRole() == Role.EXAM_CELL;
  }

  public AppUser requireProcessViewer(String username) {
    AppUser user = require(username);
    if (!canViewProcess(user)) throw ApiException.forbidden("Only the exam cell can open the process view.");
    return user;
  }
}
