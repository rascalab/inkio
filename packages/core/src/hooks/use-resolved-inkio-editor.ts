import { getSchema } from '@tiptap/core';
import { useEditor, type Extensions } from '@tiptap/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { dropUnknownContent } from '../utils/drop-unknown-content';
import { withDocumentAccess } from '../editor-document';
import { useCoalescedDocUpdate } from './use-coalesced-doc-update';
import type { UseInkioEditorOptions } from './use-inkio-editor';

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

export function useResolvedInkioEditor({
  content = '',
  extensions: finalExtensions,
  ariaLabel = 'Rich text editor',
  editable = true,
  onChange,
  onUpdate,
  onCreate,
}: UseInkioEditorOptions & { extensions: Extensions }) {

  // `content` is the initial document, so this runs once.
  const [initialContent] = useState(() =>
    (typeof content === 'object' ? dropUnknownContent(content, getSchema(finalExtensions)) : content));

  const prevExtensionsRef = useRef<Extensions | null>(null);
  const onCreateRef = useRef(onCreate);
  const emitUpdate = useCoalescedDocUpdate(onUpdate, onChange);

  useEffect(() => {
    onCreateRef.current = onCreate;
  }, [onCreate]);

  const editorProps = useMemo(() => ({
    attributes: { class: 'inkio-content', 'aria-label': ariaLabel, 'aria-multiline': 'true' },
  }), [ariaLabel]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: finalExtensions,
    content: initialContent,
    editable,
    editorProps,
    onCreate: ({ editor: editorInstance }) => {
      onCreateRef.current?.(withDocumentAccess(editorInstance));
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

  return editor && withDocumentAccess(editor);
}
