import type { Editor as TiptapEditor, JSONContent } from '@tiptap/react';
import { useEffect, useRef } from 'react';
import { isEqualStaticContent } from '../components/Editor';

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
  const appliedRef = useRef(content);

  useEffect(() => {
    if (!editor || editor.isDestroyed || editor.isEditable) return;
    if (isEqualStaticContent(appliedRef.current, content)) return;
    appliedRef.current = content;
    editor.commands.setContent(content ?? '');
  }, [editor, content]);
}
