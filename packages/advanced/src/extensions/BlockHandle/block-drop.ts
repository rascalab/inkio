import { closeHistory } from '@tiptap/pm/history';
import { Fragment, Slice, type Node as ProseMirrorNode, type ResolvedPos } from '@tiptap/pm/model';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { canSplit, dropPoint } from '@tiptap/pm/transform';
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
type BlockDropPlan = {
  gap: number;
  insertAt: number;
  node: ProseMirrorNode;
  placement: 'block' | 'besideList' | 'splitList';
};

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
  // Serialize an item with its parent list for transfers to other editors.
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

const canInsertBlock = ($pos: ResolvedPos, node: ProseMirrorNode) =>
  !$pos.parent.inlineContent && $pos.parent.canReplaceWith($pos.index(), $pos.index(), node.type, node.marks);

// Place ordinary blocks beside an item, not inside it. At an interior gap
// the list must be split so the block can stay at the previewed position.
const besideListPlan = (doc: ProseMirrorNode, gap: number, node: ProseMirrorNode): BlockDropPlan | null => {
  const $gap = doc.resolve(gap);
  const list = $gap.parent;
  if ($gap.index() === 0 || $gap.index() === list.childCount) {
    const insertAt = $gap.index() === 0 ? $gap.before() : $gap.after();
    return canInsertBlock(doc.resolve(insertAt), node) ? { gap, insertAt, node, placement: 'besideList' } : null;
  }
  if (!canSplit(doc, gap)) return null;
  const $afterList = doc.resolve($gap.after());
  const index = $afterList.index();
  return $afterList.parent.canReplace(index, index, Fragment.fromArray([node, list]))
    ? { gap, insertAt: gap, node, placement: 'splitList' }
    : null;
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

export const planBlockDrop = (view: EditorView, source: BlockDragSource, coords: DropCoords, move: boolean): BlockDropPlan | null => {
  if (!view.editable || view.state.doc !== source.doc || !isInEditor(view, coords)) return null;
  const { clientX, clientY } = coords;
  const hit = view.root.elementFromPoint?.(clientX, clientY);
  if (hit && !view.dom.contains(hit)) return null;
  const at = view.posAtCoords({ left: clientX, top: clientY });
  if (!at) return null;

  const { doc, selection, blockPos } = source;
  const overlapsSource = (pos: number) => move ? pos >= blockPos && pos <= selection.to : pos > blockPos && pos < selection.to;
  let { node } = selection;
  const listGap = LIST_ITEM_TYPES.has(node.type.name) ? null : listDropGapAt(view, at.pos, clientY);
  if (listGap !== null) {
    if (overlapsSource(listGap)) return null;
    const plan = besideListPlan(doc, listGap, node);
    return plan && !overlapsSource(plan.insertAt) ? plan : null;
  }

  // A caret already at a list gap needs no geometry correction. Otherwise,
  // use the block edge rather than the caret's position in a line.
  let pos = at.pos;
  if (!LIST_TYPES_SET.has(doc.resolve(pos).parent.type.name)) {
    const hovered = findHoveredBlock(view, clientX, clientY, at);
    if (hovered) {
      const { top, height } = hovered.blockElement.getBoundingClientRect();
      pos = hovered.blockPos;
      if (clientY > top + height / 2) pos += doc.nodeAt(pos)!.nodeSize;
    }
  }

  const { slice } = source;
  let gap = dropPoint(doc, pos, slice);
  if (gap === null && slice.openStart) {
    // Outside a compatible list, insert the closed source wrapper, not a
    // bare item that ProseMirror could fit into a different kind of list.
    node = slice.content.firstChild!;
    if (!node.type.validContent(node.content)) return null;
    gap = dropPoint(doc, pos, new Slice(slice.content, 0, 0));
  }
  if (gap === null || overlapsSource(gap) || !canInsertBlock(doc.resolve(gap), node)) return null;
  return { gap, insertAt: gap, node, placement: 'block' };
};

export const applyBlockDrop = (
  view: EditorView, source: BlockDragSource, plan: BlockDropPlan, move: boolean, mode: 'native' | 'touch',
) => {
  if (!view.editable || view.state.doc !== source.doc || !dropMarkerRect(view, plan.gap)) return;
  const tr = view.state.tr;
  if (move) source.selection.replace(tr);

  let pos = tr.mapping.map(plan.insertAt);
  if (plan.placement === 'splitList') {
    if (!canSplit(tr.doc, pos)) return;
    tr.split(pos);
    pos += 1;
  }
  const { node } = plan;
  if (!canInsertBlock(tr.doc.resolve(pos), node)) return;
  tr.insert(pos, node);
  if (tr.doc.eq(source.doc)) return;

  if (plan.placement !== 'block') {
    tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1)));
  } else if (mode === 'native') {
    const $from = tr.doc.resolve(pos);
    if (!LIST_ITEM_TYPES.has(node.type.name) && NodeSelection.isSelectable(node)) {
      tr.setSelection(new NodeSelection($from));
    } else {
      const $to = tr.doc.resolve(pos + node.nodeSize);
      tr.setSelection(view.someProp('createSelectionBetween', (create) => create(view, $from, $to))
        ?? TextSelection.between($from, $to));
    }
  }
  view.dispatch((mode === 'touch' ? closeHistory(tr) : tr).setMeta('uiEvent', 'drop'));
  if (mode === 'native') view.focus();
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
