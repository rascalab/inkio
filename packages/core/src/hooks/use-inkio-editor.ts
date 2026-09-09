import { useEditor, type Editor as TiptapEditor, type Extensions, type JSONContent } from '@tiptap/react';
import { useEffect, useMemo, useRef } from 'react';
import { resolveInkioExtensions } from '../extensions/resolve-extensions';

type InkioContentMode =
  | {
      content: string | JSONContent;
      initialContent?: never;
    }
  | {
      content?: never;
      initialContent?: string | JSONContent;
    };

export type UseInkioEditorOptions = InkioContentMode & {
  extensions?: Extensions;
  placeholder?: string;
  editable?: boolean;
  onUpdate?: (content: JSONContent) => void;
  onCreate?: (editor: TiptapEditor) => void;
};

const EMPTY_EXTENSIONS: Extensions = [];

function isSameJson(a: JSONContent | undefined, b: JSONContent | undefined) {
  if (a === b) return true;
  if (!a || !b) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export function useInkioEditor({
  content,
  initialContent,
  extensions = EMPTY_EXTENSIONS,
  placeholder,
  editable = true,
  onUpdate,
  onCreate,
}: UseInkioEditorOptions = {}) {
  if (content !== undefined && initialContent !== undefined) {
    throw new Error('Inkio Editor: `content` and `initialContent` cannot be used together.');
  }

  const isControlled = content !== undefined;
  const startContent = isControlled ? content : (initialContent ?? '');

  const finalExtensions = useMemo(() => {
    return resolveInkioExtensions(extensions, placeholder);
  }, [extensions, placeholder]);

  const lastReportedJsonRef = useRef<JSONContent | null>(null);
  const lastReportedHtmlRef = useRef<string | null>(null);
  const onCreateRef = useRef(onCreate);
  const onUpdateRef = useRef(onUpdate);
  const isMountedRef = useRef(true);
  const syncTokenRef = useRef(0);

  useEffect(() => {
    onCreateRef.current = onCreate;
  }, [onCreate]);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: finalExtensions,
    content: startContent,
    editable,
    editorProps: {
      attributes: {
        class: 'inkio-content',
      },
    },
    onCreate: ({ editor: editorInstance }) => {
      onCreateRef.current?.(editorInstance);
    },
    onUpdate: ({ editor: editorInstance }) => {
      if (!onUpdateRef.current) {
        return;
      }

      const token = ++syncTokenRef.current;
      queueMicrotask(() => {
        if (token !== syncTokenRef.current) return;
        if (isMountedRef.current && !editorInstance.isDestroyed) {
          const updatedContent = editorInstance.getJSON();
          lastReportedJsonRef.current = updatedContent;
          lastReportedHtmlRef.current = null;
          onUpdateRef.current?.(updatedContent);
        }
      });
    },
  });

  useEffect(() => {
    if (!isControlled || !editor) {
      return;
    }

    // String content (HTML) must be compared against HTML, not JSON.
    // Comparing string to getJSON() always mismatches and causes a setContent loop.
    if (typeof content === 'string') {
      if (content === lastReportedHtmlRef.current) return;
      let currentHtml: string;
      try {
        currentHtml = editor.getHTML();
      } catch {
        return;
      }
      if (content === currentHtml) {
        lastReportedHtmlRef.current = content;
        return;
      }
      const token = ++syncTokenRef.current;
      const next = content;
      queueMicrotask(() => {
        if (token !== syncTokenRef.current) return;
        if (isMountedRef.current && !editor.isDestroyed) {
          lastReportedHtmlRef.current = next;
          lastReportedJsonRef.current = null;
          editor.commands.setContent(next, { emitUpdate: false });
        }
      });
      return;
    }

    const editorJson = editor.getJSON();
    if (isSameJson(content, lastReportedJsonRef.current ?? undefined) || isSameJson(content, editorJson)) {
      return;
    }

    const token = ++syncTokenRef.current;
    const next = content;
    queueMicrotask(() => {
      if (token !== syncTokenRef.current) return;
      if (isMountedRef.current && !editor.isDestroyed && next !== undefined) {
        editor.commands.setContent(next, { emitUpdate: false });
      }
    });
  }, [content, editor, isControlled]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  return editor;
}
