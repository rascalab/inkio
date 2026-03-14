import { useEditor, type Editor as TiptapEditor, type Extensions, type JSONContent } from '@tiptap/react';
import { useEffect, useMemo, useRef } from 'react';
import type { InkioAdapter } from '../adapter';
import type { DefaultExtensionsFactory } from '../context/InkioProvider';
import { getExtensions } from '../extensions/defaults';
import type { InkioExtensionRegistry } from '../extensions/registry';

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
  extensionRegistry?: InkioExtensionRegistry;
  adapter?: InkioAdapter;
  /** Factory that returns the full extension set when adapter is provided. */
  getDefaultExtensions?: DefaultExtensionsFactory;
  placeholder?: string;
  editable?: boolean;
  className?: string;
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
  extensionRegistry,
  adapter,
  getDefaultExtensions,
  placeholder,
  editable = true,
  className = '',
  onUpdate,
  onCreate,
}: UseInkioEditorOptions = {}) {
  if (content !== undefined && initialContent !== undefined) {
    throw new Error('Inkio Editor: `content` and `initialContent` cannot be used together.');
  }

  const isControlled = content !== undefined;
  const startContent = isControlled ? content : (initialContent ?? '');

  const finalExtensions = useMemo(() => {
    // Consumer-provided extensions take priority
    if (extensions.length > 0) {
      return extensions;
    }

    // When adapter + getDefaultExtensions factory: use full extension set
    if (adapter && getDefaultExtensions) {
      return getDefaultExtensions(adapter);
    }

    // Fallback: core extensions + optional registry
    return [
      ...getExtensions({ placeholder }),
      ...(extensionRegistry?.getExtensions() ?? []),
    ] as Extensions;
  }, [adapter, extensions, extensionRegistry, placeholder, getDefaultExtensions]);

  const lastReportedJsonRef = useRef<JSONContent | null>(null);
  const onCreateRef = useRef(onCreate);
  const onUpdateRef = useRef(onUpdate);
  const adapterOnCreateRef = useRef(adapter?.onCreate);
  const adapterOnUpdateRef = useRef(adapter?.onUpdate);
  const isMountedRef = useRef(true);

  useEffect(() => {
    onCreateRef.current = onCreate;
  }, [onCreate]);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    adapterOnCreateRef.current = adapter?.onCreate;
  }, [adapter?.onCreate]);

  useEffect(() => {
    adapterOnUpdateRef.current = adapter?.onUpdate;
  }, [adapter?.onUpdate]);

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
        class: className,
      },
    },
    onCreate: ({ editor: editorInstance }) => {
      onCreateRef.current?.(editorInstance);
      adapterOnCreateRef.current?.(editorInstance);
    },
    onUpdate: ({ editor: editorInstance }) => {
      if (!onUpdateRef.current && !adapterOnUpdateRef.current) {
        return;
      }

      queueMicrotask(() => {
        if (isMountedRef.current && !editorInstance.isDestroyed) {
          const updatedContent = editorInstance.getJSON();
          lastReportedJsonRef.current = updatedContent;
          onUpdateRef.current?.(updatedContent);
          adapterOnUpdateRef.current?.(updatedContent);
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
