package edu.revaluation.domain;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

/** Audit trail entry shown in the tracker's activity list. */
@Entity
@Table(name = "request_event")
public class RequestEvent {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  private String requestId;
  private OffsetDateTime occurredAt;
  private String message;

  protected RequestEvent() {}

  public RequestEvent(String requestId, String message) {
    this.requestId = requestId;
    this.message = message;
    this.occurredAt = OffsetDateTime.now();
  }

  public Long getId() { return id; }
  public String getRequestId() { return requestId; }
  public OffsetDateTime getOccurredAt() { return occurredAt; }
  public String getMessage() { return message; }
}
