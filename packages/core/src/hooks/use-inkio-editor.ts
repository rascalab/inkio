import { useEditor, type Editor as TiptapEditor, type Extensions, type JSONContent } from '@tiptap/react';
import { useEffect, useMemo, useRef } from 'react';
import { resolveInkioExtensions } from '../extensions/resolve-extensions';
import { useCoalescedDocUpdate } from './use-coalesced-doc-update';

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
  const emitUpdate = useCoalescedDocUpdate(onUpdate);

  useEffect(() => {
    onCreateRef.current = onCreate;
  }, [onCreate]);

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
    onUpdate: ({ editor: editorInstance, transaction, appendedTransactions }) => {
      // setEditable also emits 'update' (with an empty transaction) and some
      // internals listen for that; only document changes reach onUpdate.
      if (!transaction.docChanged && !appendedTransactions.some((tr) => tr.docChanged)) return;
      emitUpdate(editorInstance);
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
