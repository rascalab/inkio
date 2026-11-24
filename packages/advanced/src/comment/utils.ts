import type { Mark, Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

export interface CommentRange {
  from: number;
  to: number;
  mark: Mark;
}

/** Restore the native selection now, not on a frame that may belong to a reply field. */
export function focusCommentSelection(view: EditorView): void {
  view.focus();
  view.dispatch(view.state.tr.scrollIntoView());
}

/** Walk a document once for the target ID; coalesce adjacent equal marks. */
export function findCommentRanges(doc: ProseMirrorNode, id: string, resolved?: boolean): CommentRange[] {
  const ranges: CommentRange[] = [];
  const type = doc.type.schema.marks.comment;
  if (!type) return ranges;
  doc.descendants((node, pos) => {
    if (!node.isText) return;
    const mark = type.isInSet(node.marks);
    if (mark?.attrs.commentId !== id ||
        (resolved !== undefined && Boolean(mark.attrs.resolved) !== resolved)) return;
    const end = pos + node.nodeSize;
    const last = ranges[ranges.length - 1];
    if (last && last.to === pos && last.mark.eq(mark)) last.to = end;
    else ranges.push({ from: pos, to: end, mark });
  });
  return ranges;
}

/** Update the document only; the initiating surface selects the one host callback. */
export function updateCommentResolution(
  tr: Transaction,
  id: string,
  resolved: boolean,
  apply: boolean,
): boolean {
  const ranges = findCommentRanges(tr.doc, id, !resolved);
  if (apply) {
    for (const { from, to, mark } of ranges) {
      tr.removeMark(from, to, mark);
      tr.addMark(from, to, mark.type.create({ ...mark.attrs, resolved }));
    }
  }
  return ranges.length > 0;
}

export function visitCommentableText(
  doc: ProseMirrorNode,
  from: number,
  to: number,
  visit: (from: number, to: number) => boolean | void,
): void {
  const type = doc.type.schema.marks.comment;
  if (!type || from < 0 || from >= to || to > doc.content.size) return;
  let stopped = false;
  doc.nodesBetween(from, to, (node, pos, parent) => {
    if (stopped) return false;
    if (node.isText && parent?.type.allowsMarkType(type) &&
        (type.isInSet(node.marks) || !node.marks.some((mark) => mark.type.excludes(type)))) {
      stopped = visit(Math.max(from, pos), Math.min(to, pos + node.nodeSize)) === false;
    }
  });
}

export function canCommentOnRange(doc: ProseMirrorNode, from: number, to: number): boolean {
  let canComment = false;
  visitCommentableText(doc, from, to, () => {
    canComment = true;
    return false;
  });
  return canComment;
}

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
