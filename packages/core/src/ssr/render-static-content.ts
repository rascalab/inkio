import { type Extensions, type JSONContent } from '@tiptap/core';
import { generateHTML } from '@tiptap/html';
import sanitizeHtml from 'sanitize-html';
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

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    'img', 'mark', 'sub', 'sup', 'pre', 'details', 'summary', 'input', 'figure', 'figcaption',
  ]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    '*': ['class', 'id'],
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    input: ['type', 'checked', 'disabled'],
    ol: ['start', 'type'],
    span: ['data-comment-id', 'data-comment-resolved', 'data-wiki-link', 'data-color', 'data-id', 'data-label', 'data-mention-suggestion-char'],
    div: ['data-bookmark-url', 'data-bookmark-title', 'data-bookmark-description', 'data-bookmark-image', 'data-bookmark-favicon', 'data-type'],
    ul: ['data-type'],
    li: ['data-type', 'data-checked'],
    figure: ['data-type', 'data-align', 'data-width'],
    h1: ['data-inkio-heading-index'],
    h2: ['data-inkio-heading-index'],
    h3: ['data-inkio-heading-index'],
    h4: ['data-inkio-heading-index'],
    h5: ['data-inkio-heading-index'],
    h6: ['data-inkio-heading-index'],
  },
  allowedStyles: {
    '*': {
      color: [/.*/],
      'background-color': [/.*/],
      'text-align': [/^(left|center|right)$/],
    },
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
};

function sanitizeInkioHtml(html: string): string {
  return html ? sanitizeHtml(html, SANITIZE_OPTIONS) : '';
}

export function renderInkioStaticContent(
  content: string | JSONContent | undefined,
  extensions: Extensions,
): StaticContentRenderResult {
  const json = normalizeInkioContent(content);
  const jsonHeadings = getHeadingsFromContent(json);

  if (typeof content === 'string') {
    const rawHtml = sanitizeInkioHtml(content.trim());
    const headings = extractHeadingsFromHtml(rawHtml);
    return {
      json,
      html: injectHeadingIds(rawHtml, headings),
      headings,
      shellOnly: false,
    };
  }

  // generateHTML from @tiptap/html uses happy-dom internally.
  // Text nodes are properly escaped via DOM APIs — no XSS risk.
  const html = isEmptyDoc(json)
    ? ''
    : injectHeadingIds(generateHTML(json, extensions), jsonHeadings);
  return { json, html, headings: jsonHeadings, shellOnly: false };
}
