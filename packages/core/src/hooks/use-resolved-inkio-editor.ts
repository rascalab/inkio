import { Selection, type EditorState } from '@tiptap/pm/state';
import { useEditor, type Extensions } from '@tiptap/react';
import { useEffect, useMemo, useRef } from 'react';
import { dropUnknownContent } from '../utils/drop-unknown-content';
import { withDocumentAccess } from '../editor-document';
import { useCoalescedDocUpdate } from './use-coalesced-doc-update';
import type { UseInkioEditorOptions } from './use-inkio-editor';
import { migrateEditorDocument } from './migrate-editor-document';

export function useResolvedInkioEditor({
  content = '',
  extensions: finalExtensions,
  ariaLabel = 'Rich text editor',
  editable = true,
  onChange,
  onUpdate,
  onCreate,
}: UseInkioEditorOptions & { extensions: Extensions }, followContent = false) {
  const seed = useRef(content);
  const previous = useRef<EditorState | null>(null);
  const emitUpdate = useCoalescedDocUpdate(onUpdate, onChange);
  const editorProps = useMemo(() => ({
    attributes: { class: 'inkio-content', 'aria-label': ariaLabel, 'aria-multiline': 'true' },
  }), [ariaLabel]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: finalExtensions,
    content: followContent ? content : seed.current,
    editable,
    editorProps,
    // useEditor destroys the old view before creating its replacement. Take the
    // last committed document, not a render-time snapshot or the initial prop.
    onUnmount: ({ editor: instance }) => { previous.current = instance.state; },
    onBeforeCreate: ({ editor: instance }) => {
      const old = previous.current;
      previous.current = null;
      if (old && !followContent) {
        instance.setOptions({ content: migrateEditorDocument(old.doc, instance.schema) });
      } else {
        const next = instance.options.content;
        if (next && typeof next === 'object' && !Array.isArray(next)) {
          instance.setOptions({ content: dropUnknownContent(next, instance.schema) });
        }
      }
      if (old) {
        instance.once('mount', () => {
          const { doc, tr } = instance.state;
          let selection;
          try {
            selection = old.selection.getBookmark().resolve(doc);
          } catch {
            // A removed node or shorter viewer document may invalidate the old position.
            selection = Selection.near(doc.resolve(Math.min(old.selection.head, doc.content.size)));
          }
          instance.view.dispatch(tr.setSelection(selection).setMeta('addToHistory', false));
        });
      }
    },
    onCreate: ({ editor: editorInstance }) => {
      if (editorInstance.options.extensions === finalExtensions) onCreate?.(withDocumentAccess(editorInstance));
    },
    onUpdate: ({ editor: editorInstance, transaction, appendedTransactions }) => {
      // setEditable also emits 'update' (with an empty transaction) and some
      // internals listen for that; only document changes reach onUpdate.
      if (!transaction.docChanged && !appendedTransactions.some((tr) => tr.docChanged)) return;
      if (editorInstance.options.extensions === finalExtensions) emitUpdate(editorInstance);
    },
  }, [finalExtensions]);

  // Tiptap replaces the instance in an effect. No render or callback should
  // expose the old API under the new extensions prop.
  const current = editor?.options.extensions === finalExtensions && !editor.isDestroyed ? editor : null;

  useEffect(() => {
    if (current && !current.isDestroyed) {
      if (current.options.editorProps !== editorProps) current.setOptions({ editorProps });
      if (current.options.editable !== editable) current.setEditable(editable);
    }
  }, [current, editable, editorProps]);

  return current && withDocumentAccess(current);
}
