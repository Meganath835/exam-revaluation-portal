// Magic UI: AnimatedShinyText (Tailwind 3 version). Text with a light passing over it.
import { cn } from '@/lib/utils';

export function AnimatedShinyText({ children, className, shimmerWidth = 100 }) {
  return (
    <span
      style={{ '--shiny-width': `${shimmerWidth}px` }}
      className={cn(
        'max-w-md text-muted-foreground',
        'animate-shiny-text bg-clip-text bg-no-repeat [background-position:0_0] [background-size:var(--shiny-width)_100%] [transition:background-position_1s_cubic-bezier(.6,.6,0,1)_infinite]',
        'bg-gradient-to-r from-transparent via-primary/80 via-50% to-transparent',
        className,
      )}
    >
      {children}
    </span>
  );
}
