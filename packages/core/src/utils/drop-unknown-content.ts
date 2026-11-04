import type { JSONContent } from '@tiptap/core';
import type { Schema } from '@tiptap/pm/model';

/** What a node with no place in this schema still has to say. */
function textOf(node: JSONContent): string | null {
  const { label, title, name, url, href } = (node.attrs ?? {}) as Record<string, unknown>;
  const text = [label, title, name, url, href].find((value) => typeof value === 'string' && value.length > 0);
  return (text as string | undefined) ?? null;
}

function cleanChildren(nodes: JSONContent[], schema: Schema, inline: boolean, unknown: Set<string>): JSONContent[] {
  return nodes.flatMap((node) => cleanNode(node, schema, inline, unknown));
}

function cleanNode(node: JSONContent, schema: Schema, inline: boolean, unknown: Set<string>): JSONContent[] {
  // Not ours to judge: Tiptap reports malformed content itself.
  if (!node || typeof node !== 'object') return [node];
  const type = schema.nodes[node.type ?? ''];
  if (!type) {
    unknown.add(node.type ?? 'unnamed');
    if (Array.isArray(node.content)) return cleanChildren(node.content, schema, inline, unknown);
    const text = textOf(node);
    if (!text) return [];
    return inline
      ? [{ type: 'text', text }]
      : [{ type: 'paragraph', content: [{ type: 'text', text }] }];
  }

  const marks = Array.isArray(node.marks)
    ? node.marks.filter((mark) => {
        if (schema.marks[mark?.type]) return true;
        unknown.add(String(mark?.type));
        return false;
      })
    : null;
  return [{
    ...node,
    ...(marks ? { marks } : {}),
    ...(Array.isArray(node.content)
      ? { content: cleanChildren(node.content, schema, type.inlineContent, unknown) }
      : {}),
  }];
}

/**
 * Tiptap replaces a whole document with an empty one when any node or mark in it
 * is not in the schema, and saving that would lose it. Only what doesn't fit is
 * dropped: marks go, text stays, and a node keeps its children or its label.
 */
export function dropUnknownContent<T extends string | JSONContent | undefined>(content: T, schema: Schema): T {
  if (!content || typeof content !== 'object') return content;
  const unknown = new Set<string>();
  let cleaned: JSONContent | undefined;
  try {
    [cleaned] = cleanNode(content as JSONContent, schema, false, unknown);
  } catch {
    // Nested too deep to walk. Opening must not throw: Tiptap reports it instead.
    return content;
  }
  if (unknown.size === 0 || !cleaned) return content;
  console.warn(`[inkio] This editor has no extension for: ${[...unknown].join(', ')}. They were left out of the document.`);
  return cleaned as T;
}
