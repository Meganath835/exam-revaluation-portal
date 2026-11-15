package edu.revaluation.repository;

import edu.revaluation.domain.AppUser;
import edu.revaluation.domain.Role;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppUserRepository extends JpaRepository<AppUser, String> {
  List<AppUser> findByRoleOrderByUsername(Role role);

  List<AppUser> findByRoleAndDepartmentOrderByUsername(Role role, String department);

  List<AppUser> findByRoleInOrderByUsername(List<Role> roles);
}
