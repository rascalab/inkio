import { useEditor, type Editor as TiptapEditor, type Extensions, type JSONContent } from '@tiptap/react';
import { useEffect, useMemo, useRef } from 'react';
import { resolveInkioExtensions } from '../extensions/resolve-extensions';

export interface UseInkioEditorOptions {
  /**
   * Initial document only (uncontrolled). The editor owns state after
   * mount; push external values imperatively via the `onCreate` instance
   * (`editor.commands.setContent(...)`).
   */
  content?: string | JSONContent;
  extensions?: Extensions;
  placeholder?: string;
  editable?: boolean;
  onUpdate?: (content: JSONContent) => void;
  onCreate?: (editor: TiptapEditor) => void;
}

let didWarnExtensionsChurn = false;

/**
 * Fired when the resolved `extensions` array identity changes across renders.
 * Tiptap compares extensions by instance identity, so a new array on every
 * render (e.g. inline callbacks/objects in extension options) forces
 * `setOptions` + a full document redraw per keystroke. Memoize extension
 * inputs with `useMemo`/`useCallback` instead.
 */
function warnExtensionsChurn() {
  if (didWarnExtensionsChurn) {
    return;
  }
  didWarnExtensionsChurn = true;
  console.warn(
    '[inkio] Editor extensions were recreated between renders. ' +
      'Pass memoized `extensions` (and stable callbacks/objects in extension options) ' +
      'to avoid a full document redraw on every keystroke.',
  );
}

export function useInkioEditor({
  content = '',
  // No default: undefined means "default extensions" downstream while an
  // explicit [] means a bare document (see resolveInkioExtensions).
  extensions,
  placeholder,
  editable = true,
  onUpdate,
  onCreate,
}: UseInkioEditorOptions = {}) {
  const finalExtensions = useMemo(() => {
    return resolveInkioExtensions(extensions, placeholder);
  }, [extensions, placeholder]);

  const prevExtensionsRef = useRef<Extensions | null>(null);
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
    content,
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
          onUpdateRef.current?.(editorInstance.getJSON());
        }
      });
    },
  });

  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  useEffect(() => {
    const nodeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
      ?.env?.NODE_ENV;
    if (nodeEnv === 'production') {
      return;
    }
    if (!editor) {
      prevExtensionsRef.current = finalExtensions;
      return;
    }
    if (prevExtensionsRef.current !== null && prevExtensionsRef.current !== finalExtensions) {
      warnExtensionsChurn();
    }
    prevExtensionsRef.current = finalExtensions;
  });

  return editor;
}
