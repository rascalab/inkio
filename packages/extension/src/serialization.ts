import type { JSONContent } from '@tiptap/core';

type MentionRef = { id: string; label: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

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

function getStringAttr(node: JSONContent, key: string): string | undefined {
  if (!isRecord(node.attrs)) {
    return undefined;
  }

  const value = node.attrs[key];
  return typeof value === 'string' ? value : undefined;
}

export function extractMentions(content: JSONContent): Array<{ id: string; label: string }> {
  const mentions: MentionRef[] = [];
  const seen = new Set<string>();

  visitNodes(content, (node) => {
    if (node.type !== 'mention') {
      return;
    }

    const id = getStringAttr(node, 'id');
    const label = getStringAttr(node, 'label');
    if (!id || !label) {
      return;
    }

    const key = `${id}::${label}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    mentions.push({ id, label });
  });

  return mentions;
}

export function extractHashtags(content: JSONContent): string[] {
  const hashtags = new Set<string>();

  visitNodes(content, (node) => {
    if (node.type !== 'hashTag') {
      return;
    }

    const label = getStringAttr(node, 'label');
    if (!label) {
      return;
    }

    hashtags.add(label.replace(/^#/, ''));
  });

  return Array.from(hashtags);
}
