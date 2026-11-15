package edu.revaluation.service;

import edu.revaluation.domain.Payment;
import edu.revaluation.domain.RequestStatus;
import edu.revaluation.domain.RevaluationRequest;
import edu.revaluation.repository.PaymentRepository;
import edu.revaluation.repository.RevaluationRequestRepository;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Completes the "Complete Checkout and Verify Payment" user task. The Razorpay signature
 * HMAC-SHA256(order_id|payment_id, key_secret) is checked here on the server, and the result goes to
 * the "Payment successful?" gateway as paymentSuccessful.
 */
@Service
public class CheckoutService {
  private final PaymentService payments;
  private final PaymentRepository paymentRepo;
  private final RevaluationRequestRepository requests;
  private final CamundaGateway camunda;
  private final EventLog events;

  public CheckoutService(PaymentService payments, PaymentRepository paymentRepo, RevaluationRequestRepository requests,
      CamundaGateway camunda, EventLog events) {
    this.payments = payments;
    this.paymentRepo = paymentRepo;
    this.requests = requests;
    this.camunda = camunda;
    this.events = events;
  }

  /** Returns true when the payment was verified. */
  @Transactional
  public boolean confirm(RevaluationRequest r, long checkoutTaskKey, String expectedOrderId, String orderId, String paymentId,
      String signature) {
    String failure = null;
    if (expectedOrderId != null && !Objects.equals(expectedOrderId, orderId)) failure = "ORDER_MISMATCH";
    else if (!payments.signatureMatches(orderId, paymentId, signature)) failure = "SIGNATURE_MISMATCH";
    boolean ok = failure == null;
    int amount = r.getTotalFeePaise();

    paymentRepo.save(new Payment(r.getId(), orderId, paymentId, ok ? "CAPTURED" : "FAILED", amount, failure));
    Map<String, Object> vars = new LinkedHashMap<>();
    vars.put("razorpayOrderId", orderId);
    vars.put("razorpayPaymentId", paymentId);
    vars.put("paymentSuccessful", ok);
    if (ok) {
      vars.put("paidAt", OffsetDateTime.now().toString());
      RevaluationRequest managed = requests.findById(r.getId()).orElseThrow();
      managed.setStatus(RequestStatus.UNDER_REVALUATION);
      managed.getSubjects().forEach(s -> s.setStage("Paid: waiting for examiner assignment"));
      events.record(r.getId(), "Payment of Rs. " + amount / 100 + " verified.");
    } else {
      vars.put("paymentFailureReason", failure);
      events.record(r.getId(), "Payment could not be verified (" + failure.toLowerCase().replace('_', ' ') + ").");
    }
    // Same order as the task inbox: our rows first, then the engine. A failure here rolls them back.
    requests.flush();
    camunda.complete(checkoutTaskKey, vars);
    return ok;
  }
}
