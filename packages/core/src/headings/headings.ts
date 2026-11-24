import type { JSONContent } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { documentPlainText, walkDocumentNodes } from '../serialization';

export interface HeadingItem {
  level: number;
  text: string;
  index: number;
  id: string;
}

const defaultLevels = [1, 2, 3, 4, 5, 6];

function schemaLevels(node: ProseMirrorNode): number[] {
  // Tiptap's heading extension registers hN parse rules in configured order;
  // its renderer falls back to the first configured level.
  const levels: number[] = [];
  for (const rule of node.type.spec?.parseDOM ?? []) {
    if ('tag' in rule && /^h[1-6]$/.test(rule.tag)) levels.push(Number(rule.tag[1]));
  }
  return levels.length ? levels : defaultLevels;
}

/** A ToC label is one line, but a break must still separate its words. */
export function headingLabel(text: string): string {
  const title = text.trim();
  return /[\r\n]/.test(title)
    ? title.replace(/[ \t\r\n]+/g, space => /[\r\n]/.test(space) ? ' ' : space)
    : title;
}

function addHeading(headings: HeadingItem[], used: Set<string>, rawLevel: unknown, levels: number[], title: string) {
  const index = headings.length;
  const level = typeof rawLevel === 'number' && levels.includes(rawLevel) ? rawLevel : levels[0];
  const text = headingLabel(title);
  headings.push({ level, text, index, id: slugifyHeading(text || `section-${index + 1}`, used) });
}

export function slugifyHeading(text: string, used: Set<string>): string {
  // Unicode letter/number classes keep CJK and accented-Latin headings
  // readable instead of collapsing them all to `section-N`.
  const base = (
    text
      .trim()
      .replace(/\s+/g, '-')
      .replace(/^[^\p{L}\p{N}]+/u, '')
      .replace(/[^\p{L}\p{N}_-]+/gu, '')
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

export function getDocumentHeadings(root: JSONContent | ProseMirrorNode): HeadingItem[] {
  const headings: HeadingItem[] = [];
  const used = new Set<string>();
  const range = { from: 0, to: (root as ProseMirrorNode).content?.size ?? 0 };
  let levels: number[] | undefined;
  walkDocumentNodes(root, (node, parent, index, pos) => {
    const type = node.type;
    const live = typeof type === 'object';
    if (node === root || (live ? type.name : type) !== 'heading') {
      return !live || !(node as ProseMirrorNode).isTextblock;
    }
    levels ??= live ? schemaLevels(node as ProseMirrorNode) : defaultLevels;
    const context = live ? { pos, parent: parent as ProseMirrorNode | null, index, range } : undefined;
    addHeading(headings, used, node.attrs?.level, levels, documentPlainText(node, context).text);
    return false;
  });
  return headings;
}

export function getHeadingsFromContent(content: JSONContent | null | undefined): HeadingItem[] {
  return content ? getDocumentHeadings(content) : [];
}

/** Extract headings directly from a ProseMirror doc node (no JSON serialization). */
export function getHeadingsFromDoc(
  doc: {
    content?: { size: number };
    forEach?: (fn: (node: any) => void) => void;
    descendants?: (fn: (node: any) => void) => void;
  } | null | undefined,
): HeadingItem[] {
  if (!doc) return [];
  if ('type' in doc && doc.content) return getDocumentHeadings(doc as ProseMirrorNode);

  const headings: HeadingItem[] = [];
  const usedIds = new Set<string>();
  let levels: number[] | undefined;

  // Heading text is projected once, including any schema text serializers.
  const collect = (node: ProseMirrorNode, pos = 0, parent: ProseMirrorNode | null = null, index = 0): boolean => {
    if (node?.type?.name === 'heading') {
      levels ??= schemaLevels(node);
      const title = node.type.spec && node.content
        ? documentPlainText(node, { pos, parent, index, range: { from: 0, to: doc.content?.size ?? node.content.size } }).text
        : node.textContent ?? '';
      addHeading(headings, usedIds, node.attrs?.level, levels, title);
      return false;
    }
    return !node?.isTextblock;
  };

  // Lightweight adapters may supply only descendants() or forEach().
  if (typeof doc.descendants === 'function') {
    doc.descendants(collect);
  } else if (typeof doc.forEach === 'function') {
    doc.forEach(node => collect(node));
  }

  return headings;
}

/** Find heading DOM elements in an editor view, filtered by maxLevel. */
export function getHeadingElements(editor: { view?: { dom?: Element } } | null | undefined, maxLevel = 6): HTMLElement[] {
  const container = editor?.view?.dom;
  if (!container) return [];
  // maxLevel < 1 means "no headings"; without the guard an empty selector
  // string throws SyntaxError in querySelectorAll.
  const level = Math.min(6, Math.max(1, Math.floor(maxLevel)));
  if (!(maxLevel >= 1)) return [];
  const selector = Array.from({ length: level }, (_, i) => `h${i + 1}`).join(', ');
  return Array.from(container.querySelectorAll<HTMLElement>(selector));
}
