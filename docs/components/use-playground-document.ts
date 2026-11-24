import type { InkioJSONContent, TiptapEditor } from '@inkio/core';
import { useCallback, useEffect, useRef, useState } from 'react';

export function usePlaygroundDocument(editor: TiptapEditor | null, enabled: boolean) {
  const [snapshot, setSnapshot] = useState<InkioJSONContent | null>(null);
  const lastDocument = useRef<TiptapEditor['state']['doc'] | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const schedule = useCallback(() => {
    clearTimeout(timer.current);
    if (!editor || !enabled || document.hidden || editor.isDestroyed || editor.state.doc === lastDocument.current) return;
    timer.current = window.setTimeout(() => {
      if (document.hidden || editor.isDestroyed || editor.state.doc === lastDocument.current) return;
      lastDocument.current = editor.state.doc;
      setSnapshot(editor.getJSON());
    }, 350);
  }, [editor, enabled]);

  useEffect(() => {
    schedule();
    document.addEventListener('visibilitychange', schedule);
    return () => {
      clearTimeout(timer.current);
      document.removeEventListener('visibilitychange', schedule);
    };
  }, [schedule]);

  return { doc: snapshot, onChange: enabled ? schedule : undefined };
}
