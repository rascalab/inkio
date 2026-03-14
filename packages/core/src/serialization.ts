import type { JSONContent } from '@tiptap/core';

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
]);

function visitNodes(node: JSONContent | undefined, visitor: (current: JSONContent) => void): void {
  if (!node) {
    return;
  }

  visitor(node);

  if (!Array.isArray(node.content)) {
    return;
  }

  for (const child of node.content) {
    visitNodes(child, visitor);
  }
}

function appendNodeText(node: JSONContent, chunks: string[]): void {
  if (typeof node.text === 'string') {
    chunks.push(node.text);
    return;
  }

  if (node.type === 'hardBreak') {
    chunks.push('\n');
  }

  if (node.type === 'imageBlock') {
    const caption = node.attrs?.caption;
    chunks.push(caption ? `[Image: ${caption}]` : '[Image]');
    chunks.push('\n');
    return;
  }

  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      appendNodeText(child, chunks);
    }
  }

  if (node.type && BLOCK_NODE_TYPES.has(node.type)) {
    chunks.push('\n');
  }
}

function countBlocks(content: JSONContent): number {
  let blockCount = 0;

  visitNodes(content, (node) => {
    if (node.type && BLOCK_NODE_TYPES.has(node.type)) {
      blockCount += 1;
    }
  });

  return blockCount;
}

export function toPlainText(content: JSONContent): string {
  const chunks: string[] = [];
  appendNodeText(content, chunks);

  return chunks
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function toSummary(content: JSONContent, maxLength = 140): string {
  const plainText = toPlainText(content);
  if (plainText.length <= maxLength) {
    return plainText;
  }

  return `${plainText.slice(0, Math.max(0, maxLength)).trimEnd()}...`;
}

export function getContentStats(content: JSONContent): { words: number; chars: number; blocks: number } {
  const plainText = toPlainText(content);
  const words = plainText.length > 0 ? plainText.split(/\s+/).filter(Boolean).length : 0;

  return {
    words,
    chars: plainText.length,
    blocks: countBlocks(content),
  };
}
