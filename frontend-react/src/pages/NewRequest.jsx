import { useMemo } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, BookOpen, CalendarClock, Loader2, ReceiptText, Send, Trash2, UserRound } from 'lucide-react';
import { api, fmtDate, rupees } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { ErrorBox, Field, KeyValue, PageHeader, Spinner } from '../components/shared';
import { useToast } from '../components/Toast';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { BlurFade } from '@/components/magicui/blur-fade';
import { cn } from '@/lib/utils';

const FEE_PER_SUBJECT = 50000; // paise; the server is the source of truth and returns the real total
const MAX_SUBJECTS = 6;

const NEXT_STEPS = [
  'The exam cell verifies your application; then the eligibility rules are checked.',
  'You pay within the payment window.',
  'Two independent examiners revalue each subject.',
  'Any increase is approved by the Controller of Examinations.',
  'You get the result by email; the status page updates live.',
];

/** Builds the zod schema with the subject catalog, so marks are checked against each subject's maximum. */
function schemaFor(catalog) {
  const max = Object.fromEntries(catalog.map((s) => [s.code, s.maxMarks]));
  // Row checks live on the array itself so they run even while another field (e.g. the
  // confirmation box) is still invalid; the student sees every problem at once.
  const subjects = z
    .array(
      z.object({
        subjectCode: z.string().min(1, 'Choose a subject'),
        originalMarks: z.coerce.number({ invalid_type_error: 'Enter your marks' }).int('Whole marks only').min(0, "Marks can't be negative"),
      }),
    )
    .min(1, 'Add at least one subject')
    .max(MAX_SUBJECTS, `Up to ${MAX_SUBJECTS} subjects`)
    .superRefine((rows, ctx) => {
      const seen = new Set();
      rows.forEach((s, i) => {
        if (s.subjectCode && seen.has(s.subjectCode)) {
          ctx.addIssue({ code: 'custom', path: [i, 'subjectCode'], message: `${s.subjectCode} is already added` });
        }
        seen.add(s.subjectCode);
        const m = max[s.subjectCode];
        if (m !== undefined && s.originalMarks > m) {
          ctx.addIssue({ code: 'custom', path: [i, 'originalMarks'], message: `Marks must be between 0 and ${m}` });
        }
      });
    });
  return z.object({
    examSession: z.string().min(1, 'Choose an exam session'),
    confirm: z.literal(true, { errorMap: () => ({ message: 'Confirm the marks before submitting' }) }),
    subjects,
  });
}

export default function NewRequest() {
  const { user } = useAuth();
  const catalog = useQuery({ queryKey: ['subjects', user.department], queryFn: () => api(`/subjects?department=${user.department}`) });
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: () => api('/exam-sessions') });
  if (catalog.isLoading || sessions.isLoading) return <Spinner />;
  if (catalog.error || sessions.error) return <ErrorBox error={catalog.error || sessions.error} />;
  return <RequestForm catalog={catalog.data} sessions={sessions.data} />;
}

function RequestForm({ catalog, sessions }) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const schema = useMemo(() => schemaFor(catalog), [catalog]);
  const defaultSession = sessions.find((s) => s.open)?.code || sessions[0]?.code || '';

  const {
    register, control, handleSubmit, watch, setError,
    formState: { errors, isSubmitted },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { examSession: defaultSession, confirm: false, subjects: [{ subjectCode: '', originalMarks: '' }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'subjects' });
  const subjects = watch('subjects');
  const sessionCode = watch('examSession');
  const session = sessions.find((s) => s.code === sessionCode);
  const daysLeft = session ? Math.ceil((new Date(session.windowClosesOn) - new Date()) / 86400000) : null;

  const submit = useMutation({
    mutationFn: (v) => api('/requests', { method: 'POST', body: { examSession: v.examSession, subjects: v.subjects } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['requests'] });
      toast(`Request ${r.id} submitted`);
      navigate(`/requests/${r.id}`);
    },
    onError: (e) => {
      Object.entries(e.fieldErrors || {}).forEach(([k, msg]) => setError(k, { message: msg }));
      toast(e.message, 'error');
    },
  });

  const rowErrors = (errors.subjects || []).filter?.(Boolean) || [];
  const problemCount = rowErrors.reduce((n, r) => n + Object.keys(r || {}).length, 0) + (errors.confirm ? 1 : 0) + (errors.examSession ? 1 : 0);
  const maxFor = (code) => catalog.find((c) => c.code === code)?.maxMarks;
  const ROW = 'grid grid-cols-[28px_minmax(0,2.4fr)_minmax(0,1fr)_70px_40px] gap-3';

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit((v) => submit.mutate(v))} noValidate>
      <PageHeader title="Request revaluation">
        {session && (
          <div className="flex flex-wrap items-center gap-2.5 text-sm text-muted-foreground">
            <CalendarClock className="h-4 w-4" aria-hidden="true" />
            <span>Results published {fmtDate(session.resultPublishedOn)}</span>
            <span aria-hidden="true">·</span>
            <span>Window closes {fmtDate(session.windowClosesOn)}</span>
            {session.open ? (
              <Badge variant="outline" className="border-transparent bg-warn-soft text-warn">{daysLeft} days left</Badge>
            ) : (
              <Badge variant="outline" className="border-transparent bg-pen-soft text-pen">Window closed</Badge>
            )}
          </div>
        )}
      </PageHeader>

      {isSubmitted && problemCount > 0 && (
        <Alert variant="destructive" className="bg-pen-soft/60">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="mb-0">Fix {problemCount} problem{problemCount > 1 ? 's' : ''} before submitting.</AlertTitle>
        </Alert>
      )}
      <ErrorBox error={submit.error && !Object.keys(submit.error.fieldErrors || {}).length ? submit.error : null} title="The request was not submitted" />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        <div className="flex min-w-0 flex-col gap-5">
          <BlurFade delay={0.05}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><UserRound className="h-5 w-5 text-primary" aria-hidden="true" /><h2 className="text-lg font-semibold">Your details</h2></CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <KeyValue items={[['Roll number', <span className="font-mono">{user.username}</span>], ['Name', user.displayName], ['Department', user.department], ['Email for updates', user.email]]} />
                <Field label="Exam session" htmlFor="examSession" error={errors.examSession?.message} help={session && !session.open ? 'You can still submit; the eligibility rules will decide.' : undefined}>
                  <select id="examSession" className="input max-w-sm" {...register('examSession')}>
                    {sessions.map((s) => (
                      <option key={s.code} value={s.code}>{s.name}</option>
                    ))}
                  </select>
                </Field>
              </CardContent>
            </Card>
          </BlurFade>

          <BlurFade delay={0.1}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" aria-hidden="true" /><h2 className="text-lg font-semibold">Subjects to revalue</h2></CardTitle>
                <CardDescription>{fields.length} of {MAX_SUBJECTS} · each subject is revalued by two independent examiners</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="overflow-x-auto">
                  <div className="flex min-w-[560px] flex-col gap-2.5 p-0.5">
                    <div className={cn(ROW, 'text-xs font-medium text-muted-foreground')}>
                      <span>#</span><span>Subject</span><span>Your marks</span><span>Out of</span><span />
                    </div>
                    {fields.map((f, i) => {
                      const e = errors.subjects?.[i] || {};
                      const max = maxFor(subjects?.[i]?.subjectCode);
                      return (
                        <div key={f.id} className="flex flex-col gap-1">
                          <div className={cn(ROW, 'items-center')}>
                            <span className="font-mono text-[13px] text-muted-foreground">{i + 1}</span>
                            <label className="sr-only" htmlFor={`subject-${i}`}>Subject, row {i + 1}</label>
                            <select id={`subject-${i}`} className={cn('input', e.subjectCode && 'input-error')} {...register(`subjects.${i}.subjectCode`)}>
                              <option value="">Choose a subject</option>
                              {catalog.map((c) => (
                                <option key={c.code} value={c.code}>{c.code} · {c.name}</option>
                              ))}
                            </select>
                            <label className="sr-only" htmlFor={`marks-${i}`}>Your marks, row {i + 1}</label>
                            <Input id={`marks-${i}`} type="number" inputMode="numeric" min="0" className={cn('h-10 font-mono', e.originalMarks && 'border-destructive focus-visible:ring-destructive')} {...register(`subjects.${i}.originalMarks`)} />
                            <span className="font-mono text-sm text-muted-foreground">/ {max ?? '—'}</span>
                            <Button type="button" variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-destructive" aria-label={`Remove row ${i + 1}`} disabled={fields.length === 1} onClick={() => remove(i)}>
                              <Trash2 />
                            </Button>
                          </div>
                          {(e.subjectCode || e.originalMarks) && <span className="err pl-10">{[e.subjectCode?.message, e.originalMarks?.message].filter(Boolean).join(' · ')}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {errors.subjects?.root?.message || errors.subjects?.message ? <span className="err">{errors.subjects?.root?.message || errors.subjects?.message}</span> : null}
                <Button type="button" variant="outline" className="self-start border-dashed border-primary/60 text-primary hover:text-primary" disabled={fields.length >= MAX_SUBJECTS} onClick={() => append({ subjectCode: '', originalMarks: '' })}>
                  + Add subject
                </Button>
              </CardContent>
            </Card>
          </BlurFade>

          <div className="flex flex-col gap-1.5">
            <label className={cn('flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-4 text-sm leading-relaxed shadow-sm transition-colors hover:bg-muted/60', errors.confirm && 'border-destructive')}>
              <input type="checkbox" className="mt-0.5 h-[18px] w-[18px] accent-brand" {...register('confirm')} />
              <span>I confirm these marks match my published marks card. A request can't be changed after payment.</span>
            </label>
            {errors.confirm && <span className="err">{errors.confirm.message}</span>}
          </div>
        </div>

        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6">
          <BlurFade delay={0.15}>
            <Card className="border-t-[3px] border-t-gold">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2"><ReceiptText className="h-5 w-5 text-primary" aria-hidden="true" /><h2 className="text-lg font-semibold">Fee</h2></CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex justify-between text-sm text-muted-foreground"><span>{fields.length} subject{fields.length > 1 ? 's' : ''} × {rupees(FEE_PER_SUBJECT)}</span><span className="font-mono">{rupees(fields.length * FEE_PER_SUBJECT)}</span></div>
                <Separator />
                <div className="flex items-baseline justify-between"><span className="font-semibold">Total</span><span className="font-mono text-2xl font-semibold">{rupees(fields.length * FEE_PER_SUBJECT)}</span></div>
                <Button type="submit" size="lg" className="mt-1" disabled={submit.isPending}>
                  {submit.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                  {submit.isPending ? 'Submitting…' : 'Submit request'}
                </Button>
                <p className="text-xs text-muted-foreground">You pay after the exam cell accepts the application.</p>
              </CardContent>
            </Card>
          </BlurFade>
          <BlurFade delay={0.2}>
            <Card className="bg-muted/40 shadow-none">
              <CardHeader className="pb-3"><h2 className="text-base font-semibold">What happens next</h2></CardHeader>
              <CardContent>
                <ol className="m-0 flex list-none flex-col gap-3 p-0 text-sm">
                  {NEXT_STEPS.map((text, i) => (
                    <li key={text} className="flex items-start gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent font-mono text-xs font-semibold text-accent-foreground">{i + 1}</span>
                      <span className="text-foreground/80">{text}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </BlurFade>
        </aside>
      </div>
    </form>
  );
}
