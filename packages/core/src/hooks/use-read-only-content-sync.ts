import type { Editor as TiptapEditor, JSONContent } from '@tiptap/react';
import { useEffect, useRef } from 'react';
import { isEqualStaticContent } from '../utils/static-content';
import { dropUnknownContent } from '../utils/drop-unknown-content';

/**
 * Keeps a read-only editor in step with its `content` prop. Editors read
 * `content` once because user edits own the document after mount, but a
 * viewer has no edits to lose, so it re-renders on prop changes the way
 * `StaticViewer` does. Editable editors are left alone.
 */
export function useReadOnlyContentSync(
  editor: TiptapEditor | null,
  content: string | JSONContent | undefined,
) {
  const applied = useRef<{ editor: TiptapEditor; content: typeof content } | null>(null);

  useEffect(() => {
    if (!editor || editor.isDestroyed || editor.isEditable) return;
    const previous = applied.current?.editor === editor ? applied.current.content : editor.options.content;
    if (!Array.isArray(previous) && isEqualStaticContent(previous ?? undefined, content)) {
      applied.current = { editor, content };
      return;
    }
    let pending = true;
    // React node views render with flushSync, which React refuses inside an effect.
    queueMicrotask(() => {
      if (pending && !editor.isDestroyed && !editor.isEditable) {
        editor.commands.setContent(dropUnknownContent(content ?? '', editor.schema));
        applied.current = { editor, content };
      }
    });
    return () => { pending = false; };
  }, [editor, content]);
}
