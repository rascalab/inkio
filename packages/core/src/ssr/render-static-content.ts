import { generateHTML, type Extensions, type JSONContent } from '@tiptap/core';
import { getHeadingsFromContent, type HeadingItem } from '../components/ToC';

const EMPTY_DOC: JSONContent = { type: 'doc', content: [] };

export type StaticContentRenderResult = {
  json: JSONContent;
  html: string;
  headings: HeadingItem[];
  shellOnly: boolean;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createParagraphDoc(text: string): JSONContent {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: text ? [{ type: 'text', text }] : [],
      },
    ],
  };
}

export function isEmptyDoc(content: JSONContent | null | undefined): boolean {
  return !content || !Array.isArray(content.content) || content.content.length === 0;
}

export function createEditorPlaceholderHtml(placeholder?: string): string {
  if (!placeholder) {
    return '<p></p>';
  }

  return `<p class="is-editor-empty" data-placeholder="${escapeHtml(placeholder)}"></p>`;
}

export function normalizeInkioContent(
  content: string | JSONContent | undefined,
): JSONContent {
  if (typeof content !== 'string') {
    return content ?? EMPTY_DOC;
  }

  const trimmed = content.trim();
  if (!trimmed) {
    return EMPTY_DOC;
  }

  return createParagraphDoc(trimmed.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function slugifyHeading(text: string, used: Set<string>): string {
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

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function extractHeadingsFromHtml(html: string): HeadingItem[] {
  const headings: HeadingItem[] = [];
  const usedIds = new Set<string>();
  const headingPattern = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match: RegExpExecArray | null = null;
  let index = 0;

  while ((match = headingPattern.exec(html)) !== null) {
    const level = Number(match[1] ?? 1);
    const text = stripHtml(match[2] ?? '');

    headings.push({
      level,
      text,
      index,
      id: slugifyHeading(text || `section-${index + 1}`, usedIds),
    });
    index += 1;
  }

  return headings;
}

function injectHeadingIds(html: string, headings: HeadingItem[]): string {
  if (!html || headings.length === 0) {
    return html;
  }

  let index = 0;
  return html.replace(/<h([1-6])(\b[^>]*)>/gi, (match, level, attrs) => {
    const heading = headings[index];
    if (!heading || String(heading.level) !== String(level)) {
      return match;
    }

    index += 1;
    if (/\sid=/.test(attrs)) {
      return match;
    }

    return `<h${level}${attrs} id="${heading.id}" data-inkio-heading-index="${heading.index}">`;
  });
}

export function renderInkioStaticContent(
  content: string | JSONContent | undefined,
  extensions: Extensions,
): StaticContentRenderResult {
  const json = normalizeInkioContent(content);
  const jsonHeadings = getHeadingsFromContent(json);

  try {
    if (typeof content === 'string') {
      const rawHtml = content.trim();
      const headings = extractHeadingsFromHtml(rawHtml);
      return {
        json,
        html: injectHeadingIds(rawHtml, headings),
        headings,
        shellOnly: false,
      };
    }

    const html = isEmptyDoc(json) ? '' : injectHeadingIds(generateHTML(json, extensions), jsonHeadings);
    return { json, html, headings: jsonHeadings, shellOnly: false };
  } catch {
    if (typeof content === 'string' && content.trim()) {
      const rawHtml = content.trim();
      const headings = extractHeadingsFromHtml(rawHtml);
      return {
        json,
        html: injectHeadingIds(rawHtml, headings),
        headings,
        shellOnly: false,
      };
    }

    return { json, html: '', headings: jsonHeadings, shellOnly: true };
  }
}
