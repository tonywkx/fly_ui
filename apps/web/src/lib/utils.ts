import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/** Our font-size tokens (theme.css `--text-*`): without them `text-caption` reads as a colour and loses to `text-ash`. */
const twMerge = extendTailwindMerge({
  extend: { theme: { text: ['caption', 'label', 'body', 'heading-sm', 'heading-lg', 'display'] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
