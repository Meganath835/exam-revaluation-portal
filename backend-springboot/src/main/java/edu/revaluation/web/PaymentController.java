package edu.revaluation.web;

import edu.revaluation.config.AppProperties;
import edu.revaluation.domain.AppUser;
import edu.revaluation.domain.RevaluationRequest;
import edu.revaluation.domain.Role;
import edu.revaluation.dto.Dtos.*;
import edu.revaluation.service.*;
import io.camunda.client.api.search.response.UserTask;
import jakarta.validation.Valid;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class PaymentController {
  private final RequestService requests;
  private final CamundaGateway camunda;
  private final PaymentService payments;
  private final CheckoutService checkout;
  private final CurrentUserService currentUser;
  private final AppProperties props;

  public PaymentController(RequestService requests, CamundaGateway camunda, PaymentService payments, CheckoutService checkout,
      CurrentUserService currentUser, AppProperties props) {
    this.requests = requests;
    this.camunda = camunda;
    this.payments = payments;
    this.checkout = checkout;
    this.currentUser = currentUser;
    this.props = props;
  }

  /** What Razorpay Checkout needs. Only available while "Complete Checkout and Verify Payment" is open. */
  @GetMapping("/requests/{id}/payment")
  public PaymentInfo info(@RequestHeader(value = "X-User", required = false) String user, @PathVariable String id) {
    AppUser student = currentUser.requireRole(user, Role.STUDENT);
    RevaluationRequest r = requests.getFor(student, id);
    UserTask task = checkoutTask(r);
    String orderId = orderId(r);
    var payBy = task.getCreationDate() == null ? null : task.getCreationDate().plus(Duration.parse(props.paymentWindow()));
    return new PaymentInfo(r.getId(), props.razorpay().keyId(), orderId, r.getTotalFeePaise(), "INR", props.razorpay().mock(),
        payBy, student.getDisplayName(), student.getEmail(), r.getSubjects().stream().map(Views::subject).toList());
  }

  /**
   * Called by the React page with the Razorpay Checkout response. Verifies the signature on the
   * server and completes "Complete Checkout and Verify Payment"; the gateway then branches on the result.
   */
  @PostMapping("/payments/{id}/confirm")
  public Map<String, String> confirm(@RequestHeader(value = "X-User", required = false) String user, @PathVariable String id,
      @Valid @RequestBody PaymentConfirmation body) {
    AppUser student = currentUser.requireRole(user, Role.STUDENT);
    RevaluationRequest r = requests.getFor(student, id);
    UserTask task = checkoutTask(r);
    boolean ok = checkout.confirm(r, task.getUserTaskKey(), orderId(r), body.razorpayOrderId(), body.razorpayPaymentId(),
        body.razorpaySignature());
    return Map.of("status", ok ? "PAID" : "PAYMENT_FAILED");
  }

  /**
   * Demo only (app.razorpay.mock=true): stands in for Razorpay Checkout so the full flow works
   * offline. "success" produces a correctly signed payment, "failure" a forged signature.
   */
  @PostMapping("/payments/{id}/mock-checkout")
  public Map<String, String> mockCheckout(@RequestHeader(value = "X-User", required = false) String user, @PathVariable String id,
      @Valid @RequestBody MockCheckout body) {
    if (!props.razorpay().mock()) throw ApiException.notFound("Mock checkout");
    String orderId = info(user, id).razorpayOrderId();
    if (orderId == null) throw new ApiException(HttpStatus.CONFLICT, "The payment order is still being created. Try again in a moment.");
    String paymentId = "pay_mock" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    String signature = "success".equals(body.outcome()) ? payments.sign(orderId, paymentId) : "forged-signature";
    return confirm(user, id, new PaymentConfirmation(orderId, paymentId, signature));
  }

  /** The REST connector creates the Razorpay order just before the task opens; null until then. */
  private String orderId(RevaluationRequest r) {
    return camunda.processVariable(r.getProcessInstanceKey(), "razorpayOrderId").map(String::valueOf).orElse(null);
  }

  private UserTask checkoutTask(RevaluationRequest r) {
    if (r.getProcessInstanceKey() == null) throw ApiException.notFound("Payment for " + r.getId());
    return camunda.openTask(r.getProcessInstanceKey(), ProcessElements.CHECKOUT)
        .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "This request is not waiting for payment."));
  }
}
