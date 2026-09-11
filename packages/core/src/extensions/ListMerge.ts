import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import type { Node as PmNode } from '@tiptap/pm/model';
import { canJoin, ReplaceStep } from '@tiptap/pm/transform';

const LIST_TYPES = new Set(['bulletList', 'orderedList', 'taskList']);

/**
 * True when a step's inserted slice contains a list node at any depth.
 * Slices are small (pasted/dropped/typed content), so this walk is cheap —
 * far cheaper than a full-document scan.
 */
function sliceIntroducesList(step: unknown): boolean {
  const slice = (step as { slice?: { content?: { descendants?: (fn: (node: PmNode) => void | false) => void } } }).slice;
  if (!slice?.content?.descendants) return false;
  let found = false;
  slice.content.descendants((node) => {
    if (LIST_TYPES.has(node.type.name)) {
      found = true;
      return false;
    }
  });
  return found;
}

/**
 * Automatically merges adjacent lists of the same type.
 * e.g. when dragging a list item next to an existing list,
 * ProseMirror creates a new list wrapper — this plugin joins them.
 */
export const ListMerge = Extension.create({
  name: 'listMerge',

  addProseMirrorPlugins() {
    // Number of list nodes seen by the last full scan (`null` = unknown).
    // When the doc provably contains no lists, transactions that cannot
    // introduce one skip the full walk below. Deletions from a list-free doc
    // stay list-free; only ReplaceSteps inserting list-carrying slices (or
    // non-Replace steps such as ReplaceAround/mark/attr steps, handled
    // conservatively via the full path) can change that.
    let knownListCount: number | null = null;

    return [
      new Plugin({
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((t) => t.docChanged)) return null;

          if (knownListCount === 0) {
            let maybeIntroducesList = false;
            for (const tr of transactions) {
              for (const step of tr.steps) {
                if (!(step instanceof ReplaceStep) || sliceIntroducesList(step)) {
                  maybeIntroducesList = true;
                  break;
                }
              }
              if (maybeIntroducesList) break;
            }
            if (!maybeIntroducesList) return null;
          }

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
          let listCount = 0;
          findAdjacentLists(newState.doc, 0);

          // Check nested containers (blockquotes, list items with nested lists, etc.)
          // descendants() visits every node except the doc itself, so this
          // single walk also recounts top-level lists for the fast path above.
          newState.doc.descendants((node, pos) => {
            if (node.isTextblock) return false;
            if (LIST_TYPES.has(node.type.name)) listCount += 1;
            if (node.childCount >= 2) {
              findAdjacentLists(node, pos + 1);
            }
          });
          knownListCount = listCount;

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
