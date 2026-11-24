import type { JSONContent } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { isSafeUrl } from './utils/url-safety';

// Crafted inputs (remote docs, adapter payloads) can nest arbitrarily deep:
// plain recursion would overflow the call stack, so traversal stops past
// this depth and treats deeper nodes as leaves.
const MAX_VISIT_DEPTH = 128;

const BLOCK_NODE_TYPES = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'bulletList',
  'orderedList',
  'listItem',
  'taskList',
  'taskItem',
  'codeBlock',
  'horizontalRule',
  'table',
  'tableRow',
  'tableCell',
  'tableHeader',
  'callout',
  'details',
]);

// The same serialization rules apply to persisted JSON and a live document.
// Read children directly in either representation; never serialize a live tree.
interface NodeReader<N> {
  typeName(node: N): string | undefined;
  children(node: N): readonly N[] | undefined;
}

const jsonNodes: NodeReader<JSONContent> = {
  typeName: (node) => node.type,
  children: (node) => Array.isArray(node.content) ? node.content : undefined,
};

const editorNodes: NodeReader<ProseMirrorNode> = {
  typeName: (node) => node.type.name,
  children: (node) => node.content.content,
};

function visit<N>(node: N | undefined, reader: NodeReader<N>, visitor: (current: N) => void, depth: number): void {
  if (!node || depth > MAX_VISIT_DEPTH) return;
  visitor(node);
  const children = reader.children(node);
  if (children) {
    for (const child of children) visit(child, reader, visitor, depth + 1);
  }
}

/** Depth-capped pre-order walk over a JSON document. */
export function visitNodes(
  node: JSONContent | undefined,
  visitor: (current: JSONContent) => void,
  depth = 0,
): void {
  visit(node, jsonNodes, visitor, depth);
}

/** Text shown by Inkio's inline reference nodes (live or persisted). */
export function inlineReferenceText(type: string | undefined, attrs?: Record<string, unknown>): string | undefined {
  if (type === 'wikiLink') {
    const href = attrs?.href;
    return typeof href === 'string' && isSafeUrl(href) ? href : '';
  }
  if (type !== 'mention' && type !== 'hashTag') return undefined;
  const prefix = type === 'mention' ? '@' : '#';
  const label = attrs?.label ?? attrs?.id;
  if (typeof label !== 'string' && typeof label !== 'number') return '';
  const text = String(label);
  return text.startsWith(prefix) ? text : prefix + text;
}

export interface TextProjection { text: string; blocks: number }

function readPlainText<N extends { text?: string; attrs?: Record<string, unknown> }>(root: N, reader: NodeReader<N>): TextProjection {
  let blocks = 0;
  const chunks: string[] = [];
  function appendNodeText(node: N, depth: number): void {
    if (depth > MAX_VISIT_DEPTH) return;

    if (typeof node.text === 'string') {
      chunks.push(node.text);
      return;
    }

    const type = reader.typeName(node);
    const reference = inlineReferenceText(type, node.attrs);
    if (reference !== undefined) {
      chunks.push(reference);
      return;
    }
    if (type === 'hardBreak') chunks.push('\n');
    if (type === 'imageBlock') {
      const caption = node.attrs?.caption;
      chunks.push(caption ? `[Image: ${caption}]\n` : '[Image]\n');
      return;
    }

    const children = reader.children(node);
    if (children) {
      for (const child of children) appendNodeText(child, depth + 1);
    }
    if (type && BLOCK_NODE_TYPES.has(type)) {
      chunks.push('\n');
      blocks++;
    }
  }

  appendNodeText(root, 0);

  const text = chunks
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { text, blocks };
}

export function jsonPlainText(content: JSONContent): TextProjection {
  return readPlainText(content, jsonNodes);
}

export function editorPlainText(doc: ProseMirrorNode): TextProjection {
  return readPlainText(doc, editorNodes);
}

/** The limit includes the suffix; never return half a surrogate pair. */
export function summarizeText(text: string, maxLength: number): string {
  const limit = Math.floor(maxLength);
  if (!(limit > 0)) return '';
  if (text.length > limit) {
    if (limit <= 3) return '.'.repeat(limit);
    let end = limit - 3;
    if (text.codePointAt(end - 1)! > 0xffff) end--;
    text = `${text.slice(0, end).trimEnd()}...`;
  }
  return text.replace(/[\uD800-\uDFFF]/gu, '\uFFFD');
}

export interface ContentStats {
  words: number;
  chars: number;
  blocks: number;
}

export function countText({ text, blocks }: TextProjection): ContentStats {
  let words = 0;
  const word = /\S+/g;
  while (word.test(text)) words++;
  return { words, chars: text.length, blocks };
}
