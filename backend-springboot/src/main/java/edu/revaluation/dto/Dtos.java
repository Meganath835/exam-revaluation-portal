package edu.revaluation.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/** Request and response bodies of the REST API. */
public final class Dtos {
  private Dtos() {}

  // ---- requests ----

  public record CreateRequest(
      @NotBlank(message = "Choose an exam session") String examSession,
      @NotNull @Size(min = 1, max = 6, message = "Add between 1 and 6 subjects") List<@Valid SubjectInput> subjects) {}

  public record SubjectInput(
      @NotBlank(message = "Choose a subject") String subjectCode,
      @NotNull(message = "Enter your marks") @Min(value = 0, message = "Marks can't be negative") Integer originalMarks) {}

  public record SubjectView(
      String subjectCode, String subjectName, int originalMarks, int maxMarks, Integer revisedMarks,
      String outcome, String stage) {}

  public record RequestSummary(
      String id, String studentId, String studentName, String department, String examSession,
      String status, int subjectCount, int totalFeePaise, OffsetDateTime createdAt, OffsetDateTime updatedAt) {}

  public record RequestDetail(
      String id, String studentId, String studentName, String studentEmail, String department,
      String examSession, LocalDate resultPublishedOn, LocalDate windowClosesOn, String status,
      String rejectionReason, int feePerSubjectPaise, int totalFeePaise, Long processInstanceKey,
      OffsetDateTime createdAt, List<SubjectView> subjects) {}

  public record Stage(String key, String label, String state, OffsetDateTime at) {}

  public record ElementState(String elementId, String name, String type, String state, boolean incident) {}

  public record EventView(OffsetDateTime at, String message) {}

  public record StatusView(
      String requestId, String status, boolean live, List<Stage> stages, List<ElementState> elements,
      List<SubjectView> subjects, List<EventView> events, int incidents, OffsetDateTime refreshedAt) {}

  // ---- payment ----

  public record PaymentInfo(
      String requestId, String keyId, String razorpayOrderId, int amountPaise, String currency,
      boolean mock, OffsetDateTime payByApprox, String studentName, String studentEmail,
      List<SubjectView> subjects) {}

  public record PaymentConfirmation(
      @NotBlank String razorpayOrderId, @NotBlank String razorpayPaymentId, @NotBlank String razorpaySignature) {}

  public record MockCheckout(@NotBlank @Pattern(regexp = "success|failure") String outcome) {}

  // ---- tasks ----

  public record TaskView(
      long key, String elementId, String name, String state, String assignee, List<String> candidateGroups,
      OffsetDateTime createdAt, OffsetDateTime dueAt, long processInstanceKey, String requestId,
      String subjectCode, String subjectName, Map<String, Object> context, boolean canClaim, boolean canComplete) {}

  public record CompleteTask(@NotNull Map<String, Object> variables) {}

  // ---- process view (exam cell only) ----

  public record ProcessTaskView(
      long key, String elementId, String name, String state, String assignee, List<String> candidateGroups,
      String subjectCode, OffsetDateTime createdAt, OffsetDateTime completedAt, OffsetDateTime dueAt) {}

  public record ProcessInstanceRow(
      String requestId, String studentId, String studentName, String examSession, String status, int subjectCount,
      Long processInstanceKey, boolean live, List<Stage> stages, List<String> currentSteps, List<ProcessTaskView> openTasks,
      int incidents, OffsetDateTime createdAt, OffsetDateTime updatedAt) {}

  public record ElementCount(String elementId, long active, long completed, long canceled, long incidents) {}

  public record ProcessOverview(
      String processId, String processName, Integer version, Long processDefinitionKey, Map<String, Long> totals,
      List<ElementCount> elements, List<ProcessInstanceRow> instances, OffsetDateTime refreshedAt) {}

  public record ProcessInstanceDetail(
      String requestId, Long processInstanceKey, List<ElementState> elements, List<ProcessTaskView> tasks, int incidents) {}

  // ---- lookups ----

  public record UserView(String username, String displayName, String email, String role, String department, List<String> groups) {}

  public record SubjectOption(String code, String name, String department, int maxMarks) {}

  public record SessionOption(String code, String name, LocalDate resultPublishedOn, LocalDate windowClosesOn, boolean open) {}
}
