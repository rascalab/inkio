import type { JSONContent } from '@tiptap/core';
import { Fragment, Mark, type Node, type NodeType, type Schema } from '@tiptap/pm/model';
import { StepMap } from '@tiptap/pm/transform';
import { unknownNodeText } from '../utils/drop-unknown-content';
import { normalizeJsonTables } from '../utils/table-bounds';

// Keep origins outside ProseMirror nodes: Fragment joins adjacent text nodes
// when their old marks disappear, but their individual offsets still matter.
interface Piece {
  node: Node;
  children?: Piece[];
  from?: number; // Surviving opening token, leaf, or entire text run.
  close?: number; // Surviving closing token (possibly on a split wrapper).
}

function allowedIn(piece: Piece, parent: NodeType): Piece {
  if (!piece.node.marks.length) return piece;
  let marks = Mark.none;
  for (const mark of parent.allowedMarks(piece.node.marks)) marks = mark.addToSet(marks);
  return { ...piece, node: piece.node.mark(marks) };
}

/** Pack consecutive children; lift anything this parent cannot contain in source order. */
function pack(shell: Node, children: Piece[], root: boolean): Piece[] {
  const result: Piece[] = [];
  let batch: Piece[] = [];
  let match = shell.type.contentMatch;

  function flush() {
    const suffix = match.fillBefore(Fragment.empty, true)!;
    const content = Fragment.fromArray(batch.map(child => child.node)).append(suffix);
    result.push({ node: shell.copy(content), children: batch });
    batch = [];
    match = shell.type.contentMatch;
  }

  function place(child: Piece): boolean {
    const wrapping = match.findWrapping(child.node.type);
    if (wrapping) {
      for (let i = wrapping.length - 1; i >= 0; i--) {
        const type = wrapping[i]!;
        child = allowedIn(child, type);
        child = { node: type.createAndFill(null, child.node)!, children: [child] };
      }
    } else {
      const prefix = match.fillBefore(Fragment.from(child.node));
      if (!prefix) return false;
      prefix.forEach(node => batch.push({ node }));
      match = match.matchFragment(prefix)!;
    }
    batch.push(allowedIn(child, shell.type));
    match = match.matchType(child.node.type)!;
    return true;
  }

  function append(child: Piece) {
    if (place(child)) return;
    if (!root) {
      if (batch.length) {
        flush();
        if (place(child)) return;
      }
      result.push(child);
    } else if (child.children?.length) {
      // No ancestor remains to accept this wrapper, but its children may fit.
      child.children.forEach(append);
    } else {
      throw new RangeError(`The new editor schema cannot represent ${child.node.type.name} in its document root.`);
    }
  }

  children.forEach(append);
  if (batch.length || !result.length) flush();
  return result;
}

/** Unmatched gaps between surviving source tokens are the only changed ranges. */
function positionMap(root: Piece, oldSize: number): StepMap {
  const ranges: number[] = [];
  let oldEnd = 0, newEnd = 0;
  function retain(from: number, to: number, size: number) {
    if (from !== oldEnd || to !== newEnd) ranges.push(oldEnd, from - oldEnd, to - newEnd);
    oldEnd = from + size;
    newEnd = to + size;
  }
  function visit(piece: Piece, pos: number) {
    const size = piece.node.nodeSize;
    if (piece.from !== undefined) retain(piece.from, pos, piece.node.isLeaf ? size : 1);
    let childPos = pos + 1;
    for (const child of piece.children ?? []) {
      visit(child, childPos);
      childPos += child.node.nodeSize;
    }
    if (piece.close !== undefined) retain(piece.close, pos + size - 1, 1);
  }
  visit(root, -1);
  retain(oldSize, root.node.content.size, 0);
  return new StepMap(ranges);
}

/** Reopen a live document in a possibly different schema, without running editing commands. */
export function migrateEditorDocument(previous: Node, schema: Schema): { doc: Node; mapping: StepMap } {
  let json: JSONContent = previous.toJSON();
  json.type = schema.topNodeType.name;
  if (schema.nodes.table?.spec.tableRole === 'table') json = normalizeJsonTables(json);
  try {
    const doc = schema.nodeFromJSON(json);
    doc.check();
    // Changing an empty container into a leaf (or vice versa) changes its
    // position width even if its JSON representation is identical.
    if (Object.values(previous.type.schema.nodes).every(type => {
      const next = type === previous.type ? schema.topNodeType : schema.nodes[type.name];
      return !next || type.isLeaf === next.isLeaf;
    })) return { doc, mapping: StepMap.empty };
  } catch {
    // A removed type, incompatible attribute, mark or content expression needs fitting.
  }

  const unsupported = new Set<string>();
  function convert(old: Node, source: JSONContent, pos: number): Piece[] {
    const root = pos === -1;
    const children: Piece[] = [];
    old.forEach((child, offset, index) => {
      for (const piece of convert(child, source.content![index]!, pos + 1 + offset)) children.push(piece);
    });
    const type = root ? schema.topNodeType : schema.nodes[old.type.name];
    const marks: Mark[] = [];
    for (const mark of source.marks ?? []) {
      try { marks.push(schema.markFromJSON(mark)); } catch { unsupported.add(mark.type); }
    }
    let shell: Node | undefined;
    if (type) {
      try { shell = type.isText ? schema.text(old.text!, marks) : type.create(source.attrs, null, marks); }
      catch { /* Formerly valid attributes may no longer be constructible. */ }
    }
    if (!shell) {
      unsupported.add(old.type.name);
      if (root) throw new RangeError('The new editor schema cannot represent the document root.');
      const label = old.isLeaf && unknownNodeText(source);
      if (label) children.push({ node: schema.text(label) });
      if (schema.nodes.paragraph && (old.isTextblock || (label && old.isBlock))) {
        shell = schema.nodes.paragraph.create();
      } else {
        return children;
      }
    }
    if (shell.isLeaf) {
      return children.length ? children : [{ node: shell, from: root ? undefined : pos }];
    }
    const pieces = pack(shell, children, root);
    if (!root) {
      const first = pieces[0]!, last = pieces[pieces.length - 1]!;
      if ((type || !old.isLeaf) && first.node.type === shell.type && first.from === undefined) first.from = pos;
      if (!old.isLeaf && last.node.type === shell.type && last.close === undefined) last.close = pos + old.nodeSize - 1;
    }
    return pieces;
  }

  const [root] = convert(previous, json, -1);
  if (!root || root.node.type !== schema.topNodeType) throw new RangeError('The new editor schema cannot represent the document root.');
  root.node.check();
  if (unsupported.size) console.warn(`[inkio] The new editor schema could not retain: ${[...unsupported].join(', ')}.`);
  return { doc: root.node, mapping: positionMap(root, previous.content.size) };
}
