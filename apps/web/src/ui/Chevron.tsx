import { cn } from '@/lib/utils';

/** A slot's or a «more» row's disclosure mark, drawn (the font's ▾ reads as a dot at caption size); flips open. */
export function Chevron({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(
        'size-3 shrink-0 transition-transform duration-200 ease-out motion-reduce:transition-none',
        open && 'rotate-180',
        className,
      )}
    >
      <path d="M3 4.5 6 7.5 9 4.5" />
    </svg>
  );
}
