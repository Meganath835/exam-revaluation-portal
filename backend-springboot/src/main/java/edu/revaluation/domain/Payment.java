package edu.revaluation.domain;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "payment")
public class Payment {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  private String requestId;
  private String razorpayOrderId;
  private String razorpayPaymentId;
  private String status;
  private int amountPaise;
  private String failureReason;
  private OffsetDateTime createdAt;

  protected Payment() {}

  public Payment(String requestId, String orderId, String paymentId, String status, int amountPaise, String failureReason) {
    this.requestId = requestId;
    this.razorpayOrderId = orderId;
    this.razorpayPaymentId = paymentId;
    this.status = status;
    this.amountPaise = amountPaise;
    this.failureReason = failureReason;
    this.createdAt = OffsetDateTime.now();
  }

  public Long getId() { return id; }
  public String getRequestId() { return requestId; }
  public String getRazorpayOrderId() { return razorpayOrderId; }
  public String getRazorpayPaymentId() { return razorpayPaymentId; }
  public String getStatus() { return status; }
  public int getAmountPaise() { return amountPaise; }
  public String getFailureReason() { return failureReason; }
  public OffsetDateTime getCreatedAt() { return createdAt; }
}
