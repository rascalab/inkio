import { useCallback, useEffect, useRef } from 'react';
import type { Editor as TiptapEditor, JSONContent } from '@tiptap/react';

/**
 * Turn a `(json) => void` update listener into a tiptap `onUpdate` handler
 * that is cheap on hot paths:
 *
 * - no listener → returns immediately (no `getJSON()` serialization);
 * - a burst of synchronous updates (one keystroke's transactions, a batch of
 *   remote Yjs frames) serializes the doc once, in a microtask, with the
 *   latest state — earlier queued emits are superseded by a token;
 * - nothing is emitted after unmount or once the editor is destroyed.
 *
 * The returned handler has a stable identity and always calls the newest
 * listener.
 */
export function useCoalescedDocUpdate(
  onUpdate: ((content: JSONContent) => void) | undefined,
): (editor: TiptapEditor) => void {
  const onUpdateRef = useRef(onUpdate);
  const isMountedRef = useRef(true);
  const tokenRef = useRef(0);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return useCallback((editor: TiptapEditor) => {
    if (!onUpdateRef.current) {
      return;
    }

    const token = ++tokenRef.current;
    queueMicrotask(() => {
      if (token !== tokenRef.current) return;
      if (isMountedRef.current && !editor.isDestroyed) {
        onUpdateRef.current?.(editor.getJSON());
      }
    });
  }, []);
}
