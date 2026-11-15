package edu.revaluation.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Application settings, bound from the "app" section of application.yml (and environment variables). */
@ConfigurationProperties(prefix = "app")
public record AppProperties(
    int feePerSubjectPaise,
    String revaluationWindow,
    String paymentWindow,
    String examinerSla,
    Razorpay razorpay,
    String corsOrigins) {

  /**
   * @param keyId public key id, sent to Razorpay Checkout in the browser
   * @param keySecret secret used only on the server to verify payment signatures
   * @param connectorBaseUrl base URL the REST connector calls (the real API, or the built-in mock)
   * @param mock when true the UI offers a test checkout and the backend serves /mock/razorpay
   */
  public record Razorpay(String keyId, String keySecret, String connectorBaseUrl, boolean mock) {}
}
