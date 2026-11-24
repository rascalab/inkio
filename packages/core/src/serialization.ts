import type { JSONContent } from '@tiptap/core';
import type { Node as ProseMirrorNode, Schema } from '@tiptap/pm/model';
import { isSafeUrl } from './utils/url-safety';

type Source = JSONContent | ProseMirrorNode;

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
  'detailsSummary',
  'detailsContent',
  'imageBlock',
  'bookmark',
  'tocBlock',
]);

interface Position {
  parent: ProseMirrorNode | null;
  index: number;
  pos: number;
  range: { from: number; to: number };
}

// Keep only the current path on the stack. Reused subtrees occur at distinct
// document positions; only an ancestor back-edge is a cycle.
export function walkDocumentNodes<N extends Source>(
  root: N,
  enter: (node: N, parent: N | null, index: number, pos: number) => unknown,
  leave?: (node: N) => void,
  rootParent: N | null = null, rootIndex = 0, rootPos = -1,
): void {
  const live = isEditorNode(root);
  const path = live ? undefined : new Set<N>();
  const stack: { node: N; children: readonly N[]; index: number; pos: number }[] = [];
  let node: N | undefined = root;
  let parent = rootParent, index = rootIndex, pos = rootPos;
  for (;;) {
    if (node && typeof node === 'object' && !path?.has(node)) {
      const content = enter(node, parent, index, pos) !== false ? node.content : undefined;
      const children = (Array.isArray(content) ? content : content?.content) as readonly N[] | undefined;
      if (children?.length) {
        path?.add(node);
        stack.push({ node, children, index: 0, pos: pos + 1 });
      } else {
        leave?.(node);
      }
    }
    const frame = stack[stack.length - 1];
    if (!frame) return;
    if (frame.index === frame.children.length) {
      stack.pop();
      path?.delete(frame.node);
      leave?.(frame.node);
      node = undefined;
    } else {
      parent = frame.node;
      index = frame.index++;
      pos = frame.pos;
      node = frame.children[index];
      if (live) frame.pos += (node as ProseMirrorNode).nodeSize;
    }
  }
}

/** Pre-order walk. The legacy starting depth no longer limits traversal. */
export function visitNodes(node: JSONContent | undefined, visitor: (current: JSONContent) => void, _depth = 0): void {
  if (node) walkDocumentNodes(node, current => { visitor(current); });
}

/** The label used by the built-in trigger nodes, before adding @ or #. */
export function referenceLabel(attrs?: Record<string, unknown>): unknown {
  const label = attrs?.label;
  return label == null || label === '' ? attrs?.id : label;
}

/** Text shown by Inkio's inline reference nodes (live or persisted). */
export function inlineReferenceText(type: string | undefined, attrs?: Record<string, unknown>): string | undefined {
  if (type === 'wikiLink') {
    const href = attrs?.href;
    return typeof href === 'string' && isSafeUrl(href) ? href : '';
  }
  if (type !== 'mention' && type !== 'hashTag') return undefined;
  const prefix = type === 'mention' ? '@' : '#';
  const label = referenceLabel(attrs);
  const text = typeof label === 'string' || typeof label === 'number' ? String(label) : '';
  return text.startsWith(prefix) ? text : prefix + text;
}

export interface TextProjection { text: string; blocks: number }

function isEditorNode(node: Source): node is ProseMirrorNode {
  return typeof node.type === 'object';
}

function attr(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function builtinText(type: string | undefined, attrs?: Record<string, unknown>): string | undefined {
  if (type === 'hardBreak') return '\n';
  if (type === 'imageBlock') {
    const caption = attr(attrs?.caption) || attr(attrs?.alt);
    return caption ? `[Image: ${caption}]` : '[Image]';
  }
  if (type === 'bookmark') {
    const url = attr(attrs?.url);
    return [attr(attrs?.title) || (isSafeUrl(url) ? url : ''), attr(attrs?.description)].filter(Boolean).join('\n');
  }
  return inlineReferenceText(type, attrs);
}

export function documentPlainText(root: Source, context?: Position): TextProjection {
  let blocks = 0;
  let text = '', prose = '';
  let literal: Source | undefined, rendered: Source | undefined;
  const range = context?.range ?? { from: 0, to: isEditorNode(root) ? root.content.size : 0 };
  // Only prose is normalized. Never trim/collapse indentation or blank lines
  // from the adjacent literal segment, even at the start or end of a document.
  function flush(end: boolean): void {
    let run = prose.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
    if (!text) run = run.trimStart();
    text += end ? run.trimEnd() : run;
    prose = '';
  }
  walkDocumentNodes<Source>(root, (node, parent, index, pos) => {
    if (rendered) return;
    const live = isEditorNode(node);
    const type = live ? node.type.name : node.type;
    if (!literal && (type === 'codeBlock' || (live && node.isBlock && node.type.whitespace === 'pre'))) {
      flush(false);
      literal = node;
    }
    const serializer = live && node.type.spec.toText;
    const value = serializer && parent ? serializer({ node, parent, index, pos, range })
      : node.text ?? builtinText(type, node.attrs);
    if (value !== undefined) {
      if (literal) text += value;
      else prose += value;
      rendered = node;
    }
  }, node => {
    const block = isEditorNode(node) ? node.isBlock && node.type !== node.type.schema.topNodeType
      : BLOCK_NODE_TYPES.has(node.type!);
    if (block) blocks++;
    if (rendered === node) rendered = undefined;
    if (literal === node) literal = undefined;
    if (block && !rendered) prose += '\n';
  }, context?.parent, context?.index, context?.pos);
  flush(true);
  return { text, blocks };
}

// Schema.nodeFromJSON recursively parses children. Construct bottom-up so the
// optional schema path handles the same depth and cycles as the default read.
export function fromJSON(schema: Schema, json: JSONContent): ProseMirrorNode {
  const stack: (ProseMirrorNode[] | undefined)[] = [];
  let result: ProseMirrorNode;
  walkDocumentNodes(json, () => { stack.push(undefined); }, node => {
    const children = stack.pop();
    const marks = node.marks?.map(schema.markFromJSON);
    if (node.type === 'text') {
      result = schema.text(node.text!, marks);
    } else {
      const type = node.type && schema.nodes[node.type];
      if (!type) throw new RangeError(`Unknown node type: ${node.type}`);
      result = type.create(node.attrs, children, marks);
    }
    if (stack.length) (stack[stack.length - 1] ??= []).push(result);
  });
  return result!;
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
