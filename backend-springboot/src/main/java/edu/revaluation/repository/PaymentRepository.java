package edu.revaluation.repository;

import edu.revaluation.domain.Payment;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
  List<Payment> findByRequestIdOrderByCreatedAtDesc(String requestId);
}
