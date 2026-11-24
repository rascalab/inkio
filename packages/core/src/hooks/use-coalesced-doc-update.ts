import { useCallback, useEffect, useRef } from 'react';
import type { Editor as TiptapEditor, JSONContent } from '@tiptap/react';
import { withDocumentAccess, type InkioEditor } from '../editor-document';

/** Notify once per synchronous burst. Only the legacy JSON listener needs serialization. */
export function useCoalescedDocUpdate(
  onUpdate: ((content: JSONContent) => void) | undefined,
  onChange?: (editor: InkioEditor) => void,
): (editor: TiptapEditor) => void {
  const onUpdateRef = useRef(onUpdate);
  const onChangeRef = useRef(onChange);
  const isMountedRef = useRef(true);
  const pending = useRef<TiptapEditor | null>(null);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
    onChangeRef.current = onChange;
  }, [onUpdate, onChange]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return useCallback((editor: TiptapEditor) => {
    if (!onUpdateRef.current && !onChangeRef.current) {
      return;
    }

    const queued = pending.current !== null;
    pending.current = editor;
    if (queued) return;
    queueMicrotask(() => {
      const latest = pending.current!;
      pending.current = null;
      if (isMountedRef.current && !latest.isDestroyed) {
        onChangeRef.current?.(withDocumentAccess(latest));
        if (!latest.isDestroyed) onUpdateRef.current?.(latest.getJSON());
      }
    });
  }, []);
}
