import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';

const LISTS = new Set(['bulletList', 'orderedList', 'taskList']);

/** Lists end on Enter; plain text blocks are already somewhere to write. */
function needsParagraphAfter(node: ProseMirrorNode): boolean {
  if (LISTS.has(node.type.name)) return false;
  return !node.isTextblock || Boolean(node.type.spec.code);
}

/**
 * Keeps a line to write on below a last block a caret can't leave by clicking
 * under it: an image or table of contents takes the click, a callout or quote
 * keeps the caret inside.
 */
export const TrailingParagraph = Extension.create({
  name: 'trailingParagraph',

  addProseMirrorPlugins() {
    const { editor } = this;
    return [
      new Plugin({
        key: new PluginKey('trailingParagraph'),
        appendTransaction: (_transactions, _oldState, state) => {
          const last = state.doc.lastChild;
          const { paragraph } = state.schema.nodes;
          if (!editor.isEditable || !last || !paragraph || !needsParagraphAfter(last)) return null;
          return state.tr.insert(state.doc.content.size, paragraph.create()).setMeta('addToHistory', false);
        },
      }),
    ];
  },
});
