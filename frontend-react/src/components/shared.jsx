// Small shared building blocks used across pages, built on shadcn/ui and Magic UI.
import { AlertCircle, Inbox, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { BlurFade } from '@/components/magicui/blur-fade';
import { cn } from '@/lib/utils';

export const STATUS = {
  SUBMITTED: { label: 'Submitted', cls: 'border-transparent bg-secondary text-secondary-foreground' },
  AWAITING_VERIFICATION: { label: 'Being verified', cls: 'border-transparent bg-secondary text-secondary-foreground' },
  AWAITING_PAYMENT: { label: 'Payment due', cls: 'border-transparent bg-warn-soft text-warn' },
  UNDER_REVALUATION: { label: 'Under revaluation', cls: 'border-transparent bg-brand-soft text-brand' },
  AWAITING_APPROVAL: { label: 'Awaiting HOD and CoE approval', cls: 'border-transparent bg-warn-soft text-warn' },
  RESULTS_READY: { label: 'Results being published', cls: 'border-transparent bg-brand-soft text-brand' },
  COMPLETED: { label: 'Completed', cls: 'border-transparent bg-ok-soft text-ok' },
  REJECTED: { label: 'Not accepted', cls: 'border-transparent bg-pen-soft text-pen' },
  CLOSED_UNPAID: { label: 'Closed: not paid', cls: 'border-transparent bg-muted text-muted-foreground' },
  CLOSED_PAYMENT_FAILED: { label: 'Closed: payment failed', cls: 'border-transparent bg-pen-soft text-pen' },
};

export function StatusChip({ status }) {
  const s = STATUS[status] || { label: status, cls: 'bg-muted text-muted-foreground' };
  return <Badge variant="outline" className={cn('whitespace-nowrap', s.cls)}>{s.label}</Badge>;
}

export function PageHeader({ title, children, back, actions }) {
  return (
    <BlurFade>
      <header className="flex flex-col gap-2">
        {back}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <h1 className="text-[28px] sm:text-[32px] font-semibold leading-tight text-brand-dark dark:text-foreground">{title}</h1>
            <span aria-hidden="true" className="h-1 w-12 rounded-full bg-gold" />
          </div>
          {actions}
        </div>
        {children}
      </header>
    </BlurFade>
  );
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground py-8" role="status">
      <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
      {label}
    </div>
  );
}

export function EmptyState({ title, children, icon: Icon = Inbox }) {
  return (
    <Card className="p-10 text-center flex flex-col gap-2 items-center border-dashed shadow-none">
      <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="font-display text-lg font-semibold">{title}</p>
      <div className="text-sm text-muted-foreground max-w-md">{children}</div>
    </Card>
  );
}

export function ErrorBox({ error, title = 'Something went wrong' }) {
  if (!error) return null;
  return (
    <Alert variant="destructive" className="bg-pen-soft/60">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  );
}

export function Field({ label, htmlFor, error, help, children }) {
  return (
    <div className="flex flex-col gap-2">
      {label && <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
      {help && !error && <span className="help">{help}</span>}
      {error && <span className="err">{error}</span>}
    </div>
  );
}

export function KeyValue({ items }) {
  return (
    <dl className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-x-5 gap-y-3 text-sm">
      {items.map(([k, v]) => (
        <div key={k} className="flex flex-col gap-0.5 min-w-0">
          <dt className="text-xs text-muted-foreground">{k}</dt>
          <dd className="m-0 break-words font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
