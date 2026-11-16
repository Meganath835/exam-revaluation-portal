package edu.revaluation.service;

import java.util.List;

/** Element ids of revaluationProcess (bpmn-models/main/revaluation-process.bpmn) that the backend relies on. */
public final class ProcessElements {
  private ProcessElements() {}

  // Request and Eligibility
  public static final String SUBMIT_REQUEST = "submitRevaluationRequest";
  public static final String VERIFY_APPLICATION = "verifyApplication";
  public static final String EVALUATE_ELIGIBILITY = "evaluateEligibility";
  public static final String REQUEST_REJECTED = "requestRejected";

  // Payment Processing
  public static final String CREATE_ORDER = "createRazorpayOrder";
  public static final String CHECKOUT = "completeCheckoutAndVerifyPayment";
  public static final String PAYMENT_WINDOW_EXPIRED = "paymentWindowExpired";
  public static final String NOTIFY_PAYMENT_FAILED = "notifyPaymentFailed";
  public static final String CLOSED_PAYMENT_FAILED = "closedPaymentFailed";

  // Examination and Revaluation: the clerk's task and the marks comparison run once per subject,
  // the examiner's task once per subject and examiner (both examiners work at the same time).
  public static final String ASSIGN_EXAMINER = "clerkAssignExaminer";
  public static final String EXAMINER_MARKS = "examinerSendsMarks";
  public static final String EVALUATE_MARKS = "evaluateMarksDifference";

  // Moderation and Approval (only when marks increased)
  public static final String COE_APPROVAL = "coeApproveResult";

  public static final String UPDATE_RESULT = "updateOfficialResult";

  // Result Publication
  public static final String NOTIFY_RESULT = "notifyResultPublished";
  public static final String REQUEST_COMPLETED = "requestCompleted";

  public static final List<String> EXAMINATION = List.of(ASSIGN_EXAMINER, EXAMINER_MARKS);

  /** Tasks done by an examiner: blind evaluation, the student's identity, the original marks and the other examiner are hidden. */
  public static final List<String> EXAMINER_TASKS = List.of(EXAMINER_MARKS);
}
