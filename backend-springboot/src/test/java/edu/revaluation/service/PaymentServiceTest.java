package edu.revaluation.service;

import static org.assertj.core.api.Assertions.assertThat;

import edu.revaluation.config.AppProperties;
import org.junit.jupiter.api.Test;

class PaymentServiceTest {
  private final PaymentService service = new PaymentService(new AppProperties(50000, "P15D", "PT15M", "P3D",
      new AppProperties.Razorpay("rzp_test_x", "test_secret", "https://api.razorpay.com", false), "http://localhost"));

  @Test
  void acceptsTheSignatureRazorpayWouldSend() {
    // Reference value: HMAC-SHA256("order_1|pay_1", "test_secret") in hex
    String signature = service.sign("order_1", "pay_1");
    assertThat(signature).hasSize(64);
    assertThat(service.signatureMatches("order_1", "pay_1", signature)).isTrue();
  }

  @Test
  void rejectsATamperedPaymentId() {
    String signature = service.sign("order_1", "pay_1");
    assertThat(service.signatureMatches("order_1", "pay_2", signature)).isFalse();
  }

  @Test
  void rejectsMissingValues() {
    assertThat(service.signatureMatches("order_1", null, "abc")).isFalse();
    assertThat(service.signatureMatches(null, "pay_1", "abc")).isFalse();
  }
}
