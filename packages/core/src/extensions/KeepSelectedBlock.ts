import { Extension } from '@tiptap/core';
import { NodeSelection, Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

/** A key that writes a character. An input method reports 229 before it composes. */
function writesText(event: KeyboardEvent): boolean {
  if (event.metaKey || (event.ctrlKey && !event.altKey)) return false;
  return event.key.length === 1 || event.keyCode === 229;
}

function moveCaretBelow(view: EditorView, selection: NodeSelection) {
  const { schema, tr } = view.state;
  const { $to } = selection;
  const { paragraph } = schema.nodes;
  const next = $to.nodeAfter;
  if (next?.type === paragraph && next.content.size === 0) {
    view.dispatch(tr.setSelection(TextSelection.create(tr.doc, $to.pos + 1)));
    return;
  }
  if (!paragraph || !$to.parent.canReplaceWith($to.index(), $to.index(), paragraph)) return;
  tr.insert($to.pos, paragraph.create());
  view.dispatch(tr.setSelection(TextSelection.create(tr.doc, $to.pos + 1)).scrollIntoView());
}

/**
 * Typing with a whole block selected writes below it instead of replacing it.
 * The caret moves on keydown and the key carries on, so the browser writes the
 * character there and an input method composes there. Delete and Backspace still
 * remove the block.
 */
export const KeepSelectedBlock = Extension.create({
  name: 'keepSelectedBlock',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('keepSelectedBlock'),
        props: {
          handleKeyDown(view, event) {
            const { selection } = view.state;
            if (view.editable && selection instanceof NodeSelection && selection.node.isBlock && writesText(event)) {
              moveCaretBelow(view, selection);
            }
            return false;
          },
        },
      }),
    ];
  },
});
