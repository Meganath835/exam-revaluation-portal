import { forwardRef } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowRight, CheckCircle2, CreditCard, EyeOff, FileCheck2, Info as InfoIcon, Loader2, Send, ShieldCheck, Sparkles, UserPlus, XCircle,
} from 'lucide-react';
import { api } from '../../api/client';
import { Field } from '../../components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useCompleteTask } from '../useCompleteTask';

// ---- shared pieces of every task form ---------------------------------------------------------

/** Context panel at the top of a form. */
function Info({ icon: Icon = InfoIcon, title, children }) {
  return (
    <div className="flex gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-1">
        {title && <b className="font-semibold">{title}</b>}
        {children}
      </div>
    </div>
  );
}

function Submit({ pending, icon: Icon = Send, children }) {
  return (
    <Button type="submit" size="lg" className="self-start px-5" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <Icon />}
      {pending ? 'Saving…' : children}
    </Button>
  );
}

/** A labelled number, e.g. "Original 38 / 100". */
function MarksTile({ label, value, max, tone }) {
  return (
    <div className={cn('flex flex-col rounded-lg border px-3 py-2', tone === 'up' ? 'border-ok/30 bg-ok-soft' : 'bg-muted/40')}>
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-mono text-lg font-semibold leading-tight">
        {value ?? '—'}{max != null && <span className="text-sm font-normal text-muted-foreground"> / {max}</span>}
      </span>
    </div>
  );
}

/** Two radio cards (accept/reject style). The selected one takes the colour of its meaning. */
function Choice({ name, options, value, register, rules }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {options.map(([v, label, tone]) => {
        const Icon = tone === 'ok' ? CheckCircle2 : XCircle;
        const selected = value === v;
        return (
          <label
            key={v}
            className={cn(
              'flex min-h-[48px] cursor-pointer items-center gap-2.5 rounded-lg border px-3.5 text-sm font-medium transition-colors',
              selected && tone === 'ok' && 'border-ok bg-ok-soft text-ok ring-1 ring-ok',
              selected && tone === 'pen' && 'border-pen bg-pen-soft text-pen ring-1 ring-pen',
              !selected && 'hover:bg-muted/60',
            )}
          >
            <input type="radio" value={v} className="h-4 w-4 accent-brand" {...register(name, rules)} />
            <span className="flex-1">{label}</span>
            <Icon className={cn('h-4 w-4', selected ? '' : 'text-muted-foreground')} aria-hidden="true" />
          </label>
        );
      })}
    </div>
  );
}

/** A confirmation checkbox in its own bordered row. forwardRef so react-hook-form's register() ref reaches the input. */
const Confirm = forwardRef(function Confirm({ children, error, ...input }, ref) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className={cn('flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 text-sm transition-colors hover:bg-muted/60', error && 'border-destructive')}>
        <input ref={ref} type="checkbox" className="mt-0.5 h-[18px] w-[18px] accent-brand" {...input} />
        <span>{children}</span>
      </label>
      {error && <span className="err">{error}</span>}
    </div>
  );
});

const req = (msg) => ({ validate: (v) => (v !== undefined && v !== null && String(v).trim() !== '') || msg });
const marksRules = (max) => ({ ...req('Enter the marks.'), min: { value: 0, message: "Marks can't be negative." }, max: { value: max ?? 100, message: `Marks can't exceed ${max}.` } });
const invalid = (error) => (error ? 'border-destructive focus-visible:ring-destructive' : '');

/** Examiner options for a subject: same department, never the first evaluator (or anyone in `exclude`). */
function ExaminerSelect({ task, name, exclude = [], register, error, label }) {
  const c = task.context;
  const s = c.subject || {};
  const examiners = useQuery({ queryKey: ['examiners', s.department], queryFn: () => api(`/examiners?department=${s.department || ''}`) });
  const options = (examiners.data || []).filter((e) => e.username !== c.firstEvaluator && !exclude.includes(e.username));
  // Render the select only once its options exist, so the suggested default shows as selected.
  if (examiners.isLoading) return <p className="text-sm text-muted-foreground">Loading examiners…</p>;
  return (
    <Field label={label} htmlFor={name} error={error}>
      <select id={name} className={cn('input max-w-sm', error && 'input-error')} {...register(name, req('Choose an examiner.'))}>
        <option value="">Choose…</option>
        {options.map((e) => <option key={e.username} value={e.username}>{e.displayName} ({e.username})</option>)}
      </select>
      {c.suggestedExaminerId && !error && (
        <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-gold-dark" aria-hidden="true" />
          Suggested: <span className="font-mono">{c.suggestedExaminerId}</span> (fewest open revaluations)
        </span>
      )}
    </Field>
  );
}

function SubjectsTable({ subjects }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table className="min-w-[420px]">
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead>Subject</TableHead><TableHead className="text-right">Marks claimed</TableHead><TableHead className="text-right">Out of</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(subjects || []).map((s) => (
            <TableRow key={s.subjectCode}>
              <TableCell>{s.subjectCode} · {s.subjectName}</TableCell>
              <TableCell className="text-right font-mono font-medium">{s.originalMarks}</TableCell>
              <TableCell className="text-right font-mono text-muted-foreground">{s.maxMarks}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---- the forms --------------------------------------------------------------------------------

/** Student: confirm the submission (only needed if the portal could not complete it automatically). */
export function SubmitRequestTask({ task, onDone }) {
  const c = task.context;
  const { register, handleSubmit, setError, formState: { errors } } = useForm();
  const save = useCompleteTask(task, setError, onDone, 'Request submitted');
  return (
    <form className="flex flex-col gap-5" noValidate onSubmit={handleSubmit((v) => save.mutate({ declarationAccepted: v.declarationAccepted }))}>
      <Info title={`${c.requestId} · ${c.examSession}`}>
        <span className="text-foreground/80">Confirm your request so the exam cell can verify it.</span>
      </Info>
      <SubjectsTable subjects={c.subjects} />
      <Confirm error={errors.declarationAccepted?.message} {...register('declarationAccepted', { validate: (v) => v || 'Confirm the marks before submitting.' })}>
        I confirm these marks match my published marks card.
      </Confirm>
      <Submit pending={save.isPending}>Submit request</Submit>
    </form>
  );
}

/** Exam cell: check the student's application and accept or reject it. Rejection remarks reach the student. */
export function VerifyApplicationForm({ task, onDone }) {
  const c = task.context;
  const { register, handleSubmit, watch, setError, formState: { errors } } = useForm({ defaultValues: { decision: '', verificationRemarks: '' } });
  const save = useCompleteTask(task, setError, onDone, 'Verification saved');
  return (
    <form className="flex flex-col gap-5" noValidate
      onSubmit={handleSubmit((v) => save.mutate({ applicationComplete: v.decision === 'accept', verificationRemarks: v.verificationRemarks }))}>
      <Info icon={FileCheck2} title={<>{c.studentName} <span className="font-mono font-normal">{c.studentId}</span> · {c.department} · {c.examSession}</>}>
        {c.resultPublishedOn && <span className="text-foreground/80">Results published {new Date(c.resultPublishedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
        <span className="text-muted-foreground">Check the claimed marks against the published marks card and the student's documents.</span>
      </Info>
      <SubjectsTable subjects={c.subjects} />
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="label mb-2">Your decision</legend>
        <Choice name="decision" value={watch('decision')} register={register} rules={req('Accept or reject the application.')}
          options={[['accept', 'Accept the application', 'ok'], ['reject', 'Reject the application', 'pen']]} />
        {errors.decision && <span className="err">{errors.decision.message}</span>}
        {errors.applicationComplete && <span className="err">{errors.applicationComplete.message}</span>}
      </fieldset>
      <Field label="Remarks" htmlFor="verificationRemarks" help="Required when you reject; the student sees them" error={errors.verificationRemarks?.message}>
        <Textarea id="verificationRemarks" rows={3} className={invalid(errors.verificationRemarks)}
          {...register('verificationRemarks', { validate: (v, all) => all.decision !== 'reject' || v.trim() !== '' || 'Explain why; the student will see this.' })} />
      </Field>
      <Submit pending={save.isPending} icon={FileCheck2}>Save verification</Submit>
    </form>
  );
}

/** Exam cell: choose the first independent examiner and confirm the answer script. */
export function AssignExaminerForm({ task, onDone }) {
  const c = task.context;
  const s = c.subject || {};
  const { register, handleSubmit, setError, formState: { errors } } = useForm({
    defaultValues: { firstExaminerId: c.suggestedExaminerId || '', scriptId: c.archivedScriptId || '' },
  });
  const save = useCompleteTask(task, setError, onDone, 'Examiner assigned');
  return (
    <form className="flex flex-col gap-5" noValidate onSubmit={handleSubmit((v) => save.mutate(v))}>
      <Info title={`${s.subjectCode} · ${s.subjectName} (${s.department})`}>
        <span>Student {c.studentName} <span className="font-mono">{c.studentId}</span></span>
        {c.firstEvaluator && <span className="text-foreground/80">First evaluation by <span className="font-mono">{c.firstEvaluator}</span>, who can't revalue it.</span>}
      </Info>
      <div className="flex flex-wrap gap-3">
        <MarksTile label="Original marks" value={s.originalMarks} max={s.maxMarks} />
      </div>
      <ExaminerSelect task={task} name="firstExaminerId" label="Independent examiner" register={register} error={errors.firstExaminerId?.message} />
      <Field label="Answer script ID" htmlFor="scriptId"
        help={c.archivedScriptId ? 'From the scanned script archive' : 'No scan in the archive: retrieve the physical script and enter its ID'}
        error={errors.scriptId?.message}>
        <Input id="scriptId" className={cn('max-w-xs font-mono', invalid(errors.scriptId))} {...register('scriptId', req('Enter the answer script ID.'))} />
      </Field>
      <Submit pending={save.isPending} icon={UserPlus}>Assign examiner</Submit>
    </form>
  );
}

/** First examiner: blind re-evaluation. The server strips the student's identity and the original marks. */
export function ExaminerMarksForm({ task, onDone }) {
  const s = task.context.subject || {};
  const { register, handleSubmit, setError, formState: { errors } } = useForm({ defaultValues: { firstExaminerMarks: '', firstExaminerRemarks: '' } });
  const save = useCompleteTask(task, setError, onDone, 'Marks sent to the exam cell');
  return (
    <form className="flex flex-col gap-5" noValidate onSubmit={handleSubmit((v) => save.mutate({ firstExaminerMarks: Number(v.firstExaminerMarks), firstExaminerRemarks: v.firstExaminerRemarks }))}>
      <Info icon={EyeOff} title="Blind evaluation">
        <span className="text-foreground/80">Script <span className="font-mono">{s.scriptId}</span> · {s.subjectCode} {s.subjectName}. The student's name and original marks are hidden from you.</span>
      </Info>
      <Field label="Updated marks" htmlFor="firstExaminerMarks" help={`Out of ${s.maxMarks}`} error={errors.firstExaminerMarks?.message}>
        <Input id="firstExaminerMarks" type="number" inputMode="numeric" className={cn('h-11 w-32 font-mono text-base', invalid(errors.firstExaminerMarks))} {...register('firstExaminerMarks', marksRules(s.maxMarks))} />
      </Field>
      <Field label="Remarks for the exam cell" htmlFor="firstExaminerRemarks" error={errors.firstExaminerRemarks?.message}>
        <Textarea id="firstExaminerRemarks" rows={4} className={invalid(errors.firstExaminerRemarks)} {...register('firstExaminerRemarks', req('Add remarks for the exam cell.'))} />
      </Field>
      <Submit pending={save.isPending}>Send marks to the exam cell</Submit>
    </form>
  );
}

/** Exam cell: see the first examiner's marks and choose a second independent examiner. */
export function AssignSecondExaminerForm({ task, onDone }) {
  const c = task.context;
  const s = c.subject || {};
  const { register, handleSubmit, setError, formState: { errors } } = useForm({ defaultValues: { secondExaminerId: c.suggestedExaminerId || '' } });
  const save = useCompleteTask(task, setError, onDone, 'Second examiner assigned');
  return (
    <form className="flex flex-col gap-5" noValidate onSubmit={handleSubmit((v) => save.mutate(v))}>
      <Info title={`${s.subjectCode} · ${s.subjectName}`}>
        <span className="text-foreground/80">First examiner: <span className="font-mono">{s.firstExaminerId}</span></span>
        {s.firstExaminerRemarks && <span className="text-foreground/80">“{s.firstExaminerRemarks}”</span>}
      </Info>
      <div className="flex flex-wrap items-center gap-3">
        <MarksTile label="Original" value={s.originalMarks} max={s.maxMarks} />
        <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <MarksTile label="First examiner" value={s.firstExaminerMarks} max={s.maxMarks} />
      </div>
      <ExaminerSelect task={task} name="secondExaminerId" label="Second independent examiner" exclude={[s.firstExaminerId]} register={register} error={errors.secondExaminerId?.message} />
      <Submit pending={save.isPending} icon={UserPlus}>Assign second examiner</Submit>
    </form>
  );
}

/** Second examiner: blind re-evaluation; the first examiner's marks are hidden too. */
export function ReEvaluateForm({ task, onDone }) {
  const s = task.context.subject || {};
  const { register, handleSubmit, setError, formState: { errors } } = useForm({ defaultValues: { secondExaminerMarks: '', examinerRemarks: '' } });
  const save = useCompleteTask(task, setError, onDone, 'Evaluation submitted');
  return (
    <form className="flex flex-col gap-5" noValidate onSubmit={handleSubmit((v) => save.mutate({ secondExaminerMarks: Number(v.secondExaminerMarks), examinerRemarks: v.examinerRemarks }))}>
      <Info icon={EyeOff} title="Blind evaluation">
        <span className="text-foreground/80">Script <span className="font-mono">{s.scriptId}</span> · {s.subjectCode} {s.subjectName}. The student's name, the original marks and the other examiner's marks are hidden from you.</span>
      </Info>
      <Field label="Your marks" htmlFor="secondExaminerMarks" help={`Out of ${s.maxMarks}`} error={errors.secondExaminerMarks?.message}>
        <Input id="secondExaminerMarks" type="number" inputMode="numeric" className={cn('h-11 w-32 font-mono text-base', invalid(errors.secondExaminerMarks))} {...register('secondExaminerMarks', marksRules(s.maxMarks))} />
      </Field>
      <Field label="Remarks for the exam cell" htmlFor="examinerRemarks" error={errors.examinerRemarks?.message}>
        <Textarea id="examinerRemarks" rows={4} className={invalid(errors.examinerRemarks)} {...register('examinerRemarks', req('Add remarks for the exam cell.'))} />
      </Field>
      <Submit pending={save.isPending}>Submit evaluation</Submit>
    </form>
  );
}

const OUTCOME = {
  REVISED: ['Marks increased', 'bg-ok-soft text-ok'],
  WITHHELD: ['Increase not approved', 'bg-pen-soft text-pen'],
  UNCHANGED: ['Unchanged', 'bg-muted text-foreground/80'],
};

export function UpdateResultForm({ task, onDone }) {
  const results = task.context.subjectResults || [];
  const { register, handleSubmit, setError, formState: { errors } } = useForm();
  const save = useCompleteTask(task, setError, onDone, 'Official result updated');
  return (
    <form className="flex flex-col gap-5" noValidate onSubmit={handleSubmit((v) => save.mutate({ resultUpdated: v.resultUpdated, resultReference: v.resultReference }))}>
      <Info icon={ShieldCheck} title="Approved by the HOD and the Controller of Examinations">
        <span className="text-foreground/80">Final marks are the average of both independent examiners, rounded half up.</span>
      </Info>
      <div className="overflow-hidden rounded-lg border">
        <Table className="min-w-[560px]">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Subject</TableHead><TableHead className="text-right">Original</TableHead><TableHead className="text-right">Examiner 1</TableHead>
              <TableHead className="text-right">Examiner 2</TableHead><TableHead className="text-right">Final</TableHead><TableHead>Outcome</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((r) => {
              const [label, cls] = OUTCOME[r.outcome] || [r.outcome, 'bg-muted text-muted-foreground'];
              return (
                <TableRow key={r.subjectCode}>
                  <TableCell>{r.subjectCode} {r.subjectName}</TableCell>
                  <TableCell className="text-right font-mono">{r.originalMarks}</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">{r.firstExaminerMarks ?? '—'}</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">{r.secondExaminerMarks ?? '—'}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{r.revisedMarks}</TableCell>
                  <TableCell><Badge variant="outline" className={cn('border-transparent', cls)}>{label}</Badge></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <Confirm error={errors.resultUpdated?.message} {...register('resultUpdated', { validate: (v) => v || 'Confirm the result system is updated.' })}>
        The revised marks are entered in the university result system
      </Confirm>
      <Field label="Result system reference" htmlFor="resultReference">
        <Input id="resultReference" className="max-w-xs font-mono" {...register('resultReference')} />
      </Field>
      <Submit pending={save.isPending} icon={FileCheck2}>Mark result as updated</Submit>
    </form>
  );
}

export function PayFeeTask({ task }) {
  return (
    <div className="flex flex-col gap-4">
      <Info icon={CreditCard} title="Payment due">
        <span className="text-foreground/80">The exam cell accepted your application. Pay the fee to send your scripts to examiners.</span>
      </Info>
      <Button asChild variant="gold" size="lg" className="self-start px-5">
        <Link to={`/requests/${task.requestId}/pay`} className="no-underline"><CreditCard /> Go to payment</Link>
      </Button>
    </div>
  );
}

/**
 * HOD (recommendation) and Controller of Examinations (final decision): approve or reject the increase
 * for every subject whose marks went up. The CoE also sees the HOD's recommendation.
 */
export function ReviewIncreaseForm({ task, onDone }) {
  const c = task.context;
  const isCoe = task.elementId === 'coeApproveResult';
  const increased = (c.subjectResults || []).filter((r) => r.marksIncreased);
  const hod = Object.fromEntries((c.hodReview || []).map((h) => [h.subjectCode, h]));
  const { register, handleSubmit, watch, setError, formState: { errors } } = useForm({
    defaultValues: Object.fromEntries(increased.flatMap((r) => [[`d_${r.subjectCode}`, ''], [`r_${r.subjectCode}`, '']])),
  });
  const save = useCompleteTask(task, setError, onDone, isCoe ? 'Final decision recorded' : 'Recommendation sent to the CoE');
  const submit = (v) => save.mutate({
    decisions: increased.map((r) => ({ subjectCode: r.subjectCode, approve: v[`d_${r.subjectCode}`] === 'approve', remarks: v[`r_${r.subjectCode}`] })),
  });
  return (
    <form className="flex flex-col gap-5" noValidate onSubmit={handleSubmit(submit)}>
      <Info icon={ShieldCheck} title={<>{c.studentName} <span className="font-mono font-normal">{c.studentId}</span> · {c.department} · {c.examSession}</>}>
        <span className="text-foreground/80">{isCoe ? 'Your decision is final. A rejected increase is withheld and the original marks stand.' : 'Your recommendation goes to the Controller of Examinations for the final decision.'}</span>
      </Info>
      {increased.map((r) => {
        const err = errors[`d_${r.subjectCode}`] || errors[`r_${r.subjectCode}`];
        const rec = hod[r.subjectCode];
        return (
          <fieldset key={r.subjectCode} className="m-0 flex flex-col gap-4 rounded-lg border bg-card p-4">
            <legend className="px-1.5 text-sm font-semibold">{r.subjectCode} · {r.subjectName}</legend>
            <div className="flex flex-wrap items-center gap-2.5">
              <MarksTile label="Original" value={r.originalMarks} />
              <MarksTile label="Examiner 1" value={r.firstExaminerMarks} />
              <MarksTile label="Examiner 2" value={r.secondExaminerMarks} />
              <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <MarksTile label="Revised" value={r.revisedMarks} max={r.maxMarks} tone="up" />
              <Badge className="border-transparent bg-ok text-ok-foreground hover:bg-ok">+{r.markDifference}</Badge>
            </div>
            {isCoe && rec && (
              <div className={cn('flex items-start gap-2 rounded-md px-3 py-2 text-[13px]', rec.recommendation === 'APPROVE' ? 'bg-ok-soft text-ok' : 'bg-pen-soft text-pen')}>
                {rec.recommendation === 'APPROVE' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
                <span>HOD recommends: <b>{rec.recommendation === 'APPROVE' ? 'approve' : 'reject'}</b>{rec.remarks ? ` · “${rec.remarks}”` : ''}</span>
              </div>
            )}
            <Choice name={`d_${r.subjectCode}`} value={watch(`d_${r.subjectCode}`)} register={register} rules={req('Approve or reject this increase.')}
              options={[['approve', 'Approve the increase', 'ok'], ['reject', 'Reject the increase', 'pen']]} />
            <Field label="Remarks" htmlFor={`r_${r.subjectCode}`} help="Required when you reject">
              <Textarea id={`r_${r.subjectCode}`} rows={2}
                {...register(`r_${r.subjectCode}`, { validate: (v, all) => all[`d_${r.subjectCode}`] !== 'reject' || v.trim() !== '' || 'Give a reason for rejecting.' })} />
            </Field>
            {err && <span className="err">{err.message}</span>}
          </fieldset>
        );
      })}
      {errors.decisions && <span className="err">{errors.decisions.message}</span>}
      <Submit pending={save.isPending} icon={ShieldCheck}>{isCoe ? 'Record final decision' : 'Send recommendation'}</Submit>
    </form>
  );
}
