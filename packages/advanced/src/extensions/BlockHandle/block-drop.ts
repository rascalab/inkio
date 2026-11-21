import { closeHistory } from '@tiptap/pm/history';
import { Fragment, Slice, type Node as ProseMirrorNode, type ResolvedPos } from '@tiptap/pm/model';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { dropPoint } from '@tiptap/pm/transform';
import type { EditorView } from '@tiptap/pm/view';

export interface HoveredBlock {
  blockPos: number;
  blockElement: HTMLElement;
}

export type BlockPress = HoveredBlock & { doc: ProseMirrorNode };

export interface BlockDragSource extends BlockPress {
  selection: NodeSelection;
  slice: Slice;
}

export type DropCoords = Pick<MouseEvent, 'clientX' | 'clientY'>;
type TouchDropTarget = { gap: number; slice: Slice; splitList: boolean };

const LIST_ITEM_TYPES = new Set(['listItem', 'taskItem']);
const LIST_TYPES_SET = new Set(['bulletList', 'orderedList', 'taskList']);
const HANDLE_SIZE = 28;

export const isHTMLElement = (value: unknown): value is HTMLElement => value instanceof HTMLElement;

export const getVisibleBlockPos = ($pos: ResolvedPos): number | null => {
  if ($pos.depth === 0) return null;

  for (let depth = $pos.depth; depth >= 2; depth -= 1) {
    if (LIST_ITEM_TYPES.has($pos.node(depth).type.name)) return $pos.before(depth);
  }

  return $pos.node(1).isBlock ? $pos.before(1) : null;
};

export const isInEditor = (view: EditorView, { clientX, clientY }: DropCoords) => {
  const rect = view.dom.getBoundingClientRect();
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
};

export const dragSource = (view: EditorView, source: BlockPress): BlockDragSource | null => {
  const { doc, blockPos, blockElement } = source;
  if (doc !== view.state.doc || view.nodeDOM(blockPos) !== blockElement) return null;
  const node = doc.nodeAt(blockPos);
  if (!node?.isBlock) return null;
  const selection = NodeSelection.create(doc, blockPos);
  const parentList = selection.$from.parent;
  // Keep the wrapper for drops outside a list, but insert just the item
  // between compatible siblings.
  const slice = LIST_ITEM_TYPES.has(node.type.name) && LIST_TYPES_SET.has(parentList.type.name)
    ? new Slice(Fragment.from(parentList.type.create(parentList.attrs, node)), 1, 1)
    : selection.content();
  return { ...source, selection, slice };
};

export const findHoveredBlock = (
  view: EditorView,
  clientX: number,
  clientY: number,
  positionAtCoords = view.posAtCoords({ left: clientX, top: clientY }),
): HoveredBlock | null => {
  if (!positionAtCoords) return null;
  const { doc } = view.state;
  const { pos, inside } = positionAtCoords;
  let blockPos = getVisibleBlockPos(doc.resolve(pos));

  // Atom nodes can report a top-level boundary instead of an interior caret.
  if (blockPos === null) {
    const check = inside >= 0 ? inside : pos;
    if (check >= 0 && check < doc.content.size) {
      if (inside >= 0) blockPos = getVisibleBlockPos(doc.resolve(inside));
      if (blockPos === null && doc.nodeAt(check)?.isBlock) blockPos = check;
      if (blockPos === null && check > 0 && doc.nodeAt(check - 1)?.isBlock) blockPos = check - 1;
    }
  }

  if (blockPos === null) {
    const hit = view.dom.ownerDocument.elementFromPoint(clientX, clientY);
    for (let element = hit; element && element !== view.dom; element = element.parentElement) {
      if (!isHTMLElement(element)) continue;
      try {
        const pos = view.posAtDOM(element, 0);
        if (pos < 0) continue;
        blockPos = getVisibleBlockPos(doc.resolve(pos));
        if (blockPos !== null) break;
      } catch {
        // The hit may be outside the editor; keep walking through the DOM.
      }
    }
  }

  if (blockPos === null || !doc.nodeAt(blockPos)?.isBlock) return null;
  const blockElement = view.nodeDOM(blockPos);
  return isHTMLElement(blockElement) ? { blockPos, blockElement } : null;
};

const listDropGapAt = (view: EditorView, at: number, clientY: number): number | null => {
  const $at = view.state.doc.resolve(at);
  let listDepth = 0;
  for (let depth = 1; depth <= $at.depth && !listDepth; depth += 1) {
    if (LIST_TYPES_SET.has($at.node(depth).type.name)) {
      listDepth = depth;
    }
  }
  if (!listDepth) {
    return null;
  }

  if ($at.depth === listDepth) return at;

  const itemPos = $at.before(listDepth + 1);
  const itemDOM = view.nodeDOM(itemPos);
  const rect = isHTMLElement(itemDOM) ? itemDOM.getBoundingClientRect() : null;
  return rect && clientY > rect.top + rect.height / 2 ? $at.after(listDepth + 1) : itemPos;
};

/**
 * A paragraph dropped on a list would otherwise become part of an item.
 * Insert at the same gap shown by the marker, splitting the list if needed.
 */
export const dropBesideListItem = (view: EditorView, gap: number, pickup: BlockDragSource, move: boolean, touch = false): boolean => {
  const { blockPos: pos, selection: { node } } = pickup;

  const tr = view.state.tr;
  if (move) tr.delete(pos, pos + node.nodeSize);
  const $gap = tr.doc.resolve(tr.mapping.map(gap));
  let target = $gap.pos + 1;
  if ($gap.index() === 0) {
    target = $gap.before();
  } else if ($gap.index() === $gap.parent.childCount) {
    target = $gap.after();
  } else {
    tr.split($gap.pos);
  }

  const $target = tr.doc.resolve(target);
  if (!$target.parent.canReplaceWith($target.index(), $target.index(), node.type)) {
    return false;
  }
  tr.insert(target, node);
  tr.setSelection(TextSelection.near(tr.doc.resolve(target + 1)));
  view.dispatch((touch ? closeHistory(tr) : tr).setMeta('uiEvent', 'drop'));
  if (!touch) view.focus();
  return true;
};

export const pickupListGap = (view: EditorView, pickup: BlockDragSource, at: number, clientY: number) => {
  const { blockPos, selection: { node } } = pickup;
  if (LIST_ITEM_TYPES.has(node.type.name)) return null;
  const gap = listDropGapAt(view, at, clientY);
  return gap !== null && (gap < blockPos || gap > blockPos + node.nodeSize) ? gap : null;
};

export const dropMarkerRect = (view: EditorView, pos: number) => {
  const $gap = view.state.doc.resolve(pos);
  if ($gap.parent.inlineContent) return null;
  const before = $gap.nodeBefore && view.nodeDOM(pos - $gap.nodeBefore.nodeSize);
  const after = $gap.nodeAfter && view.nodeDOM(pos);
  const beforeRect = isHTMLElement(before) ? before.getBoundingClientRect() : null;
  const afterRect = isHTMLElement(after) ? after.getBoundingClientRect() : null;
  const bounds = beforeRect ?? afterRect;
  if (!bounds) return null;

  return {
    left: bounds.left,
    width: bounds.width,
    top: beforeRect && afterRect ? (beforeRect.bottom + afterRect.top) / 2
      : beforeRect ? beforeRect.bottom : bounds.top,
  };
};

export const touchDropTarget = (view: EditorView, source: BlockDragSource, coords: DropCoords): TouchDropTarget | null => {
  if (!view.editable || view.state.doc !== source.doc || !isInEditor(view, coords)) return null;
  const { clientX, clientY } = coords;
  const hit = view.root.elementFromPoint?.(clientX, clientY);
  if (hit && !view.dom.contains(hit)) return null;
  const at = view.posAtCoords({ left: clientX, top: clientY });
  if (!at) return null;
  const listGap = pickupListGap(view, source, at.pos, clientY);
  if (listGap !== null) return { gap: listGap, slice: source.slice, splitList: true };

  // Pick a block edge by geometry, not by the caret's position in a line.
  const hovered = findHoveredBlock(view, clientX, clientY, at);
  let pos = at.pos;
  if (hovered) {
    const { top, height } = hovered.blockElement.getBoundingClientRect();
    pos = hovered.blockPos;
    if (clientY > top + height / 2) pos += source.doc.nodeAt(pos)!.nodeSize;
  }

  let { slice } = source;
  let gap = dropPoint(source.doc, pos, slice);
  if (gap === null && slice.openStart) {
    // A list item dropped outside a compatible list moves with its wrapper.
    slice = new Slice(slice.content, 0, 0);
    gap = dropPoint(source.doc, pos, slice);
  }
  if (gap === null || (gap >= source.blockPos && gap <= source.selection.to)) return null;
  return { gap, slice, splitList: false };
};

export const moveTouchBlock = (view: EditorView, source: BlockDragSource, target: TouchDropTarget) => {
  if (target.splitList) {
    dropBesideListItem(view, target.gap, source, true, true);
    return;
  }
  const tr = closeHistory(view.state.tr);
  source.selection.replace(tr);
  const pos = tr.mapping.map(target.gap);
  const beforeInsert = tr.doc;
  tr.replaceRange(pos, pos, target.slice);
  if (!tr.doc.eq(beforeInsert) && !tr.doc.eq(source.doc)) view.dispatch(tr.setMeta('uiEvent', 'drop'));
};

const FIRST_TEXT_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, summary, [data-type="toc"]';

const getStyleLineHeight = (element: Element) => {
  const { lineHeight, fontSize } = getComputedStyle(element);
  const line = parseFloat(lineHeight);
  return line > 0 ? line : (parseFloat(fontSize) * 1.5 || HANDLE_SIZE);
};

export const positionHandle = (handle: HTMLElement, blockElement: HTMLElement, handleWidth: number) => {
  const blockRect = blockElement.getBoundingClientRect();

  // Node views can wrap the first text line (notably tasks and nested lists).
  const text = blockElement.querySelector(FIRST_TEXT_SELECTOR);
  const textRect = text?.getBoundingClientRect();
  const rect = textRect?.height ? textRect : blockRect;
  const top = blockElement.tagName === 'HR'
    ? blockRect.top + (blockRect.height - HANDLE_SIZE) / 2
    : rect.top + Math.max(0, (Math.min(rect.height, getStyleLineHeight(textRect?.height && text ? text : blockElement)) - HANDLE_SIZE) / 2);

  // For list items, move handle left of the list markers
  let leftPos = blockRect.left - handleWidth;
  if (blockElement.tagName === 'LI') {
    const parent = blockElement.parentElement;
    if (parent) {
      const paddingLeft = parseFloat(getComputedStyle(parent).paddingLeft) || 0;
      leftPos = blockRect.left - paddingLeft - handleWidth;
    }
  }

  handle.style.position = 'fixed';
  handle.style.top = `${top}px`;
  handle.style.left = `${Math.max(0, leftPos)}px`;
  handle.style.width = `${handleWidth}px`;
  handle.style.height = `${HANDLE_SIZE}px`;
};
