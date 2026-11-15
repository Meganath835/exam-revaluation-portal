import {
  AssignExaminerForm, AssignSecondExaminerForm, ExaminerMarksForm, PayFeeTask, ReEvaluateForm, ReviewIncreaseForm, SubmitRequestTask,
  UpdateResultForm, VerifyApplicationForm,
} from './forms/simpleForms';

/** Which React form opens for which BPMN user task (by element id). */
export const TASK_FORMS = {
  submitRevaluationRequest: SubmitRequestTask,
  verifyApplication: VerifyApplicationForm,
  completeCheckoutAndVerifyPayment: PayFeeTask,
  clerkAssignExaminer: AssignExaminerForm,
  examinerSendsMarks: ExaminerMarksForm,
  clerkAssignSecondExaminer: AssignSecondExaminerForm,
  reEvaluateScript: ReEvaluateForm,
  hodReviewIncrease: ReviewIncreaseForm,
  coeApproveResult: ReviewIncreaseForm,
  updateOfficialResult: UpdateResultForm,
};

export default function TaskForm({ task, onDone }) {
  const Form = TASK_FORMS[task.elementId];
  if (!Form) return <p className="text-sm text-muted-foreground">This task has no form in the portal.</p>;
  return <Form key={task.key} task={task} onDone={onDone} />;
}
