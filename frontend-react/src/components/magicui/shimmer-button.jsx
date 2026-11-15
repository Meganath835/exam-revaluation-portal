// Magic UI: ShimmerButton (Tailwind 3 version). A button with a light sweeping around its edge.
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export const ShimmerButton = forwardRef(function ShimmerButton(
  { shimmerColor = '#ffffff', shimmerSize = '0.05em', shimmerDuration = '3s', borderRadius = '10px', background = '#0b2a55', className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      style={{ '--spread': '90deg', '--shimmer-color': shimmerColor, '--radius': borderRadius, '--speed': shimmerDuration, '--cut': shimmerSize, '--bg': background }}
      className={cn(
        'group relative z-0 flex cursor-pointer items-center justify-center overflow-hidden whitespace-nowrap border border-white/10 px-6 py-3 text-white [background:var(--bg)] [border-radius:var(--radius)]',
        'transform-gpu transition-transform duration-300 ease-in-out active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    >
      <div className="absolute inset-0 -z-30 overflow-visible blur-[2px] [container-type:size]">
        <div className="absolute inset-0 h-[100cqh] animate-shimmer-slide [aspect-ratio:1] [border-radius:0] [mask:none]">
          <div className="absolute -inset-full w-auto rotate-0 animate-spin-around [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))] [translate:0_0]" />
        </div>
      </div>
      {children}
      <div className="absolute inset-0 size-full rounded-[inherit] shadow-[inset_0_-8px_10px_#ffffff1f] transition-all duration-300 ease-in-out group-hover:shadow-[inset_0_-6px_10px_#ffffff3f] group-active:shadow-[inset_0_-10px_10px_#ffffff3f]" />
      <div className="absolute -z-20 [background:var(--bg)] [border-radius:var(--radius)] [inset:var(--cut)]" />
    </button>
  );
});
