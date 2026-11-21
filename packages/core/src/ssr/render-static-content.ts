import { type Extensions, type JSONContent } from '@tiptap/core';
import { generateHTML } from '@tiptap/html';
import sanitizeHtml from 'sanitize-html';
import { getHeadingsFromContent, slugifyHeading, type HeadingItem } from '../headings/headings';
import { escapeHtml } from '../utils/html';
import { assertTableSize, clampTableSpan, normalizeJsonTables, TableBounds, TableContentError } from '../utils/table-bounds';
import {
  assertStaticHtmlLength,
  assertStaticJsonBudget,
  MAX_STATIC_DEPTH,
  MAX_STATIC_ELEMENTS,
  MAX_STATIC_HEADINGS,
  MAX_STATIC_TABLE_SLOTS,
  StaticContentLimitError,
  stripHtmlMarkup,
} from './static-content-bounds';

const EMPTY_DOC: JSONContent = { type: 'doc', content: [] };

export type StaticContentRenderResult = {
  json: JSONContent;
  html: string;
  headings: HeadingItem[];
  shellOnly: boolean;
};

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

  assertStaticHtmlLength(content);

  const trimmed = content.trim();
  if (!trimmed) {
    return EMPTY_DOC;
  }

  // Tag-shaped sequences only: a bare `<` followed by a non-letter (a<3,
  // 1<2) is comparison text, not markup, and must survive.
  return createParagraphDoc(stripHtmlMarkup(trimmed).replace(/\s+/g, ' ').trim());
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
  return decodeHtmlEntities(stripHtmlMarkup(value)).replace(/\s+/g, ' ').trim();
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

  // Pair by document order with the same full-element pattern the extractor
  // uses: the i-th match is the same element on both sides, so one stray
  // tag can no longer misalign every later id. Tags that already carry an
  // id keep it (still consuming their slot).
  let index = 0;
  return html.replace(
    /<h([1-6])(\b[^>]*)>([\s\S]*?)<\/h\1>/gi,
    (element, level: string, attrs: string, inner: string) => {
      const heading = headings[index++];
      if (!heading || /\sid=/.test(attrs)) {
        return element;
      }
      return `<h${level}${attrs} id="${heading.id}" data-inkio-heading-index="${heading.index}">${inner}</h${level}>`;
    },
  );
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
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan'],
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
      // Tight allowlist: hex/rgb/hsl/named colors only. The old /.*/ permitted
      // `expression(...)` and `url(...)` CSS exfil vectors.
      color: [/^#(?:[0-9a-f]{3,8})$/i, /^rgba?\([^)]*\)$/i, /^hsla?\([^)]*\)$/i, /^[a-z]+$/i],
      'background-color': [/^#(?:[0-9a-f]{3,8})$/i, /^rgba?\([^)]*\)$/i, /^hsla?\([^)]*\)$/i, /^[a-z]+$/i],
      'text-align': [/^(left|center|right)$/],
    },
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel', 'blob'],
  allowedSchemesByTag: {
    // No `data:` here: SVG data URLs are active content (scriptable).
    // Raster data-URL images are still guarded at the node layer (isSafeUrl);
    // static HTML only carries http(s)/blob image sources.
    img: ['http', 'https', 'blob'],
  },
  transformTags: {
    // Harden links that open a new browsing context against reverse tabnabbing.
    a: (tagName, attribs) => {
      if (attribs.target) {
        const tokens = new Set(
          String(attribs.rel ?? '')
            .split(/\s+/)
            .filter(Boolean),
        );
        tokens.add('noopener');
        tokens.add('noreferrer');
        return { tagName, attribs: { ...attribs, rel: [...tokens].join(' ') } };
      }
      return { tagName, attribs };
    },
  },
} as sanitizeHtml.IOptions;

function sanitizeInkioHtml(html: string): string {
  if (!html) return '';
  assertStaticHtmlLength(html);

  const tables: { bounds: TableBounds; inRow: boolean; columns: number; columnGroupStart: number }[] = [];
  const taskItems: boolean[] = [];
  let inTaskItem = false;
  let slots = 0;
  let depth = 0;
  let elements = 0;
  let headings = 0;

  return sanitizeHtml(html, {
    ...SANITIZE_OPTIONS,
    onOpenTag(name, attrs) {
      if (++depth > MAX_STATIC_DEPTH || ++elements > MAX_STATIC_ELEMENTS ||
        (/^h[1-6]$/.test(name) && ++headings > MAX_STATIC_HEADINGS)) {
        throw new StaticContentLimitError();
      }
      if (name === 'li') {
        taskItems.push(inTaskItem);
        inTaskItem = attrs['data-type'] === 'taskItem';
      }
      if (name === 'table') {
        tables.push({ bounds: new TableBounds(), inRow: false, columns: 0, columnGroupStart: 0 });
        return;
      }
      const table = tables[tables.length - 1];
      if (!table) return;
      if (name === 'tr') {
        table.bounds.startRow();
        table.inRow = true;
      } else if (name === 'td' || name === 'th') {
        if (!table.inRow) {
          // HTML permits omitted row tags; count that browser-implied row too.
          table.bounds.startRow();
          table.inRow = true;
        }
        table.bounds.addCell(clampTableSpan(attrs.colspan), clampTableSpan(attrs.rowspan));
      } else if (name === 'col') {
        assertTableSize(++table.columns, table.bounds.height);
      } else if (name === 'colgroup') {
        table.columnGroupStart = table.columns;
      }
    },
    onCloseTag(name) {
      depth -= 1;
      if (name === 'li') inTaskItem = taskItems.pop() ?? false;
      const table = tables[tables.length - 1];
      if (!table) return;
      if (name === 'tr' || name === 'thead' || name === 'tbody' || name === 'tfoot') {
        table.inRow = false;
      } else if (name === 'colgroup' && table.columns === table.columnGroupStart) {
        assertTableSize(++table.columns, table.bounds.height);
      } else if (name === 'table') {
        tables.pop();
        const width = Math.max(table.columns, table.bounds.width);
        assertTableSize(width, table.bounds.height);
        slots += width * table.bounds.height;
        if (slots > MAX_STATIC_TABLE_SLOTS) throw new StaticContentLimitError();
      }
    },
    transformTags: {
      ...SANITIZE_OPTIONS.transformTags,
      input: (tagName, attrs) => {
        if (!inTaskItem || attrs.type?.toLowerCase() !== 'checkbox') {
          return { tagName: 'inkio-discard-input', attribs: {} };
        }
        return { tagName, attribs: { ...attrs, type: 'checkbox', disabled: '' } };
      },
      td: normalizeCellSpans,
      th: normalizeCellSpans,
    },
  });
}

function normalizeCellSpans(tagName: string, attribs: Record<string, string>) {
  for (const name of ['colspan', 'rowspan'] as const) {
    if (attribs[name] === undefined) continue;
    const span = clampTableSpan(attribs[name]);
    if (span === 1) delete attribs[name];
    else attribs[name] = String(span);
  }
  return { tagName, attribs };
}

export function renderInkioStaticContent(
  content: string | JSONContent | undefined,
  extensions: Extensions,
): StaticContentRenderResult {
  if (typeof content === 'string') {
    const json = normalizeInkioContent(content);
    const rawHtml = sanitizeInkioHtml(content.trim());
    const headings = extractHeadingsFromHtml(rawHtml);
    return {
      json,
      html: injectHeadingIds(rawHtml, headings),
      headings,
      shellOnly: false,
    };
  }

  assertStaticJsonBudget(content);
  let slots = 0;
  const json = normalizeJsonTables(normalizeInkioContent(content), ({ width, height }) => {
    slots += width * height;
    if (slots > MAX_STATIC_TABLE_SLOTS) throw new StaticContentLimitError();
  });

  // generateHTML from @tiptap/html uses happy-dom internally.
  // Text nodes are properly escaped via DOM APIs, but extension renderHTML can
  // still emit unsafe attrs — always sanitize the output. Other malformed
  // content still falls back to the shell, but limits are reported explicitly.
  try {
    const jsonHeadings = getHeadingsFromContent(json);
    const raw = isEmptyDoc(json) ? '' : generateHTML(json, extensions);
    const html = sanitizeInkioHtml(raw);
    return { json, html: injectHeadingIds(html, jsonHeadings), headings: jsonHeadings, shellOnly: false };
  } catch (error) {
    if (error instanceof StaticContentLimitError || error instanceof TableContentError) throw error;
    return { json: EMPTY_DOC, html: '', headings: [], shellOnly: true };
  }
}
