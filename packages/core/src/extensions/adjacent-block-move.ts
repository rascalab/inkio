import { Fragment, Slice, type Node } from '@tiptap/pm/model';
import { ReplaceAroundStep } from '@tiptap/pm/transform';

/** Plan a swap with a sibling without replacing the rest of the parent. */
export function planAdjacentBlockMove(doc: Node, pos: number, direction: -1 | 1) {
  const $pos = doc.resolve(pos);
  const node = $pos.nodeAfter;
  if (!node?.isBlock || $pos.textOffset) return null;

  const parent = $pos.parent;
  const index = $pos.index();
  const sibling = parent.maybeChild(index + direction);
  if (!sibling) return null;

  const up = direction < 0;
  const first = up ? index - 1 : index;
  const content = Fragment.fromArray(up ? [node, sibling] : [sibling, node]);
  if (!parent.canReplace(first, first + 2, content)) return null;

  const from = up ? pos - sibling.nodeSize : pos;
  const to = from + node.nodeSize + sibling.nodeSize;
  const movedTo = up ? from : from + sibling.nodeSize;
  // The sibling stays the gap of the step so its document positions can be mapped.
  const step = new ReplaceAroundStep(
    from, to, up ? from : pos + node.nodeSize, up ? pos : to,
    new Slice(Fragment.from(node), 0, 0), up ? node.nodeSize : 0,
  );
  return { step, movedTo, selectionPos: movedTo + (node.isAtom ? 0 : 1) };
}
