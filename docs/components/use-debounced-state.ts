import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * State whose updates are debounced: `push` buffers the latest value and
 * flushes it `delay` ms after the last call. Editor previews use this so
 * fast typing causes zero React re-renders — only ProseMirror's own DOM
 * update runs per keystroke.
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
