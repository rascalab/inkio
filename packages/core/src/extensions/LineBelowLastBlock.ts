import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { LIST_TYPES } from './ListMerge';

/** Lists end on Enter; plain text blocks are already somewhere to write. */
function needsLineBelow(node: ProseMirrorNode): boolean {
  if (LIST_TYPES.has(node.type.name)) return false;
  return !node.isTextblock || Boolean(node.type.spec.code);
}

function canAddLine(view: EditorView): boolean {
  const { doc, schema } = view.state;
  return view.editable && Boolean(schema.nodes.paragraph) && Boolean(doc.lastChild && needsLineBelow(doc.lastChild));
}

function addLine(view: EditorView): boolean {
  const { doc, schema, tr } = view.state;
  const end = doc.content.size;
  tr.insert(end, schema.nodes.paragraph.create());
  tr.setSelection(TextSelection.create(tr.doc, end + 1));
  view.dispatch(tr.setMeta('addToHistory', false).scrollIntoView());
  view.focus();
  return true;
}

function isBelowLastBlock(view: EditorView, event: MouseEvent): boolean {
  const { doc } = view.state;
  const dom = view.nodeDOM(doc.content.size - doc.lastChild!.nodeSize);
  return dom instanceof HTMLElement && event.clientY > dom.getBoundingClientRect().bottom;
}

/** True when the caret has nowhere further down to go. Cells of a row sit side by side. */
function isAtBottom(view: EditorView): boolean {
  const { $to } = view.state.selection;
  const inText = $to.parent.isTextblock;
  if (inText && !view.endOfTextblock('down')) return false;
  for (let depth = inText ? $to.depth - 1 : $to.depth; depth >= 0; depth--) {
    if ($to.node(depth).type.spec.tableRole === 'row') continue;
    if ($to.indexAfter(depth) < $to.node(depth).childCount) return false;
  }
  return true;
}

/**
 * Makes a line to write on when someone asks for one below a last block a caret
 * can't leave: an image or table of contents takes the click, a callout or quote
 * keeps the caret inside. The document stays as it is until then, so opening it
 * or receiving someone else's edit never changes it.
 */
export const LineBelowLastBlock = Extension.create({
  name: 'lineBelowLastBlock',
  // Ahead of the gap cursor and the table keys, which would take the same click or key.
  priority: 101,

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('lineBelowLastBlock'),
        props: {
          handleClick(view, _pos, event) {
            if (event.button !== 0 || !canAddLine(view) || !isBelowLastBlock(view, event)) return false;
            return addLine(view);
          },
          handleKeyDown(view, event) {
            if (event.key !== 'ArrowDown' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return false;
            if (!canAddLine(view) || !isAtBottom(view)) return false;
            return addLine(view);
          },
        },
      }),
    ];
  },
});
