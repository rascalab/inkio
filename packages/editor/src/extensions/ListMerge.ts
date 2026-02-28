import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import type { Node as PmNode } from '@tiptap/pm/model';
import { canJoin } from '@tiptap/pm/transform';

const LIST_TYPES = new Set(['bulletList', 'orderedList', 'taskList']);

/**
 * Automatically merges adjacent lists of the same type.
 * e.g. when dragging a list item next to an existing list,
 * ProseMirror creates a new list wrapper — this plugin joins them.
 */
export const ListMerge = Extension.create({
  name: 'listMerge',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((t) => t.docChanged)) return null;

          const joinPositions: number[] = [];

          const findAdjacentLists = (parent: PmNode, contentStart: number) => {
            let offset = contentStart;
            for (let i = 0; i < parent.childCount - 1; i++) {
              const child = parent.child(i);
              offset += child.nodeSize;
              const next = parent.child(i + 1);
              if (
                child.type === next.type
                && LIST_TYPES.has(child.type.name)
                // Don't merge ordered lists with different start numbers
                && !(child.type.name === 'orderedList' && child.attrs.start !== next.attrs.start)
              ) {
                joinPositions.push(offset);
              }
            }
          };

          // Check doc-level children (descendants() does NOT visit the doc node itself)
          findAdjacentLists(newState.doc, 0);

          // Check nested containers (blockquotes, list items with nested lists, etc.)
          newState.doc.descendants((node, pos) => {
            if (node.isTextblock) return false;
            if (node.childCount >= 2) {
              findAdjacentLists(node, pos + 1);
            }
          });

          if (joinPositions.length === 0) return null;

          // Join from end to preserve positions
          const tr = newState.tr;
          let modified = false;
          joinPositions.sort((a, b) => b - a);
          for (const joinPos of joinPositions) {
            if (canJoin(tr.doc, joinPos)) {
              tr.join(joinPos);
              modified = true;
            }
          }

          return modified ? tr : null;
        },
      }),
    ];
  },
});
