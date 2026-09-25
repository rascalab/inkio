import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * State whose updates are debounced: `push` buffers the latest value and
 * flushes it `delay` ms after the last call. Editor previews use this so
 * fast typing causes zero React re-renders — only ProseMirror's own DOM
 * update runs per keystroke.
 *
 * Mount-keyed contract: `initial` seeds state once (useState semantics).
 * Pass a `key` to remount when the seed changes; a pending buffer is
 * intentionally dropped on unmount because the editor document itself
 * owns the typed content — this state only feeds read-only previews.
 */
export function useDebouncedState<T>(initial: T, delay = 350): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(initial);
  const pendingRef = useRef<T>(initial);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = useCallback(
    (next: T) => {
      pendingRef.current = next;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setValue(pendingRef.current);
      }, delay);
    },
    [delay],
  );

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
    [],
  );

  return [value, push];
}
