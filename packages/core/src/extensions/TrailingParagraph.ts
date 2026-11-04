import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state';

const LISTS = new Set(['bulletList', 'orderedList', 'taskList']);

/** Lists end on Enter; plain text blocks are already somewhere to write. */
function needsParagraphAfter(node: ProseMirrorNode): boolean {
  if (LISTS.has(node.type.name)) return false;
  return !node.isTextblock || Boolean(node.type.spec.code);
}

/** Set by Yjs sync on what comes in from the shared document. */
function isFromOtherClient(transaction: Transaction): boolean {
  const sync = transaction.getMeta('y-sync$') as { isChangeOrigin?: boolean } | undefined;
  return Boolean(sync?.isChangeOrigin);
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
        appendTransaction: (transactions, _oldState, state) => {
          const last = state.doc.lastChild;
          const { paragraph } = state.schema.nodes;
          if (!editor.isEditable || !last || !paragraph || !needsParagraphAfter(last)) return null;
          // Only for the person at this end of the document. Every client reacting
          // to a synced document would add its own line, opening it would edit it,
          // and just looking at the document should not change it.
          if (transactions.some(isFromOtherClient)) return null;
          const atLastBlock = state.selection.to > state.doc.content.size - last.nodeSize;
          if (!atLastBlock && !transactions.some((transaction) => transaction.docChanged)) return null;
          return state.tr.insert(state.doc.content.size, paragraph.create()).setMeta('addToHistory', false);
        },
      }),
    ];
  },
});
