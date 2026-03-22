import type { JSONContent } from '@tiptap/core';

export interface HeadingItem {
  level: number;
  text: string;
  index: number;
  id: string;
}

function getTextFromNode(node: JSONContent | null | undefined): string {
  if (!node) {
    return '';
  }

  if (node.type === 'text' && typeof node.text === 'string') {
    return node.text;
  }

  if (Array.isArray(node.content)) {
    return node.content.map(getTextFromNode).join('');
  }

  return '';
}

export function slugifyHeading(text: string, used: Set<string>): string {
  const base = (
    text
      .trim()
      .replace(/\s+/g, '-')
      .replace(/^[^a-zA-Z0-9\uac00-\ud7a3]+/, '')
      .replace(/[^a-zA-Z0-9\uac00-\ud7a3_-]/g, '')
      || 'section'
  ).toLowerCase();

  let candidate = base;
  let suffix = 1;

  while (used.has(candidate)) {
    candidate = `${base}-${suffix++}`;
  }

  used.add(candidate);
  return candidate;
}

export function getHeadingsFromContent(content: JSONContent | null | undefined): HeadingItem[] {
  if (!content || !Array.isArray(content.content)) {
    return [];
  }

  const headings: HeadingItem[] = [];
  const usedIds = new Set<string>();
  let index = 0;

  function visit(node: JSONContent): void {
    if (node.type === 'heading') {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level ?? 1)));
      const text = getTextFromNode(node).trim();

      headings.push({
        level,
        text,
        index,
        id: slugifyHeading(text || `section-${index + 1}`, usedIds),
      });
      index += 1;
      return;
    }

    if (Array.isArray(node.content)) {
      node.content.forEach(visit);
    }
  }

  content.content.forEach(visit);
  return headings;
}

/** Extract headings directly from a ProseMirror doc node (no JSON serialization). */
export function getHeadingsFromDoc(doc: { forEach: (fn: (node: any) => void) => void } | null | undefined): HeadingItem[] {
  if (!doc) return [];

  const headings: HeadingItem[] = [];
  const usedIds = new Set<string>();
  let index = 0;

  doc.forEach((node: any) => {
    if (node.type?.name === 'heading') {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level ?? 1)));
      const text = (node.textContent ?? '').trim();

      headings.push({
        level,
        text,
        index,
        id: slugifyHeading(text || `section-${index + 1}`, usedIds),
      });
      index += 1;
    }
  });

  return headings;
}

/** Find heading DOM elements in an editor view, filtered by maxLevel. */
export function getHeadingElements(editor: { view?: { dom?: Element } } | null | undefined, maxLevel = 6): HTMLElement[] {
  const container = editor?.view?.dom;
  if (!container) return [];
  const selector = Array.from({ length: maxLevel }, (_, i) => `h${i + 1}`).join(', ');
  return Array.from(container.querySelectorAll<HTMLElement>(selector));
}
