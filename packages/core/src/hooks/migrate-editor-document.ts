import type { JSONContent } from '@tiptap/core';
import { Fragment, Slice, type Node, type Schema } from '@tiptap/pm/model';
import { Transform } from '@tiptap/pm/transform';
import { dropUnknownContent } from '../utils/drop-unknown-content';

/** Reopen a live document in a possibly different schema, without running editing commands. */
export function migrateEditorDocument(previous: Node, schema: Schema): JSONContent {
  const json: JSONContent = previous.toJSON();
  json.type = schema.topNodeType.name;
  const cleaned = dropUnknownContent(json, schema);
  try {
    schema.nodeFromJSON(cleaned).check();
    return cleaned;
  } catch {
    // Unwrapping a removed node or changing a content expression may leave
    // valid children in the wrong parent. Fit them bottom-up, not just at doc.
  }
  function fit(source: JSONContent, into: Node[]) {
    const children: Node[] = [];
    for (const child of source.content ?? []) fit(child, children);
    const content = Fragment.fromArray(children);
    const marks = (source.marks ?? []).flatMap(mark => {
      try { return [schema.markFromJSON(mark)]; } catch { return []; }
    });
    try {
      const node = schema.nodeFromJSON({ ...source, content: undefined, marks: undefined }).mark(marks);
      if (node.type.validContent(content)) {
        into.push(node.copy(content));
        return;
      }
      const shell = node.type.createAndFill(node.attrs, undefined, marks);
      if (shell && !node.isLeaf) {
        const fitted = new Transform(shell).replaceRange(0, shell.content.size, new Slice(content, 0, 0)).doc;
        if (fitted.textContent === content.textBetween(0, content.size)) {
          into.push(fitted);
          return;
        }
      }
    } catch {
      // A formerly valid node (e.g. with newly required attrs) may no longer exist.
    }
    for (const child of children) into.push(child);
  }
  const result: Node[] = [];
  fit(cleaned, result);
  const doc = result[0];
  if (!doc || doc.type !== schema.topNodeType) throw new RangeError('The new editor schema cannot represent the document root.');
  doc.check();
  return doc.toJSON();
}
