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

function isSameContent(a: string | JSONContent | undefined, b: string | JSONContent | undefined) {
  if (typeof a === 'string' || typeof b === 'string') {
    return a === b;
  }

  return JSON.stringify(a) === JSON.stringify(b);
}

export function useInkioEditor({
  content,
  initialContent,
  extensions = [],
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
  const onCreateRef = useRef(onCreate);
  const onUpdateRef = useRef(onUpdate);
  const isMountedRef = useRef(true);

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

      queueMicrotask(() => {
        if (isMountedRef.current && !editorInstance.isDestroyed) {
          const updatedContent = editorInstance.getJSON();
          lastReportedJsonRef.current = updatedContent;
          onUpdateRef.current?.(updatedContent);
        }
      });
    },
  });

  useEffect(() => {
    if (!isControlled || !editor) {
      return;
    }

    const editorJson = editor.getJSON();
    if (isSameContent(content, lastReportedJsonRef.current ?? undefined) || isSameContent(content, editorJson)) {
      return;
    }

    queueMicrotask(() => {
      if (isMountedRef.current && !editor.isDestroyed && content !== undefined) {
        editor.commands.setContent(content, { emitUpdate: false });
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
