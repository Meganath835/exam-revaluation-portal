import { lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, ArrowRight, Check, CircleDashed, CreditCard, Inbox, Loader2, MinusCircle, Workflow, X, XCircle,
} from 'lucide-react';
import { api, fmtDate, fmtDateTime, rupees } from '../api/client';
import { canViewProcess, isStudent, useAuth } from '../auth/AuthContext';
import { ErrorBox, PageHeader, Spinner, StatusChip } from '../components/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BlurFade } from '@/components/magicui/blur-fade';
import { BorderBeam } from '@/components/magicui/border-beam';
import { cn } from '@/lib/utils';

// bpmn-js is large, so it loads only when the exam cell opens a request.
const ProcessDiagram = lazy(() => import('../components/ProcessDiagram'));

const TASK_STATE = { OPEN: 'bg-brand-soft text-brand', COMPLETED: 'bg-ok-soft text-ok', CANCELED: 'bg-muted text-muted-foreground' };

const STAGE_STYLE = {
  done: { icon: Check, dot: 'bg-ok text-ok-foreground border-ok', label: 'text-ok', text: 'Done' },
  active: { icon: Loader2, dot: 'bg-primary text-primary-foreground border-primary', label: 'text-brand', text: 'In progress', spin: true },
  incident: { icon: AlertTriangle, dot: 'bg-pen text-pen-foreground border-pen', label: 'text-pen', text: 'Needs attention' },
  stopped: { icon: X, dot: 'bg-pen text-pen-foreground border-pen', label: 'text-pen', text: 'Stopped' },
  skipped: { icon: MinusCircle, dot: 'bg-background text-muted-foreground border-border', label: 'text-muted-foreground', text: 'Skipped' },
  pending: { icon: CircleDashed, dot: 'bg-background text-muted-foreground border-border', label: 'text-muted-foreground', text: 'Next' },
};

const ENDED = ['COMPLETED', 'REJECTED', 'CLOSED_UNPAID', 'CLOSED_PAYMENT_FAILED'];

export default function RequestDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const detail = useQuery({ queryKey: ['request', id], queryFn: () => api(`/requests/${id}`), refetchInterval: (q) => (ENDED.includes(q.state.data?.status) ? false : 4000) });
  const status = useQuery({
    queryKey: ['status', id],
    queryFn: () => api(`/requests/${id}/status`),
    // Poll every 3 s while the request is running; stop once it has ended.
    refetchInterval: (q) => (ENDED.includes(q.state.data?.status) ? false : 3000),
  });

  if (detail.isLoading) return <Spinner />;
  if (detail.error) return <ErrorBox error={detail.error} title="Can't open this request" />;
  const r = detail.data;
  const s = status.data;
  const ended = ENDED.includes(s?.status || r.status);
  const subjects = s?.subjects || r.subjects;

  return (
    <>
      <PageHeader
        back={<Link to="/requests" className="inline-flex w-fit items-center gap-1 text-[13px] text-primary hover:underline"><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> {isStudent(user) ? 'My requests' : 'All requests'}</Link>}
        title={`Request ${r.id}`}
      >
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <StatusChip status={s?.status || r.status} />
          <span>{r.examSession} · {r.subjects.length} subject{r.subjects.length > 1 ? 's' : ''} · {rupees(r.totalFeePaise)}</span>
          {!isStudent(user) && <span>{r.studentName} <span className="font-mono">{r.studentId}</span></span>}
          {s && (
            <span className="inline-flex items-center gap-2 rounded-full border bg-card px-2.5 py-0.5 text-xs">
              <span aria-hidden="true" className="relative flex h-2 w-2">
                {!ended && s.live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" />}
                <span className={cn('relative inline-flex h-2 w-2 rounded-full', ended ? 'bg-muted-foreground' : s.live ? 'bg-ok' : 'bg-warn')} />
              </span>
              {ended ? 'Finished' : s.live ? 'Live' : 'Updating…'} · {new Date(s.refreshedAt).toLocaleTimeString('en-IN')}
            </span>
          )}
        </div>
      </PageHeader>

      {(s?.status || r.status) === 'SUBMITTED' && isStudent(user) && (
        <Alert className="flex flex-wrap items-center justify-between gap-3 [&>svg]:top-1/2 [&>svg]:-translate-y-1/2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription><b>Submitting your request…</b> If this does not move on to the exam cell's verification in a minute, confirm it in your tasks.</AlertDescription>
          <Button asChild variant="outline" size="sm"><Link to="/tasks" className="no-underline"><Inbox /> My tasks</Link></Button>
        </Alert>
      )}
      {(s?.status || r.status) === 'AWAITING_PAYMENT' && isStudent(user) && (
        <BlurFade>
          <Alert className="flex flex-wrap items-center justify-between gap-3 border-warn/30 bg-warn-soft [&>svg]:top-1/2 [&>svg]:-translate-y-1/2 [&>svg]:text-warn">
            <CreditCard className="h-4 w-4" />
            <AlertDescription className="text-warn"><b className="text-warn">Payment due.</b> The exam cell accepted your application. Pay to send your scripts for revaluation.</AlertDescription>
            <Button asChild variant="gold"><Link to={`/requests/${r.id}/pay`} className="no-underline">Pay {rupees(r.totalFeePaise)}</Link></Button>
          </Alert>
        </BlurFade>
      )}
      {r.status === 'REJECTED' && r.rejectionReason && (
        <Alert variant="destructive" className="bg-pen-soft/60">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Not accepted</AlertTitle>
          <AlertDescription>{r.rejectionReason}</AlertDescription>
        </Alert>
      )}
      {s?.incidents > 0 && (
        <Alert variant="destructive" className="bg-pen-soft/60">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>A step needs attention</AlertTitle>
          <AlertDescription>{isStudent(user) ? 'The exam cell has been alerted and will fix it.' : 'The workflow hit a technical problem; it can be retried from Camunda Operate.'}</AlertDescription>
        </Alert>
      )}

      {s && (
        <BlurFade delay={0.05}>
          <Card role="region" aria-label="Progress" className="overflow-x-auto p-5">
            <ol className="m-0 grid min-w-[820px] list-none gap-0 p-0" style={{ gridTemplateColumns: `repeat(${s.stages.length}, minmax(0, 1fr))` }}>
              {s.stages.map((st, i) => {
                const sty = STAGE_STYLE[st.state] || STAGE_STYLE.pending;
                const Icon = sty.icon;
                const current = st.state === 'active' || st.state === 'incident';
                const last = i === s.stages.length - 1;
                return (
                  <li key={st.key} className="relative flex flex-col gap-2 pr-3">
                    <div className="flex items-center">
                      <span className={cn('relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2', sty.dot)} aria-hidden="true">
                        <Icon className={cn('h-4 w-4', sty.spin && 'animate-spin')} />
                      </span>
                      {!last && <span aria-hidden="true" className={cn('ml-2 h-0.5 flex-1 rounded-full', st.state === 'done' ? 'bg-ok' : 'bg-border')} />}
                    </div>
                    <div className={cn('relative flex flex-col gap-0.5 rounded-lg p-2 -ml-2', current && 'bg-accent/60')}>
                      {current && <BorderBeam size={60} duration={6} />}
                      <span className={cn('text-[11px] font-semibold uppercase tracking-wide', sty.label)}>{sty.text}</span>
                      <span className="text-sm font-semibold leading-snug">{st.label}</span>
                      <span className="font-mono text-[12px] text-muted-foreground">{st.at ? fmtDateTime(st.at) : '—'}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>
        </BlurFade>
      )}
      {status.isLoading && <Spinner label="Loading live status…" />}

      {canViewProcess(user) ? (
        <ProcessSection request={r} elements={s?.elements} ended={ended} />
      ) : (
        <p className="text-[12.5px] text-muted-foreground -mt-2">Submitted {fmtDate(r.createdAt)} · window closes {fmtDate(r.windowClosesOn)}</p>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)] items-start">
        <section className="flex min-w-0 flex-col gap-3">
          <h2 className="text-lg font-semibold">Subjects</h2>
          {subjects.map((sub, i) => {
            const up = sub.revisedMarks != null && sub.revisedMarks > sub.originalMarks && sub.outcome !== 'WITHHELD';
            return (
              <BlurFade key={sub.subjectCode} delay={0.05 + i * 0.05}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-col">
                      <h3 className="text-base font-semibold">{sub.subjectCode} · {sub.subjectName}</h3>
                      <span className="text-[13px] text-muted-foreground">{sub.stage}</span>
                    </div>
                    <OutcomeChip sub={sub} />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Marks label="Original" value={sub.originalMarks} max={sub.maxMarks} />
                    {sub.revisedMarks != null && (
                      <>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <Marks label="Revised" value={sub.revisedMarks} max={sub.maxMarks} highlight={up} />
                      </>
                    )}
                    {up && <Badge className="border-transparent bg-ok text-ok-foreground hover:bg-ok">+{sub.revisedMarks - sub.originalMarks} marks</Badge>}
                  </div>
                </Card>
              </BlurFade>
            );
          })}
        </section>

        <section className="flex min-w-0 flex-col gap-3">
          <h2 className="text-lg font-semibold">Activity</h2>
          <Card className="p-5">
            <ol className="relative m-0 list-none border-l border-border p-0 pl-5 text-sm">
              {(s?.events || []).map((e, i) => (
                <li key={i} className="relative pb-4 last:pb-0">
                  <span aria-hidden="true" className={cn('absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-card', i === 0 ? 'bg-primary' : 'bg-border')} />
                  <p className="m-0 leading-snug">{e.message}</p>
                  <span className="font-mono text-[12px] text-muted-foreground">{fmtDateTime(e.at)}</span>
                </li>
              ))}
            </ol>
          </Card>
        </section>
      </div>
    </>
  );
}

function Marks({ label, value, max, highlight }) {
  return (
    <div className={cn('flex flex-col rounded-lg border px-3 py-2', highlight ? 'border-ok/30 bg-ok-soft' : 'bg-muted/40')}>
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-mono text-lg font-semibold leading-tight">{value}<span className="text-sm font-normal text-muted-foreground"> / {max}</span></span>
    </div>
  );
}

/** Exam cell only: this request's live process instance and every workflow task in it. */
function ProcessSection({ request, elements, ended }) {
  const detail = useQuery({
    queryKey: ['process-instance', request.id],
    queryFn: () => api(`/process-view/requests/${request.id}`),
    refetchInterval: ended ? false : 4000,
  });
  const tasks = detail.data?.tasks || [];
  return (
    <BlurFade delay={0.1}>
      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 space-y-0">
          <div className="flex flex-col gap-1.5">
            <CardTitle className="flex items-center gap-2"><Workflow className="h-5 w-5 text-primary" aria-hidden="true" /><h2 className="text-lg font-semibold">Process view</h2></CardTitle>
            <CardDescription>The live process instance in Camunda <span className="font-mono">{request.processInstanceKey}</span>.</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm"><Link to="/process" className="no-underline">All requests in the workflow <ArrowRight /></Link></Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Suspense fallback={<Spinner label="Loading diagram…" />}>
            <ProcessDiagram url={`/requests/${request.id}/diagram`} elements={elements} />
          </Suspense>
          <h3 className="text-base font-semibold">Workflow tasks</h3>
          <ErrorBox error={detail.error} title="Can't load the workflow tasks" />
          {detail.isLoading ? <Spinner label="Loading tasks…" /> : tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No user tasks yet.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead>Task</TableHead><TableHead>Subject</TableHead><TableHead>Assigned to</TableHead><TableHead>State</TableHead><TableHead>Created</TableHead><TableHead>Completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((t) => (
                    <TableRow key={t.key}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="font-mono">{t.subjectCode || '—'}</TableCell>
                      <TableCell>{t.assignee || t.candidateGroups.join(', ') || '—'}</TableCell>
                      <TableCell><Badge variant="outline" className={cn('border-transparent', TASK_STATE[t.state] || 'bg-muted text-muted-foreground')}>{t.state}</Badge></TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-[12.5px] text-muted-foreground">{fmtDateTime(t.createdAt)}</TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-[12.5px] text-muted-foreground">{fmtDateTime(t.completedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="text-[12.5px] text-muted-foreground">Submitted {fmtDate(request.createdAt)} · window closes {fmtDate(request.windowClosesOn)}</p>
        </CardContent>
      </Card>
    </BlurFade>
  );
}

function OutcomeChip({ sub }) {
  const chip = (cls, text) => <Badge variant="outline" className={cn('border-transparent', cls)}>{text}</Badge>;
  if (sub.outcome === 'REVISED') return chip('bg-ok-soft text-ok', 'Marks increased');
  if (sub.outcome === 'WITHHELD') return chip('bg-pen-soft text-pen', 'Increase not approved');
  if (sub.outcome === 'UNCHANGED') return chip('bg-muted text-foreground/80', 'Unchanged');
  if (/examiner|one of two evaluations/i.test(sub.stage || '')) return chip('bg-warn-soft text-warn', 'With examiners');
  return chip('bg-muted text-muted-foreground', 'In progress');
}
