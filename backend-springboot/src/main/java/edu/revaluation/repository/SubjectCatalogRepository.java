package edu.revaluation.repository;

import edu.revaluation.domain.SubjectCatalog;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SubjectCatalogRepository extends JpaRepository<SubjectCatalog, String> {
  List<SubjectCatalog> findByDepartmentOrderByCode(String department);
}
