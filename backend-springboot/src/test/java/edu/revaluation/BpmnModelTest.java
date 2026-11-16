package edu.revaluation;

import static org.assertj.core.api.Assertions.assertThat;

import io.camunda.zeebe.model.bpmn.Bpmn;
import io.camunda.zeebe.model.bpmn.BpmnModelInstance;
import io.camunda.zeebe.model.bpmn.instance.*;
import io.camunda.zeebe.model.bpmn.instance.zeebe.ZeebeFormDefinition;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

/**
 * Static checks on the models in bpmn-models/ (the files the backend deploys). The engine-level
 * check is the deployment itself; this test catches broken wiring before that.
 */
class BpmnModelTest {
  private static final Path MODELS = Path.of("..", "bpmn-models");
  private static final Path MAIN = MODELS.resolve("main/revaluation-process.bpmn");

  private static BpmnModelInstance main() {
    BpmnModelInstance model = Bpmn.readModelFromFile(MAIN.toFile());
    Bpmn.validateModel(model);
    return model;
  }

  @Test
  void onlyTheMainProcessIsDeployed() throws IOException {
    try (Stream<Path> files = Files.walk(MODELS)) {
      assertThat(files.filter(p -> p.toString().endsWith(".bpmn")).map(p -> p.getFileName().toString()))
          .containsExactly("revaluation-process.bpmn");
    }
  }

  @Test
  void followsTheReferenceDiagram() {
    BpmnModelInstance model = main();
    Map<String, String> lanes = new HashMap<>();
    for (Lane lane : model.getModelElementsByType(Lane.class)) {
      for (FlowNode node : lane.getFlowNodeRefs()) lanes.put(node.getId(), lane.getName());
    }
    assertThat(lanes).containsEntry("submitRevaluationRequest", "Request and Eligibility")
        .containsEntry("verifyApplication", "Request and Eligibility")
        .containsEntry("evaluateEligibility", "Request and Eligibility")
        .containsEntry("createRazorpayOrder", "Payment Processing")
        .containsEntry("completeCheckoutAndVerifyPayment", "Payment Processing")
        .containsEntry("clerkAssignExaminer", "Examination and Revaluation")
        .containsEntry("examinerSendsMarks", "Examination and Revaluation")
        .containsEntry("evaluateMarksDifference", "Examination and Revaluation")
        .containsEntry("coeApproveResult", "Moderation and Approval")
        .containsEntry("increaseApprovedGateway", "Moderation and Approval")
        .containsEntry("updateOfficialResult", "Result Publication")
        .containsEntry("notifyResultPublished", "Result Publication")
        .containsEntry("requestCompleted", "Result Publication");

    // Every flow node except boundary events sits in a lane.
    model.getModelElementsByType(FlowNode.class).stream().filter(n -> !(n instanceof BoundaryEvent))
        .forEach(n -> assertThat(lanes).as("lane of " + n.getId()).containsKey(n.getId()));

    // The happy path, in order.
    assertThat(path(model, "requestStarted", "eligibleGateway", "paymentGateway", "marksIncreasedGateway", "increaseApprovedGateway"))
        .containsExactly("requestStarted", "submitRevaluationRequest", "verifyApplication", "evaluateEligibility", "eligibleGateway",
            "createRazorpayOrder", "completeCheckoutAndVerifyPayment", "paymentGateway", "clerkAssignExaminer",
            "examinerSendsMarks", "evaluateMarksDifference",
            "marksIncreasedGateway", "coeApproveResult", "increaseApprovedGateway", "updateOfficialResult",
            "notifyResultPublished", "requestCompleted");
  }

  @Test
  void examinationRunsAsParallelMultiInstanceAndNoHodStepIsLeft() {
    BpmnModelInstance model = main();
    for (String id : List.of("clerkAssignExaminer", "examinerSendsMarks", "evaluateMarksDifference")) {
      Activity task = model.getModelElementById(id);
      assertThat(task.getLoopCharacteristics()).as("multi-instance of " + id).isInstanceOf(MultiInstanceLoopCharacteristics.class);
      assertThat(((MultiInstanceLoopCharacteristics) task.getLoopCharacteristics()).isSequential()).as("parallel " + id).isFalse();
    }
    // Both examiners of a subject evaluate at the same time: one user task, one instance per subject and examiner.
    Activity marks = model.getModelElementById("examinerSendsMarks");
    var loop = marks.getLoopCharacteristics().getSingleExtensionElement(io.camunda.zeebe.model.bpmn.instance.zeebe.ZeebeLoopCharacteristics.class);
    assertThat(loop.getInputCollection()).contains("for s in assignments, n in [1, 2]");
    assertThat(model.getModelElementsByType(UserTask.class)).extracting(UserTask::getId)
        .doesNotContain("clerkAssignSecondExaminer", "reEvaluateScript", "hodReviewIncrease");
    for (BaseElement e : model.getModelElementsByType(BaseElement.class)) {
      if (e.getId() != null) assertThat(e.getId().toLowerCase()).as(e.getId()).doesNotContain("hod");
    }
  }

  @Test
  void everyFlowIsConnectedAndEveryGatewayHasADefault() {
    BpmnModelInstance model = main();
    for (SequenceFlow f : model.getModelElementsByType(SequenceFlow.class)) {
      assertThat(f.getSource()).as("source of " + f.getId()).isNotNull();
      assertThat(f.getTarget()).as("target of " + f.getId()).isNotNull();
    }
    for (FlowNode n : model.getModelElementsByType(FlowNode.class)) {
      if (!(n instanceof StartEvent) && !(n instanceof BoundaryEvent)) assertThat(n.getIncoming()).as("incoming of " + n.getId()).isNotEmpty();
      if (!(n instanceof EndEvent)) assertThat(n.getOutgoing()).as("outgoing of " + n.getId()).isNotEmpty();
    }
    for (ExclusiveGateway g : model.getModelElementsByType(ExclusiveGateway.class)) {
      assertThat(g.getDefault()).as("default of " + g.getId()).isNotNull();
      g.getOutgoing().stream().filter(f -> f != g.getDefault())
          .forEach(f -> assertThat(f.getConditionExpression()).as("condition of " + f.getId()).isNotNull());
    }
    // Every element has a diagram shape, so Modeler and the portal draw the whole model.
    Set<String> drawn = model.getModelElementsByType(io.camunda.zeebe.model.bpmn.instance.bpmndi.BpmnShape.class).stream()
        .map(s -> s.getBpmnElement().getId()).collect(Collectors.toSet());
    model.getModelElementsByType(FlowNode.class).forEach(n -> assertThat(drawn).as("shape of " + n.getId()).contains(n.getId()));
  }

  @Test
  void refundIsGone() throws IOException {
    BpmnModelInstance model = main();
    assertThat(model.getModelElementsByType(CallActivity.class)).isEmpty();
    for (BaseElement e : model.getModelElementsByType(BaseElement.class)) {
      if (e.getId() != null) assertThat(e.getId().toLowerCase()).doesNotContain("refund");
    }
    try (Stream<Path> files = Files.walk(MODELS)) {
      for (Path p : files.filter(Files::isRegularFile).toList()) {
        assertThat(Files.readString(p).toLowerCase()).as(p.toString()).doesNotContain("refund");
      }
    }
  }

  @Test
  void everyReferencedFormExists() throws IOException {
    Set<String> forms = new HashSet<>();
    try (Stream<Path> files = Files.list(MODELS.resolve("forms"))) {
      for (Path p : files.toList()) {
        var m = java.util.regex.Pattern.compile("\"id\":\\s*\"([^\"]+)\",\\s*\"components\"").matcher(Files.readString(p));
        if (m.find()) forms.add(m.group(1));
      }
    }
    for (ZeebeFormDefinition f : main().getModelElementsByType(ZeebeFormDefinition.class)) {
      assertThat(forms).as("form " + f.getFormId()).contains(f.getFormId());
    }
  }

  /** Follows the "Yes" branch at each named gateway and the only outgoing flow elsewhere. */
  private static List<String> path(BpmnModelInstance model, String startId, String... yesGateways) {
    Set<String> yes = Set.of(yesGateways);
    List<String> out = new ArrayList<>();
    FlowNode n = model.getModelElementById(startId);
    while (n != null) {
      out.add(n.getId());
      if (n.getOutgoing().isEmpty()) break;
      SequenceFlow next = yes.contains(n.getId())
          ? n.getOutgoing().stream().filter(f -> "Yes".equals(f.getName())).findFirst().orElseThrow()
          : n.getOutgoing().iterator().next();
      n = next.getTarget();
    }
    return out;
  }
}
