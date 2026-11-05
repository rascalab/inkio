import type { Editor as TiptapEditor, JSONContent } from '@tiptap/react';
import { useCallback, useRef } from 'react';

/**
 * Extensions read the locale when the editor is made and tiptap can't swap them
 * afterwards, so a new locale needs a new editor. Spread `key` on the editor and
 * pass it `content` and `onCreate`: the document carries over to the new one.
 */
export function useEditorPerLocale(
  locale: unknown,
  content: string | JSONContent | undefined,
  onCreate?: (editor: TiptapEditor) => void,
) {
  const editorRef = useRef<TiptapEditor | null>(null);
  const key = JSON.stringify(locale) ?? '';
  const carried = useRef({ key, content });
  if (carried.current.key !== key) {
    const editor = editorRef.current;
    carried.current = { key, content: editor && !editor.isDestroyed ? editor.getJSON() : carried.current.content };
  }

  const handleCreate = useCallback(
    (editor: TiptapEditor) => {
      editorRef.current = editor;
      onCreate?.(editor);
    },
    [onCreate],
  );

  return { key, content: carried.current.content, onCreate: handleCreate };
}
