import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import type { Node as PmNode } from '@tiptap/pm/model';
import { canJoin } from '@tiptap/pm/transform';
import { clampRange, collectChangedRanges } from '../utils/changed-ranges';

const LIST_TYPES = new Set(['bulletList', 'orderedList', 'taskList']);

/**
 * Automatically merges adjacent lists of the same type.
 * e.g. when dragging a list item next to an existing list,
 * ProseMirror creates a new list wrapper — this plugin joins them.
 */
export const ListMerge = Extension.create({
  name: 'listMerge',

  addProseMirrorPlugins() {
    // The first doc change walks the whole document so adjacent lists that
    // arrived with the initial content are merged too. After that, adjacency
    // can only appear where content changed, so only the changed ranges (and
    // their ancestors) are inspected.
    let didFullScan = false;

    return [
      new Plugin({
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((t) => t.docChanged)) return null;

          const doc = newState.doc;
          const joinPositions = new Set<number>();

          // Record the boundary between children i and i+1 of `parent` when
          // both are same-type lists (ordered lists only with equal starts).
          // With a window, only boundaries inside [windowFrom, windowTo]
          // are checked.
          const findAdjacentLists = (
            parent: PmNode,
            contentStart: number,
            windowFrom = -Infinity,
            windowTo = Infinity,
          ) => {
            let offset = contentStart;
            for (let i = 0; i < parent.childCount - 1; i++) {
              const child = parent.child(i);
              offset += child.nodeSize;
              if (offset < windowFrom) continue;
              if (offset > windowTo) break;
              const next = parent.child(i + 1);
              if (
                child.type === next.type
                && LIST_TYPES.has(child.type.name)
                // Don't merge ordered lists with different start numbers
                && !(child.type.name === 'orderedList' && child.attrs.start !== next.attrs.start)
              ) {
                joinPositions.add(offset);
              }
            }
          };

          if (!didFullScan) {
            didFullScan = true;
            // Check doc-level children (descendants() does NOT visit the doc node itself)
            findAdjacentLists(doc, 0);
            // Check nested containers (blockquotes, list items with nested lists, etc.)
            doc.descendants((node, pos) => {
              if (node.isTextblock) return false;
              if (node.childCount >= 2) {
                findAdjacentLists(node, pos + 1);
              }
            });
          } else {
            for (const range of collectChangedRanges(transactions)) {
              // Widen by one so boundaries touching the range edges count
              // (e.g. a list inserted right after an existing one).
              const [from, to] = clampRange(doc, [range[0] - 1, range[1] + 1]);
              findAdjacentLists(doc, 0, from, to);
              // nodesBetween visits every node overlapping the range,
              // including the ancestors that contain it.
              doc.nodesBetween(from, to, (node, pos) => {
                if (node.isTextblock) return false;
                if (node.childCount >= 2) {
                  findAdjacentLists(node, pos + 1, from, to);
                }
                return true;
              });
            }
          }

          if (joinPositions.size === 0) return null;

          // Join from end to preserve positions
          const tr = newState.tr;
          let modified = false;
          for (const joinPos of [...joinPositions].sort((a, b) => b - a)) {
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
