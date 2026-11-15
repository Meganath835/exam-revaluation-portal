// Magic UI: BlurFade (adapted for Tailwind 3). Fades content in with a short blur and lift.
import { useRef } from 'react';
import { AnimatePresence, motion, useInView } from 'motion/react';

export function BlurFade({ children, className, duration = 0.4, delay = 0, offset = 6, inView = false, blur = '6px' }) {
  const ref = useRef(null);
  const seen = useInView(ref, { once: true, margin: '-50px' });
  const visible = !inView || seen;
  return (
    <AnimatePresence>
      <motion.div
        ref={ref}
        initial={{ y: offset, opacity: 0, filter: `blur(${blur})` }}
        animate={visible ? { y: 0, opacity: 1, filter: 'blur(0px)' } : undefined}
        transition={{ delay: 0.04 + delay, duration, ease: 'easeOut' }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
