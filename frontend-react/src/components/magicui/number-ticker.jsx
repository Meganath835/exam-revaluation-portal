// Magic UI: NumberTicker (adapted for Tailwind 3). Counts up to the value, and on to new values as they change.
import { useEffect, useRef } from 'react';
import { useInView, useMotionValue, useSpring } from 'motion/react';
import { cn } from '@/lib/utils';

export function NumberTicker({ value, className, delay = 0 }) {
  const ref = useRef(null);
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { damping: 60, stiffness: 120 });
  const inView = useInView(ref, { once: true, margin: '0px' });

  useEffect(() => {
    if (!inView) return undefined;
    const t = setTimeout(() => motionValue.set(value), delay * 1000);
    return () => clearTimeout(t);
  }, [motionValue, inView, delay, value]);

  useEffect(() => spring.on('change', (latest) => {
    if (ref.current) ref.current.textContent = Intl.NumberFormat('en-IN').format(Math.round(latest));
  }), [spring]);

  return (
    <span ref={ref} className={cn('inline-block tabular-nums tracking-tight', className)} aria-label={String(value)}>
      0
    </span>
  );
}
