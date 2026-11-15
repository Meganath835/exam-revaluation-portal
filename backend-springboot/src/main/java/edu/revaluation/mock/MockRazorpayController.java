package edu.revaluation.mock;

import java.util.Map;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.*;

/**
 * A tiny stand-in for the Razorpay Orders API, enabled with app.razorpay.mock=true.
 * The REST connector calls it exactly as it would call api.razorpay.com, so the BPMN is unchanged.
 */
@RestController
@RequestMapping("/mock/razorpay/v1")
@ConditionalOnProperty(name = "app.razorpay.mock", havingValue = "true")
public class MockRazorpayController {

  @PostMapping("/orders")
  public Map<String, Object> createOrder(@RequestBody Map<String, Object> body) {
    return Map.of(
        "id", "order_mock" + shortId(),
        "entity", "order",
        "amount", body.getOrDefault("amount", 0),
        "currency", body.getOrDefault("currency", "INR"),
        "receipt", body.getOrDefault("receipt", ""),
        "status", "created");
  }

  private static String shortId() {
    return UUID.randomUUID().toString().replace("-", "").substring(0, 14);
  }
}
