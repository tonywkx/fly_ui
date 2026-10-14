import { useCallback, useSyncExternalStore } from 'react';

const QUERY = '(width >= 48rem)';

/** Whether a media query matches, kept in sync with resizes. */
export function useMedia(query: string): boolean {
  const subscribe = useCallback(
    (on: () => void) => {
      const m = matchMedia(query);
      m.addEventListener('change', on);
      return () => m.removeEventListener('change', on);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => matchMedia(query).matches);
}

/** Desktop layout (Tailwind's `md`): the phone gets its own chrome, not just hidden copies. */
export function useWide(): boolean {
  return useMedia(QUERY);
}
