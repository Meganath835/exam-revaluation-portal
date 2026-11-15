import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CreditCard, Loader2, Mail, ReceiptText, ScanSearch, ShieldCheck, Timer, XCircle } from 'lucide-react';
import { api, rupees } from '../api/client';
import { ErrorBox, PageHeader, Spinner } from '../components/shared';
import { useToast } from '../components/Toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BlurFade } from '@/components/magicui/blur-fade';
import { cn } from '@/lib/utils';

const CHECKOUT_JS = 'https://checkout.razorpay.com/v1/checkout.js';

const AFTER_PAYMENT = [
  [ScanSearch, 'The exam cell assigns two independent examiners to each script.'],
  [ShieldCheck, 'Your HOD and the Controller of Examinations approve any increase.'],
  [Mail, 'You get an email when the result is published, and the request page updates live.'],
];

function loadCheckout() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement('script');
    s.src = CHECKOUT_JS;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load Razorpay Checkout. Check your connection.'));
    document.body.appendChild(s);
  });
}

function useCountdown(until) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!until) return null;
  const ms = Math.max(0, new Date(until) - now);
  return { ms, text: `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}` };
}

export default function Payment() {
  const { id } = useParams();
  const toast = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const info = useQuery({
    queryKey: ['payment', id],
    queryFn: () => api(`/requests/${id}/payment`),
    // Right after the eligibility check the checkout task and the Razorpay order take a moment to appear:
    // retry while the task isn't open yet, and poll while the order is still being created.
    retry: 8,
    retryDelay: 1500,
    refetchInterval: (q) => (q.state.data && !q.state.data.razorpayOrderId ? 1500 : false),
  });
  const left = useCountdown(info.data?.payByApprox);
  const [total, setTotal] = useState(null);
  useEffect(() => {
    if (left && total === null && left.ms > 0) setTotal(left.ms);
  }, [left, total]);

  const done = (res) => {
    // The checkout task is complete now, so don't refetch this page's payment info (it would 409).
    qc.removeQueries({ queryKey: ['payment', id] });
    qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'payment' });
    if (res?.status === 'PAID') toast('Payment verified. Your scripts are going to examiners.');
    else toast('The payment could not be verified, so the request was closed.', 'error');
    navigate(`/requests/${id}`);
  };
  const confirm = useMutation({ mutationFn: (body) => api(`/payments/${id}/confirm`, { method: 'POST', body }), onSuccess: done, onError: (e) => toast(e.message, 'error') });
  const mock = useMutation({ mutationFn: (outcome) => api(`/payments/${id}/mock-checkout`, { method: 'POST', body: { outcome } }), onSuccess: done, onError: (e) => toast(e.message, 'error') });

  async function payWithRazorpay() {
    const p = info.data;
    try {
      await loadCheckout();
      const rzp = new window.Razorpay({
        key: p.keyId,
        order_id: p.razorpayOrderId,
        amount: p.amountPaise,
        currency: p.currency,
        name: 'Revaluation fee',
        description: `Request ${p.requestId}`,
        prefill: { name: p.studentName, email: p.studentEmail },
        theme: { color: '#0b5394' },
        handler: (resp) =>
          confirm.mutate({
            razorpayOrderId: resp.razorpay_order_id,
            razorpayPaymentId: resp.razorpay_payment_id,
            razorpaySignature: resp.razorpay_signature,
          }),
      });
      rzp.on('payment.failed', (r) => toast(`Payment failed: ${r.error?.description || 'try again'}`, 'error'));
      rzp.open();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  if (info.isLoading || (info.data && !info.data.razorpayOrderId)) return <Spinner label="Preparing your payment order…" />;
  if (info.error)
    return (
      <>
        <ErrorBox error={info.error} title="Payment isn't available" />
        <Button asChild variant="outline" className="self-start"><Link to={`/requests/${id}`} className="no-underline"><ArrowLeft /> Back to the request</Link></Button>
      </>
    );
  const p = info.data;
  const busy = confirm.isPending || mock.isPending;
  const expired = left && left.ms === 0;
  const tone = expired ? 'text-pen' : 'text-warn';

  return (
    <>
      <PageHeader
        back={<Link to={`/requests/${id}`} className="inline-flex w-fit items-center gap-1 text-[13px] text-primary hover:underline"><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Request {id}</Link>}
        title="Pay the revaluation fee"
      >
        <p className="text-sm text-muted-foreground">The exam cell accepted your application. Pay now to send your scripts to the examiners.</p>
      </PageHeader>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
        <BlurFade delay={0.05}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ReceiptText className="h-5 w-5 text-primary" aria-hidden="true" /><h2 className="text-lg font-semibold">Order summary</h2></CardTitle>
              <CardDescription>
                Order <span className="break-all font-mono text-foreground">{p.razorpayOrderId}</span> · receipt <span className="font-mono text-foreground">{p.requestId}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {left && (
                <div className={cn('flex flex-col gap-2 rounded-lg border px-4 py-3.5', expired ? 'border-pen/30 bg-pen-soft' : 'border-warn/30 bg-warn-soft')}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={cn('flex items-center gap-2 text-sm font-semibold', tone)}><Timer className="h-4 w-4" aria-hidden="true" /> Payment window</span>
                    <span className={cn('font-mono text-2xl font-semibold tabular-nums', tone)}>{expired ? 'Closed' : `${left.text} left`}</span>
                  </div>
                  <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-warn/20">
                    <div className="h-full rounded-full bg-warn" style={{ width: `${total ? (left.ms / total) * 100 : 100}%` }} />
                  </div>
                  <span className={cn('text-[13px]', tone)}>If the timer runs out, the request closes and you can submit a new one.</span>
                </div>
              )}
              <div className="flex flex-col text-sm">
                {p.subjects.map((s) => (
                  <div key={s.subjectCode} className="flex justify-between gap-3 border-b py-3">
                    <span>{s.subjectCode} · {s.subjectName}</span>
                    <span className="font-mono">{rupees(p.amountPaise / p.subjects.length)}</span>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-3 pt-4">
                  <span className="text-base font-semibold">Total</span>
                  <span className="font-mono text-2xl font-semibold">{rupees(p.amountPaise)}</span>
                </div>
              </div>
              {p.mock ? (
                <div className="flex flex-col gap-3 rounded-lg border border-dashed border-primary/50 bg-accent/40 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="outline" className="border-primary/40 text-primary">Test checkout</Badge>
                    <span>Razorpay is in mock mode, so choose how the payment ends.</span>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    <Button type="button" variant="gold" size="lg" className="px-5" disabled={busy || expired} onClick={() => mock.mutate('success')}>
                      {mock.isPending ? <Loader2 className="animate-spin" /> : <CreditCard />} Pay {rupees(p.amountPaise)} (success)
                    </Button>
                    <Button type="button" variant="outline" size="lg" className="border-destructive/40 px-5 text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={busy || expired} onClick={() => mock.mutate('failure')}>
                      <XCircle /> Simulate a failed payment
                    </Button>
                  </div>
                </div>
              ) : (
                <Button type="button" variant="gold" size="lg" className="h-12 text-base" disabled={busy || expired} onClick={payWithRazorpay}>
                  {busy ? <Loader2 className="animate-spin" /> : <CreditCard />}
                  {busy ? 'Submitting…' : `Pay ${rupees(p.amountPaise)} with Razorpay`}
                </Button>
              )}
              <p className="flex items-start gap-2 text-[13px] text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden="true" />
                Our server checks the payment signature before your request moves on. Test mode: no real money is charged.
              </p>
            </CardContent>
          </Card>
        </BlurFade>
        <BlurFade delay={0.12}>
          <Card className="bg-muted/40 shadow-none">
            <CardHeader><h2 className="text-base font-semibold">After you pay</h2></CardHeader>
            <CardContent>
              <ol className="m-0 flex list-none flex-col gap-3.5 p-0 text-sm">
                {AFTER_PAYMENT.map(([Icon, text]) => (
                  <li key={text} className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"><Icon className="h-3.5 w-3.5" aria-hidden="true" /></span>
                    <span className="pt-0.5 text-foreground/80">{text}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </BlurFade>
      </div>
    </>
  );
}
