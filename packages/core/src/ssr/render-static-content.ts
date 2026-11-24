import { type Extensions, type JSONContent } from '@tiptap/core';
import { generateHTML } from '@tiptap/html';
import sanitizeHtml from 'sanitize-html';
import { headingLabel, slugifyHeading, type HeadingItem } from '../headings/headings';
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

declare const module: { require?: (specifier: string) => unknown } | undefined;

function generateStaticHtml(json: JSONContent, extensions: Extensions): string {
  if (typeof window === 'undefined' && typeof module !== 'undefined') {
    // @tiptap/html has conditional ESM exports, but its CommonJS entry is
    // browser-only. Load the server implementation only in Node CJS so
    // browser builds don't pull in Happy DOM.
    const nodeModule = module;
    const server = nodeModule.require?.('@tiptap/html/server') as { generateHTML: typeof generateHTML } | undefined;
    if (server) return server.generateHTML(json, extensions);
  }
  return generateHTML(json, extensions);
}

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

type RenderedHeading = { position: number; level: number; text: string; id?: string };

function applyHeadingAnchors(html: string, rendered: RenderedHeading[], reserved: Set<string>) {
  const headings: HeadingItem[] = [];
  if (!rendered.length) return { html, headings };

  const parts: string[] = [];
  let start = 0;
  // The sanitizer supplies offsets in its output, not the potentially unsafe
  // input. All authored ids are now known, including those later on the page.
  for (const { position, level, text, id } of rendered.sort((a, b) => a.position - b.position)) {
    const index = headings.length;
    const anchor = id || slugifyHeading(text || `section-${index + 1}`, reserved);
    headings.push({ level, text, index, id: anchor });
    const afterTagName = position + 3; // <h1 … <h6
    parts.push(html.slice(start, afterTagName));
    if (!id) parts.push(` id="${anchor}"`);
    parts.push(` data-inkio-heading-index="${index}"`);
    start = afterTagName;
  }
  parts.push(html.slice(start));
  return { html: parts.join(''), headings };
}

// Literal colors only, including when used as the callout background variable.
const colorValues = [/^#[\da-f]{3,8}$/i, /^rgba?\([-+\d\s.,%/]+\)$/i, /^hsla?\([-+\d\s.,%/deg]+\)$/i, /^[a-z]{1,20}$/i];

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    'img', 'mark', 'sub', 'sup', 'pre', 'details', 'summary', 'input', 'label', 'figure', 'figcaption',
  ]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    '*': ['class', 'id', 'style'],
    details: ['open'],
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    input: ['type', 'checked', 'disabled'],
    ol: ['start', 'type'],
    span: ['data-comment-id', 'data-comment-resolved', 'data-wiki-link', 'data-color', 'data-id', 'data-label', 'data-mention-suggestion-char'],
    div: ['data-bookmark-url', 'data-bookmark-title', 'data-bookmark-description', 'data-bookmark-image', 'data-bookmark-favicon', 'data-type', 'data-callout-color', 'data-callout-icon'],
    ul: ['data-type'],
    li: ['data-type', 'data-checked'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan'],
    figure: ['data-type', 'data-align', 'data-width'],
  },
  allowedStyles: {
    '*': {
      color: colorValues,
      'background-color': colorValues,
      'text-align': [/^(left|center|right)$/],
    },
    div: { '--inkio-callout-bg': colorValues },
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

function sanitizeInkioHtml(html: string): Pick<StaticContentRenderResult, 'html' | 'headings'> {
  if (!html) return { html: '', headings: [] };
  assertStaticHtmlLength(html);

  const tables: { bounds: TableBounds; inRow: boolean; columns: number; columnGroupStart: number }[] = [];
  const taskItems: boolean[] = [];
  let inTaskItem = false;
  let slots = 0;
  let depth = 0;
  let elements = 0;
  let headings = 0;
  const rendered: RenderedHeading[] = [];
  const reserved = new Set<string>();

  const clean = sanitizeHtml(html, {
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
    exclusiveFilter(frame) {
      if (frame.tag === 'input' && frame.attribs.type !== 'checkbox') return true;
      // The sanitizer accumulates each retained frame's text into its parent.
      // Give a hard break a text boundary without changing its HTML.
      if (frame.tag === 'br') frame.text = '\n';
      const id = frame.attribs.id;
      if (id) reserved.add(id);
      if (/^h[1-6]$/.test(frame.tag)) {
        rendered.push({ position: frame.tagPosition, level: Number(frame.tag[1]), text: headingLabel(frame.text), id });
      }
      return false;
    },
    transformTags: {
      ...SANITIZE_OPTIONS.transformTags,
      input: (tagName, attrs) => {
        if (!inTaskItem || attrs.type?.toLowerCase() !== 'checkbox') {
          return { tagName, attribs: {} };
        }
        return { tagName, attribs: { ...attrs, type: 'checkbox', disabled: '' } };
      },
      td: normalizeCellSpans,
      th: normalizeCellSpans,
    },
  });
  return applyHeadingAnchors(clean, rendered, reserved);
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
    return { json, ...sanitizeInkioHtml(content.trim()), shellOnly: false };
  }

  assertStaticJsonBudget(content);
  let slots = 0;
  const json = normalizeJsonTables(normalizeInkioContent(content), ({ width, height }) => {
    slots += width * height;
    if (slots > MAX_STATIC_TABLE_SLOTS) throw new StaticContentLimitError();
  });

  // Tiptap serializes using a browser DOM or Happy DOM on the server.
  // Text nodes are properly escaped via DOM APIs, but extension renderHTML can
  // still emit unsafe attrs — always sanitize the output. Other malformed
  // content still falls back to the shell, but limits are reported explicitly.
  try {
    const raw = isEmptyDoc(json) ? '' : generateStaticHtml(json, extensions);
    return { json, ...sanitizeInkioHtml(raw), shellOnly: false };
  } catch (error) {
    if (error instanceof StaticContentLimitError || error instanceof TableContentError) throw error;
    return { json: EMPTY_DOC, html: '', headings: [], shellOnly: true };
  }
}
