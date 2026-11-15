package edu.revaluation.domain;

public enum RequestStatus {
  SUBMITTED(false),
  AWAITING_VERIFICATION(false),
  AWAITING_PAYMENT(false),
  UNDER_REVALUATION(false),
  AWAITING_APPROVAL(false),
  RESULTS_READY(false),
  COMPLETED(true),
  REJECTED(true),
  CLOSED_UNPAID(true),
  CLOSED_PAYMENT_FAILED(true);

  private final boolean terminal;

  RequestStatus(boolean terminal) {
    this.terminal = terminal;
  }

  public boolean isTerminal() {
    return terminal;
  }
}
