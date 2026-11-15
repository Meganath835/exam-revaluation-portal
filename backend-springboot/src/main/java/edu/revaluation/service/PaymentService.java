package edu.revaluation.service;

import edu.revaluation.config.AppProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Service;

/**
 * Razorpay signature handling. Razorpay signs a successful Checkout payment as
 * HMAC-SHA256(order_id + "|" + payment_id) with the key secret; only the server knows the secret.
 */
@Service
public class PaymentService {
  private final AppProperties props;

  public PaymentService(AppProperties props) {
    this.props = props;
  }

  public boolean signatureMatches(String orderId, String paymentId, String signature) {
    if (orderId == null || paymentId == null || signature == null) return false;
    byte[] expected = sign(orderId, paymentId).getBytes(StandardCharsets.UTF_8);
    // Constant-time comparison so the check does not leak timing information.
    return MessageDigest.isEqual(expected, signature.getBytes(StandardCharsets.UTF_8));
  }

  public String sign(String orderId, String paymentId) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(props.razorpay().keySecret().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      return HexFormat.of().formatHex(mac.doFinal((orderId + "|" + paymentId).getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException("Could not compute the payment signature", e);
    }
  }
}
