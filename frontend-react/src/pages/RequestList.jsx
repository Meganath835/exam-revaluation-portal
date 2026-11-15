import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronRight, FilePlus2, FolderOpen } from 'lucide-react';
import { api, fmtDateTime, rupees } from '../api/client';
import { isStudent, useAuth } from '../auth/AuthContext';
import { EmptyState, ErrorBox, PageHeader, STATUS, Spinner, StatusChip } from '../components/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BlurFade } from '@/components/magicui/blur-fade';

export default function RequestList() {
  const { user } = useAuth();
  const student = isStudent(user);
  const [filter, setFilter] = useState('');
  const q = useQuery({ queryKey: ['requests'], queryFn: () => api('/requests'), refetchInterval: 5000 });
  const rows = (q.data || []).filter((r) => !filter || r.status === filter);

  return (
    <>
      <PageHeader
        title={student ? 'My requests' : 'All requests'}
        actions={student && (
          <Button asChild>
            <Link to="/requests/new" className="no-underline"><FilePlus2 /> New request</Link>
          </Button>
        )}
      >
        {!student && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Status
            <select className="input max-w-[240px]" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">All</option>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </label>
        )}
      </PageHeader>
      {q.isLoading && <Spinner />}
      <ErrorBox error={q.error} />
      {q.data && rows.length === 0 && (
        <EmptyState title={student ? 'No requests yet' : 'No requests match'} icon={FolderOpen}>
          {student ? <>Start one from <Link to="/requests/new" className="text-primary underline">New request</Link>. Each subject you add is revalued by two independent examiners.</> : 'Try another status filter.'}
        </EmptyState>
      )}
      {rows.length > 0 && (
        <BlurFade delay={0.05}>
          <Card className="overflow-hidden">
            <Table className="min-w-[680px]">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>Request</TableHead>
                  {!student && <TableHead>Student</TableHead>}
                  <TableHead>Session</TableHead>
                  <TableHead className="text-right">Subjects</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-8"><span className="sr-only">Open</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className="group">
                    <TableCell><Link to={`/requests/${r.id}`} className="font-mono font-medium text-primary hover:underline">{r.id}</Link></TableCell>
                    {!student && <TableCell>{r.studentName} <span className="font-mono text-xs text-muted-foreground">{r.studentId}</span></TableCell>}
                    <TableCell>{r.examSession}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.subjectCount}</TableCell>
                    <TableCell className="text-right font-mono">{rupees(r.totalFeePaise)}</TableCell>
                    <TableCell><StatusChip status={r.status} /></TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{fmtDateTime(r.updatedAt)}</TableCell>
                    <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </BlurFade>
      )}
    </>
  );
}
