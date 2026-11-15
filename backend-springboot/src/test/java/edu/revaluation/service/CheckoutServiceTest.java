package edu.revaluation.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import edu.revaluation.domain.Payment;
import edu.revaluation.domain.RevaluationRequest;
import edu.revaluation.repository.PaymentRepository;
import edu.revaluation.repository.RevaluationRequestRepository;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class CheckoutServiceTest {
  private final PaymentService payments = mock(PaymentService.class);
  private final PaymentRepository paymentRepo = mock(PaymentRepository.class);
  private final RevaluationRequestRepository requests = mock(RevaluationRequestRepository.class);
  private final CamundaGateway camunda = mock(CamundaGateway.class);
  private final CheckoutService checkout = new CheckoutService(payments, paymentRepo, requests, camunda, mock(EventLog.class));

  private RevaluationRequest request() {
    RevaluationRequest r = mock(RevaluationRequest.class);
    when(r.getId()).thenReturn("REV-1");
    when(r.getTotalFeePaise()).thenReturn(100000);
    when(r.getSubjects()).thenReturn(List.of());
    when(requests.findById("REV-1")).thenReturn(Optional.of(r));
    return r;
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> completedWith() {
    ArgumentCaptor<Map<String, Object>> vars = ArgumentCaptor.forClass(Map.class);
    verify(camunda).complete(eq(42L), vars.capture());
    return vars.getValue();
  }

  @Test
  void forgedSignatureCompletesTheTaskAsUnsuccessful() {
    when(payments.signatureMatches("order_1", "pay_1", "forged")).thenReturn(false);
    boolean ok = checkout.confirm(request(), 42L, "order_1", "order_1", "pay_1", "forged");

    assertThat(ok).isFalse();
    assertThat(completedWith()).containsEntry("paymentSuccessful", false).containsEntry("paymentFailureReason", "SIGNATURE_MISMATCH");
    ArgumentCaptor<Payment> saved = ArgumentCaptor.forClass(Payment.class);
    verify(paymentRepo).save(saved.capture());
    assertThat(saved.getValue().getStatus()).isEqualTo("FAILED");
  }

  @Test
  void validSignatureCompletesTheTaskAsSuccessful() {
    when(payments.signatureMatches(any(), any(), any())).thenReturn(true);
    boolean ok = checkout.confirm(request(), 42L, "order_1", "order_1", "pay_1", "good");

    assertThat(ok).isTrue();
    assertThat(completedWith()).containsEntry("paymentSuccessful", true).containsKey("paidAt").doesNotContainKey("razorpaySignature");
  }

  @Test
  void aSignatureForAnotherOrderIsRejected() {
    when(payments.signatureMatches(any(), any(), any())).thenReturn(true);
    boolean ok = checkout.confirm(request(), 42L, "order_1", "order_OTHER", "pay_1", "good");

    assertThat(ok).isFalse();
    assertThat(completedWith()).containsEntry("paymentFailureReason", "ORDER_MISMATCH");
  }
}
