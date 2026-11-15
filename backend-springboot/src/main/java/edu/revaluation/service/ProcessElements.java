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

  // Examination and Revaluation (each runs once per subject)
  public static final String ASSIGN_EXAMINER = "clerkAssignExaminer";
  public static final String EXAMINER_MARKS = "examinerSendsMarks";
  public static final String ASSIGN_SECOND_EXAMINER = "clerkAssignSecondExaminer";
  public static final String RE_EVALUATE = "reEvaluateScript";
  public static final String EVALUATE_MARKS = "evaluateMarksDifference";

  // Moderation and Approval (only when marks increased)
  public static final String HOD_REVIEW = "hodReviewIncrease";
  public static final String COE_APPROVAL = "coeApproveResult";

  public static final String UPDATE_RESULT = "updateOfficialResult";

  // Result Publication
  public static final String NOTIFY_RESULT = "notifyResultPublished";
  public static final String REQUEST_COMPLETED = "requestCompleted";

  public static final List<String> EXAMINATION = List.of(ASSIGN_EXAMINER, EXAMINER_MARKS, ASSIGN_SECOND_EXAMINER, RE_EVALUATE);

  /** Tasks done by an examiner: blind evaluation, the student's identity and earlier marks are hidden. */
  public static final List<String> EXAMINER_TASKS = List.of(EXAMINER_MARKS, RE_EVALUATE);
}
