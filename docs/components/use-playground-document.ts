import type { InkioJSONContent, TiptapEditor } from '@inkio/core';
import { useEffect, useRef, useState } from 'react';

export function usePlaygroundDocument(editor: TiptapEditor | null, enabled: boolean) {
  const [snapshot, setSnapshot] = useState<InkioJSONContent | null>(null);
  const lastDocument = useRef<TiptapEditor['state']['doc'] | null>(null);

  useEffect(() => {
    if (!editor || !enabled) return;

    let timer: number | undefined;

    const schedule = () => {
      clearTimeout(timer);
      if (document.hidden || editor.isDestroyed || editor.state.doc === lastDocument.current) return;

      timer = window.setTimeout(() => {
        if (document.hidden || editor.isDestroyed || editor.state.doc === lastDocument.current) return;
        lastDocument.current = editor.state.doc;
        setSnapshot(editor.getJSON());
      }, 350);
    };

    // Subscribe to the editor directly so its eager JSON callback is never used.
    editor.on('update', schedule);
    document.addEventListener('visibilitychange', schedule);
    schedule();

    return () => {
      clearTimeout(timer);
      editor.off('update', schedule);
      document.removeEventListener('visibilitychange', schedule);
    };
  }, [editor, enabled]);

  return snapshot;
}
