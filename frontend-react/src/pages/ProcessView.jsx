import { lazy, Suspense, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, CheckCircle2, ClipboardList, Inbox, ScanSearch, ShieldCheck, UserRound, Workflow, XCircle } from 'lucide-react';
import { api, fmtDateTime } from '../api/client';
import { EmptyState, ErrorBox, PageHeader, Spinner, StatusChip } from '../components/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BlurFade } from '@/components/magicui/blur-fade';
import { NumberTicker } from '@/components/magicui/number-ticker';
import { cn } from '@/lib/utils';

// bpmn-js is large, so the diagram loads only when this page opens.
const ProcessDiagram = lazy(() => import('../components/ProcessDiagram'));

const TILES = [
  ['running', 'Running', Activity, 'text-brand bg-brand-soft'],
  ['waitingForExamCell', 'Waiting for exam cell', ClipboardList, 'text-warn bg-warn-soft'],
  ['withExaminers', 'With examiners', ScanSearch, 'text-brand bg-brand-soft'],
  ['waitingForApproval', 'Waiting for HOD / CoE', ShieldCheck, 'text-warn bg-warn-soft'],
  ['waitingForStudents', 'Waiting for students', UserRound, 'text-foreground/70 bg-muted'],
  ['completed', 'Completed', CheckCircle2, 'text-ok bg-ok-soft'],
  ['closed', 'Closed or rejected', XCircle, 'text-muted-foreground bg-muted'],
  ['incidents', 'Incidents', AlertTriangle, 'text-pen bg-pen-soft'],
];

const FILTERS = [
  ['running', 'Running'],
  ['finished', 'Finished'],
  ['all', 'All'],
];

const ENDED = ['COMPLETED', 'REJECTED', 'CLOSED_UNPAID', 'CLOSED_PAYMENT_FAILED'];

const STAGE_BAR = { done: 'bg-ok', active: 'bg-brand', incident: 'bg-pen', stopped: 'bg-pen', skipped: 'bg-border', pending: 'bg-border' };

/** Exam cell dashboard: the deployed workflow and every request in it, read live from Camunda. */
export default function ProcessView() {
  const [filter, setFilter] = useState('running');
  const q = useQuery({ queryKey: ['process-view'], queryFn: () => api('/process-view'), refetchInterval: 5000 });
  const d = q.data;
  const rows = (d?.instances || []).filter((r) =>
    filter === 'all' ? true : filter === 'running' ? !ENDED.includes(r.status) : ENDED.includes(r.status));

  return (
    <>
      <PageHeader title="Process view">
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-0.5 text-xs">
            <span aria-hidden="true" className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
            </span>
            Live from Camunda
          </span>
          {d?.version != null && <span><span className="font-mono">{d.processId}</span> version {d.version}</span>}
          {d && <span>· refreshed {new Date(d.refreshedAt).toLocaleTimeString('en-IN')}</span>}
        </p>
      </PageHeader>

      {q.isLoading && <Spinner label="Loading the workflow…" />}
      <ErrorBox error={q.error} title="Can't load the process view" />

      {d && (
        <>
          <section aria-label="Workflow totals" className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
            {TILES.map(([k, label, Icon, cls], i) => (
              <BlurFade key={k} delay={i * 0.04}>
                <Card className="flex items-center gap-3 border-t-[3px] border-t-gold p-4 transition-shadow hover:shadow-md">
                  <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', cls)}><Icon className="h-5 w-5" aria-hidden="true" /></span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-xs text-muted-foreground">{label}</span>
                    <NumberTicker value={d.totals?.[k] ?? 0} className="font-display text-2xl font-semibold" />
                  </span>
                </Card>
              </BlurFade>
            ))}
          </section>

          <BlurFade delay={0.15}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Workflow className="h-5 w-5 text-primary" aria-hidden="true" /><h2 className="text-lg font-semibold">Workflow stages</h2></CardTitle>
                <CardDescription>The deployed BPMN model. Badges show how many requests are at each step right now. Examination steps run once per subject.</CardDescription>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<Spinner label="Loading diagram…" />}>
                  <ProcessDiagram url="/process-view/definition" counts={d.elements} height={440} />
                </Suspense>
              </CardContent>
            </Card>
          </BlurFade>

          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap justify-between items-end gap-3">
              <h2 className="text-lg font-semibold">Requests in the workflow</h2>
              <Tabs value={filter} onValueChange={setFilter}>
                <TabsList aria-label="Filter requests">
                  {FILTERS.map(([k, label]) => <TabsTrigger key={k} value={k}>{label}</TabsTrigger>)}
                </TabsList>
              </Tabs>
            </div>
            {rows.length === 0 ? (
              <EmptyState title="No requests here" icon={Inbox}>Requests appear as soon as a student submits one.</EmptyState>
            ) : (
              <Card className="overflow-hidden">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead>Request</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Current step</TableHead>
                      <TableHead>Waiting on</TableHead>
                      <TableHead>Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.requestId} className="align-top">
                        <TableCell>
                          <Link to={`/requests/${r.requestId}`} className="font-mono font-medium text-primary hover:underline">{r.requestId}</Link>
                          <div className="text-[12.5px] text-muted-foreground">{r.studentName} · {r.examSession} · {r.subjectCount} subject{r.subjectCount > 1 ? 's' : ''}</div>
                        </TableCell>
                        <TableCell>
                          <StatusChip status={r.status} />
                          {r.incidents > 0 && <div className="mt-1 text-[12.5px] font-semibold text-pen">{r.incidents} incident{r.incidents > 1 ? 's' : ''}</div>}
                        </TableCell>
                        <TableCell><Progress stages={r.stages} status={r.status} /></TableCell>
                        <TableCell>{r.currentSteps?.length ? r.currentSteps.join(', ') : <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>
                          {r.openTasks?.length ? (
                            <ul className="m-0 flex list-none flex-col gap-1 p-0">
                              {r.openTasks.map((t) => (
                                <li key={t.key}>
                                  <Badge variant="secondary" className="font-normal">
                                    {t.subjectCode && <span className="mr-1 font-mono">{t.subjectCode} ·</span>}
                                    {t.assignee || t.candidateGroups.join(', ')}
                                  </Badge>
                                </li>
                              ))}
                            </ul>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{fmtDateTime(r.updatedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </section>
        </>
      )}
    </>
  );
}

function Progress({ stages, status }) {
  if (!stages?.length) {
    return <span className="text-[13px] text-muted-foreground">{status === 'COMPLETED' ? 'All stages done' : ENDED.includes(status) ? 'Ended early' : 'Waiting for live data'}</span>;
  }
  const done = stages.filter((s) => s.state === 'done').length;
  const current = stages.find((s) => s.state === 'active' || s.state === 'incident' || s.state === 'stopped');
  return (
    <div className="flex min-w-[160px] flex-col gap-1.5">
      <div className="flex gap-1" aria-hidden="true">
        {stages.map((s) => <span key={s.key} title={`${s.label}: ${s.state}`} className={cn('h-1.5 flex-1 rounded-full', STAGE_BAR[s.state] || 'bg-border')} />)}
      </div>
      <span className="text-[12.5px] text-foreground/80">{done} of {stages.length} stages{current ? ` · ${current.label}` : ''}</span>
    </div>
  );
}
