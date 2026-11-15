import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merges Tailwind classes (shadcn/ui convention). */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
