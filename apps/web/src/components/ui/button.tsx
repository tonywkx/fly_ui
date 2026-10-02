import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** One `primary` (violet pill) per view; everything else `ghost`. PRODUCT.md §Visual language. */
const buttonVariants = cva(
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-1 whitespace-nowrap text-label outline-none transition-[color,background-color,opacity] duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      variant: {
        primary:
          'h-[45px] rounded-full bg-primary px-[16px] font-semibold uppercase tracking-[0.025em] text-primary-foreground hover:bg-iris/85 active:scale-[0.97]',
        ghost: 'h-6 rounded-md px-1 text-muted-foreground hover:text-foreground',
      },
    },
    defaultVariants: { variant: 'ghost' },
  },
);

function Button({
  className,
  variant,
  asChild = false,
  ...props
}: ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'button';
  return <Comp data-slot="button" className={cn(buttonVariants({ variant }), className)} {...props} />;
}

export { Button, buttonVariants };
