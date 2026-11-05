import type { JSONContent } from '@tiptap/core';

export function getInitials(name: string): string {
  if (typeof name !== 'string') return '';
  // Array.from iterates code points, not UTF-16 units: w[0] and the final
  // slice would both split surrogate pairs (emoji) into lone surrogates.
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => Array.from(w)[0] ?? '')
    .join('')
    .toUpperCase();
  return Array.from(initials).slice(0, 2).join('');
}

/**
 * The comment threads a saved document still holds, for clearing the ones it
 * doesn't. Text deleted before saving no longer counts, and undo can't bring it
 * back once its editor is gone: compare on save, not on every change.
 */
export function getCommentIds(doc: JSONContent): string[] {
  const ids = new Set<string>();
  const visit = (node: JSONContent) => {
    for (const mark of node.marks ?? []) {
      if (mark.type === 'comment' && mark.attrs?.commentId) ids.add(String(mark.attrs.commentId));
    }
    node.content?.forEach(visit);
  };
  visit(doc);
  return [...ids];
}
