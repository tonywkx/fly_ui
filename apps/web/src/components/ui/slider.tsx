import { Slider as SliderPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** Single-thumb range: hairline track, violet range, white thumb (keyboard: arrows / PgUp / Home). */
function Slider({
  className,
  label,
  valueText,
  ...props
}: ComponentProps<typeof SliderPrimitive.Root> & { label: string; valueText?: string }) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn('relative flex h-3 touch-none items-center select-none', className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-0.5 grow overflow-hidden rounded-full bg-mist/30">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={label}
        aria-valuetext={valueText}
        className="relative block size-2 cursor-grab before:absolute before:-inset-1 before:content-[''] rounded-full bg-bone outline-none transition-transform duration-150 ease-out hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:cursor-grabbing motion-reduce:transition-none"
      />
    </SliderPrimitive.Root>
  );
}

export { Slider };
