import { useSyncExternalStore } from 'react';

const QUERY = '(width >= 48rem)';

/** Desktop layout (Tailwind's `md`): the phone gets its own chrome, not just hidden copies. */
export function useWide(): boolean {
  return useSyncExternalStore(
    (on) => {
      const m = matchMedia(QUERY);
      m.addEventListener('change', on);
      return () => m.removeEventListener('change', on);
    },
    () => matchMedia(QUERY).matches,
  );
}
