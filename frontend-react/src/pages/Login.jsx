import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BadgeCheck, ClipboardCheck, GraduationCap, ScanSearch, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { api } from '../api/client';
import { ROLE_LABEL, useAuth } from '../auth/AuthContext';
import { ErrorBox, Spinner } from '../components/shared';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { AnimatedShinyText } from '@/components/magicui/animated-shiny-text';
import { BlurFade } from '@/components/magicui/blur-fade';
import { DotPattern } from '@/components/magicui/dot-pattern';
import { ShimmerButton } from '@/components/magicui/shimmer-button';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme';

const ROLE_HINT = {
  STUDENT: 'Submit requests, pay, track progress and results',
  EXAM_CELL: 'Verify applications, assign examiners, update results, process view',
  EXAMINER: 'Re-evaluate assigned answer scripts',
  COE: 'Final approval of revised results',
};

/** Sign-in list, grouped so each role in the workflow is easy to find. */
const GROUPS = [
  ['Student', ['STUDENT'], UserRound],
  ['Exam cell', ['EXAM_CELL'], ClipboardCheck],
  ['Examiners', ['EXAMINER'], ScanSearch],
  ['Approver', ['COE'], ShieldCheck],
];

const STEPS = [
  'Student submits and the exam cell verifies the application',
  'Fee paid securely with Razorpay',
  'Two independent, blind examiners per subject',
  'Controller of Examinations approves any increase',
];

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const users = useQuery({ queryKey: ['users'], queryFn: () => api('/users') });
  const [picked, setPicked] = useState('21CS042');
  const chosen = users.data?.find((u) => u.username === picked);

  return (
    <div className="min-h-screen grid lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
      {/* Hero */}
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-brand-dark via-brand-dark to-brand dark:from-[#111111] dark:via-[#171717] dark:to-[#232323] text-white lg:flex flex-col justify-between p-12">
        <DotPattern className="fill-white/15 [mask-image:radial-gradient(560px_circle_at_30%_30%,white,transparent)]" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold text-gold-foreground shadow-md">
            <GraduationCap className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="flex flex-col">
            <span className="font-display text-lg font-semibold">Revaluation Portal</span>
            <span className="text-[13px] text-white/70">Office of the Controller of Examinations</span>
          </div>
        </div>
        <BlurFade delay={0.1} className="relative flex max-w-lg flex-col gap-5">
          <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
            <AnimatedShinyText className="text-white/80 via-gold">Automated with Camunda 8 BPMN</AnimatedShinyText>
          </div>
          <h2 className="text-4xl font-semibold leading-tight">Answer-script revaluation, from request to result, in one workflow.</h2>
          <span aria-hidden="true" className="h-1 w-16 rounded-full bg-gold" />
          <ul className="flex flex-col gap-3">
            {STEPS.map((s, i) => (
              <BlurFade key={s} delay={0.2 + i * 0.08}>
                <li className="flex items-start gap-3 text-[15px] text-white/85">
                  <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-gold" aria-hidden="true" /> {s}
                </li>
              </BlurFade>
            ))}
          </ul>
        </BlurFade>
        <p className="relative text-xs text-white/60">Demo build · seeded users, no passwords</p>
      </section>

      {/* Sign-in */}
      <section className="relative flex items-start justify-center px-4 py-10 sm:py-14 lg:border-l lg:bg-card">
        <ThemeToggle className="absolute right-4 top-4" />
        <BlurFade className="w-full max-w-[480px]">
          <Card className="border-0 bg-transparent shadow-none">
            <CardHeader className="px-0 sm:px-6">
              <h1 className="text-[28px] font-semibold leading-tight">Sign in</h1>
              <CardDescription>Demo mode: choose a seeded user. No password is needed.</CardDescription>
            </CardHeader>
            <CardContent className="px-0 sm:px-6">
              {users.isLoading && <Spinner label="Loading users…" />}
              <ErrorBox error={users.error} title="Can't load users" />
              {users.data && (
                <form
                  className="flex flex-col gap-6"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!chosen) return;
                    signIn(chosen);
                    navigate(chosen.role === 'STUDENT' ? '/requests' : '/tasks');
                  }}
                >
                  <fieldset className="flex flex-col gap-4 border-0 p-0 m-0">
                    <legend className="sr-only">Sign in as</legend>
                    {GROUPS.map(([label, roles, Icon]) => {
                      const list = users.data.filter((u) => roles.includes(u.role));
                      if (!list.length) return null;
                      return (
                        <div key={label} className="flex flex-col gap-2">
                          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {label}
                          </span>
                          {list.map((u) => (
                            <label
                              key={u.username}
                              className={cn(
                                'flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-3 transition-all',
                                picked === u.username ? 'border-primary bg-accent shadow-sm ring-1 ring-primary' : 'bg-card hover:border-primary/40 hover:bg-muted/60',
                              )}
                            >
                              <input type="radio" name="user" value={u.username} checked={picked === u.username} onChange={() => setPicked(u.username)} className="h-4 w-4 accent-brand" />
                              <span className="flex min-w-0 flex-1 flex-col">
                                <span className="text-[15px] font-semibold">{u.displayName}</span>
                                <span className="text-[13px] text-muted-foreground">{ROLE_LABEL[u.role]} · {ROLE_HINT[u.role]}</span>
                              </span>
                              <span className="font-mono text-xs text-muted-foreground">{u.username}</span>
                            </label>
                          ))}
                        </div>
                      );
                    })}
                  </fieldset>
                  <ShimmerButton type="submit" disabled={!chosen} background="#fdc80a" shimmerColor="#ffffff" className="w-full gap-2 text-[15px] font-semibold !text-gold-foreground">
                    Continue as {chosen?.displayName || '…'} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </ShimmerButton>
                  <p className="text-center text-xs text-muted-foreground">In production this screen is replaced by the university's single sign-on.</p>
                </form>
              )}
            </CardContent>
          </Card>
        </BlurFade>
      </section>
    </div>
  );
}
