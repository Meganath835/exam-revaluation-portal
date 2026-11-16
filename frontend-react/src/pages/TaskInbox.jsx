import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CalendarClock, CheckCircle2, Hand, Inbox, Search, Undo2, UserCheck, Users } from 'lucide-react';
import { api, fmtDateTime } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { EmptyState, ErrorBox, PageHeader, Spinner } from '../components/shared';
import { useToast } from '../components/Toast';
import TaskForm from '../tasklist/TaskForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BlurFade } from '@/components/magicui/blur-fade';
import { cn } from '@/lib/utils';

/** Blind evaluation: examiners don't get a link to the request (it would show the student). */
const EXAMINER_TASKS = ['examinerSendsMarks'];

const TABS = [
  ['mine', 'My tasks', UserCheck],
  ['group', 'Group tasks', Users],
  ['completed', 'Completed', CheckCircle2],
];

function dueChip(task) {
  if (!task.dueAt) return task.assignee ? null : { text: 'New', cls: 'bg-brand-soft text-brand' };
  const hours = (new Date(task.dueAt) - Date.now()) / 3600000;
  if (hours < 0) return { text: 'Overdue', cls: 'bg-pen-soft text-pen' };
  if (hours < 48) return { text: hours < 1 ? 'Due in < 1 h' : `Due in ${Math.round(hours)} h`, cls: 'bg-warn-soft text-warn' };
  return { text: `Due ${new Date(task.dueAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`, cls: 'bg-muted text-muted-foreground' };
}

export default function TaskInbox() {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const hasGroups = (user.groups || []).length > 0;
  const [tab, setTab] = useState('mine');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [selectedKey, setSelectedKey] = useState(null);

  const q = useQuery({ queryKey: ['tasks', tab], queryFn: () => api(`/tasks?view=${tab}`), refetchInterval: tab === 'completed' ? false : 4000 });
  const counts = {
    mine: useQuery({ queryKey: ['tasks', 'mine'], queryFn: () => api('/tasks?view=mine'), refetchInterval: 4000 }).data?.length,
    group: useQuery({ queryKey: ['tasks', 'group'], queryFn: () => api('/tasks?view=group'), refetchInterval: 4000, enabled: hasGroups }).data?.length,
  };

  const tasks = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (q.data || []).filter(
      (t) => (!type || t.elementId === type) && (!s || [t.name, t.requestId, t.subjectCode, t.subjectName, t.context?.subject?.scriptId].some((x) => x && String(x).toLowerCase().includes(s))),
    );
  }, [q.data, search, type]);
  const types = useMemo(() => [...new Map((q.data || []).map((t) => [t.elementId, t.name])).entries()], [q.data]);
  const selected = tasks.find((t) => t.key === selectedKey) || tasks[0];

  const claim = useMutation({
    mutationFn: ({ key, action }) => api(`/tasks/${key}/${action}`, { method: 'POST' }),
    onSuccess: (_, { action }) => {
      toast(action === 'claim' ? 'Task claimed. It is now in My tasks.' : 'Task released to the group.');
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (e) => toast(e.message, 'error'),
  });

  return (
    <>
      <PageHeader title="Task inbox">
        <div className="flex flex-wrap gap-2.5">
          <label className="relative flex flex-col gap-1 text-xs text-muted-foreground">
            Search
            <Search className="pointer-events-none absolute bottom-3 left-3 h-4 w-4" aria-hidden="true" />
            <Input type="search" className="h-10 w-64 max-w-full pl-9" placeholder="Request, subject or script ID" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Task type
            <select className="input h-10" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All types</option>
              {types.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
        </div>
      </PageHeader>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); setSelectedKey(null); }}>
        <TabsList aria-label="Task views" className="h-10">
          {TABS.filter(([k]) => k !== 'group' || hasGroups).map(([k, label, Icon]) => (
            <TabsTrigger key={k} value={k} className="gap-1.5 px-3">
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
              {counts[k] !== undefined && <span className="ml-0.5 rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">{counts[k]}</span>}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {q.isLoading && <Spinner label="Loading tasks…" />}
      <ErrorBox error={q.error} title="Can't load tasks" />
      {q.data && tasks.length === 0 && (
        <EmptyState title={tab === 'completed' ? 'Nothing completed yet' : 'No tasks right now'} icon={tab === 'completed' ? CheckCircle2 : Inbox}>
          {tab === 'mine' && hasGroups ? 'Check Group tasks for work you can claim.' : 'New tasks appear here automatically.'}
        </EmptyState>
      )}

      {tasks.length > 0 && (
        <div className="flex flex-wrap gap-4 items-start">
          <ul className="flex-[1_1_300px] min-w-0 list-none m-0 p-0 flex flex-col gap-2">
            {tasks.map((t, i) => {
              const due = dueChip(t);
              const active = selected?.key === t.key;
              return (
                <li key={t.key}>
                  <BlurFade delay={Math.min(i, 8) * 0.03}>
                    <button type="button" onClick={() => setSelectedKey(t.key)} aria-current={active}
                      className={cn(
                        'w-full text-left rounded-lg border bg-card px-4 py-3.5 flex flex-col gap-1.5 shadow-sm transition-all',
                        active ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/40 hover:shadow',
                      )}>
                      <span className="flex justify-between gap-2 items-start">
                        <span className="font-semibold text-[15px] leading-snug">{t.name}</span>
                        {due && <Badge variant="outline" className={cn('shrink-0 border-transparent', due.cls)}>{due.text}</Badge>}
                      </span>
                      <span className="font-mono text-[13px] text-muted-foreground">{t.requestId}{t.subjectCode ? ` · ${t.subjectCode}` : ''}</span>
                      <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                        {t.state === 'COMPLETED' ? <CheckCircle2 className="h-3.5 w-3.5 text-ok" aria-hidden="true" /> : t.assignee ? <UserCheck className="h-3.5 w-3.5" aria-hidden="true" /> : <Users className="h-3.5 w-3.5" aria-hidden="true" />}
                        {t.state === 'COMPLETED' ? 'Completed' : t.assignee ? (t.assignee === user.username ? 'Assigned to you' : `Claimed by ${t.assignee}`) : `${t.candidateGroups.join(', ')} · claim to start`}
                      </span>
                    </button>
                  </BlurFade>
                </li>
              );
            })}
          </ul>

          {selected && (
            <Card className="flex-[999_1_440px] min-w-0">
              <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                <div className="flex flex-col gap-1">
                  <h2 className="text-xl font-semibold">{selected.name}</h2>
                  <span className="text-sm text-muted-foreground">
                    {selected.subjectCode ? `${selected.subjectCode} · ${selected.subjectName} · ` : ''}
                    {EXAMINER_TASKS.includes(selected.elementId) ? <span className="font-mono">{selected.requestId}</span> : <Link to={`/requests/${selected.requestId}`} className="font-mono text-primary underline">{selected.requestId}</Link>}
                    {' · '}created {fmtDateTime(selected.createdAt)}
                  </span>
                </div>
                {selected.canClaim && <Button disabled={claim.isPending} onClick={() => claim.mutate({ key: selected.key, action: 'claim' })}><Hand /> Claim</Button>}
                {selected.assignee === user.username && selected.candidateGroups.length > 0 && selected.state !== 'COMPLETED' && (
                  <Button variant="outline" disabled={claim.isPending} onClick={() => claim.mutate({ key: selected.key, action: 'unclaim' })}><Undo2 /> Unclaim</Button>
                )}
              </CardHeader>
              <Separator />
              <CardContent className="flex flex-col gap-4 pt-6">
                {selected.dueAt && selected.state !== 'COMPLETED' && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-warn/20 bg-warn-soft px-4 py-3 text-sm text-warn">
                    <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
                    <span><b className="text-warn">Due {fmtDateTime(selected.dueAt)}.</b> The exam cell tracks this deadline in the Process view.</span>
                  </div>
                )}
                {selected.state === 'COMPLETED' ? (
                  <p className="text-sm text-muted-foreground">You completed this task.</p>
                ) : selected.canComplete || selected.elementId === 'completeCheckoutAndVerifyPayment' ? (
                  <TaskForm task={selected} onDone={() => setSelectedKey(null)} />
                ) : (
                  <p className="text-sm text-muted-foreground">Claim this task to work on it.</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
