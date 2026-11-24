import { Extension, type Editor, type ExtensionConfig, type JSONContent } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorExtensionAccess, InkioEditor } from '../editor-document';
import { normalizeCalloutColor, normalizeCalloutIcon } from '../extensions/callout-schema';
import { UPLOAD_PLACEHOLDER_PREFIX } from '../extensions/image-block-shared';
import { inlineReferenceText } from '../serialization';
import { escapeHtml } from '../utils/html';
import { isSafeUrl } from '../utils/url-safety';
import { unified } from 'unified';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';

type JsonMark = NonNullable<JSONContent['marks']>[number];
type MdastNode = {
  type: string;
  value?: string;
  depth?: number;
  ordered?: boolean;
  checked?: boolean | null;
  spread?: boolean;
  start?: number | null;
  lang?: string | null;
  url?: string;
  title?: string | null;
  alt?: string | null;
  name?: string;
  identifier?: string;
  label?: string;
  attributes?: Record<string, string | null | undefined>;
  position?: { start: { offset?: number; column: number }; end: { offset?: number } };
  children?: MdastNode[];
};

// A single tilde is not strikethrough here, though GFM allows it: it would
// strike the words between two ranges ("3~5일, 7~9일"). The writer uses `~~`.
const createCommonMarkParser = () => unified()
  .use(remarkParse)
  .use(remarkGfm, { singleTilde: false })
  .use(remarkDirective);

const createWikiParser = (allowedOpeners?: ReadonlySet<number>) => createCommonMarkParser()
  // Tokenize before backslash escapes lose their source positions or GFM
  // splits a URL into a link. Use remark's opaque inline-literal buffer with
  // string content: references decode, but emphasis and links do not.
  .data('micromarkExtensions', [{ text: { 91: {
    tokenize(effects, ok, nok) {
      let escaped = false;
      const inside: typeof ok = (code) => {
        if (code === null || code <= -3 || code === 91 || (code === 93 && escaped)) return nok(code);
        escaped = code === 92 && !escaped;
        effects.consume(code);
        return code === 93 ? close : inside;
      };
      const close: typeof ok = (code) => {
        if (code !== 93) return nok(code);
        effects.consume(code);
        effects.exit('chunkString');
        effects.exit('htmlText');
        return ok;
      };
      return (first) => {
        if (allowedOpeners && !allowedOpeners.has(this.now().offset)) return nok(first);
        effects.enter('htmlText');
        effects.enter('chunkString', { contentType: 'string' });
        effects.consume(first);
        return (second) => {
          if (second !== 91) return nok(second);
          effects.consume(second);
          return inside;
        };
      };
    },
  } } }]);

const commonMarkParser = createCommonMarkParser();
const wikiParser = createWikiParser();

function parseMarkdownTree(source: string): MdastNode {
  let opener = source.indexOf('[[');
  if (opener === -1) return commonMarkParser.parse(source) as MdastNode;
  // An explicit link or image needs either a resource or a reference definition.
  if (!source.includes('](') && !source.includes(']:')) return wikiParser.parse(source) as MdastNode;

  // Let CommonMark decide which labels actually resolve, including nested text
  // and forward references. A GFM bare URL inside [[...]] is not such a label.
  const tree = commonMarkParser.parse(source) as MdastNode;
  const allowed = new Set<number>();
  const advance = (end: number, keep: boolean) => {
    while (opener !== -1 && opener < end) {
      if (keep) allowed.add(opener);
      opener = source.indexOf('[[', opener + 1);
    }
  };
  walkMdast(tree, (node) => {
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (start === undefined || end === undefined) return;
    if ((node.type === 'link' && source[start] === '[') || node.type === 'image' ||
      node.type === 'linkReference' || node.type === 'imageReference' || node.type === 'footnoteReference') {
      // The second '[' may itself open a shortcut reference: [[Guide]].
      advance(start - 1, true);
      advance(end, false);
    }
  });
  advance(source.length, true);
  return allowed.size ? createWikiParser(allowed).parse(source) as MdastNode : tree;
}

// Recognize details tags as inline HTML so a tag doesn't hide a nearby fenced
// block in an opaque CommonMark HTML block during marker discovery.
const detailsScanner = unified()
  .use(remarkParse)
  .data('micromarkExtensions', [{ disable: { null: ['htmlFlow'] } }])
  .use(remarkDirective);

const MAX_MARKDOWN_CHARS = 1_000_000;
const MAX_MARKDOWN_DEPTH = 128;
const MAX_MARKDOWN_NODES = 500_000;

function walkMdast(root: MdastNode, visit?: (node: MdastNode) => void): void {
  const stack = [{ children: [root], index: 0 }];
  let remaining = MAX_MARKDOWN_NODES;
  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (frame.index === frame.children.length) {
      stack.pop();
      continue;
    }
    if (stack.length > MAX_MARKDOWN_DEPTH + 1 || --remaining < 0) {
      throw new RangeError('Cannot read Markdown: the document is too deeply nested or has too many nodes.');
    }
    const node = frame.children[frame.index++];
    visit?.(node);
    if (node.children?.length) stack.push({ children: node.children, index: 0 });
  }
}

// Escapes remark adds that nothing needs: a lone tilde between other characters
// and an underscore inside a word cannot open anything. At the edge of a text
// node the neighbour may be a mark's delimiter, so those stay escaped.
const NEEDLESS_TILDE_ESCAPE_RE = /(?<=[^\\~])\\~(?=[^\\~])/g;
const NEEDLESS_UNDERSCORE_ESCAPE_RE = /(?<=[\p{L}\p{N}])\\_(?=[\p{L}\p{N}])/gu;

const createMarkdownStringifier = (gfm: { tablePipeAlign: boolean }) => unified()
  .use(remarkStringify, {
    bullet: '-',
    fences: true,
    // Adjacent strong and emphasis runs must not form one delimiter run.
    emphasis: '_',
    listItemIndent: 'one',
    resourceLink: true,
    strong: '*',
    handlers: {
      text: (node, _parent, state, info) => (node as MdastNode).name === 'wikiLink'
        ? node.value
        : state.safe(node.value, info)
          .replace(NEEDLESS_TILDE_ESCAPE_RE, '~')
          .replace(NEEDLESS_UNDERSCORE_ESCAPE_RE, '_'),
      // Serialize only actual details nodes. A text or code example stays in
      // the normal remark handlers and is never a candidate for replacement.
      // https://github.com/syntax-tree/mdast-util-to-markdown#handle
      html: (node, _parent, state, info) => {
        const html = node as MdastNode;
        if (html.name !== 'details') return html.value ?? '';
        const summary = escapeHtml(html.title ?? '').replace(/[\r\n]/g, (char) => char === '\r' ? '&#13;' : '&#10;');
        const body = state.containerFlow(node, {
          ...info,
          now: { line: info.now.line + 3, column: 1 + info.lineShift },
        });
        return `${html.value}\n<summary>${summary}</summary>\n\n${body ? `${body}\n` : ''}</details>`;
      },
    },
  })
  .use(remarkGfm, gfm)
  .use(remarkDirective);

const markdownStringifier = createMarkdownStringifier({ tablePipeAlign: true });
// Columns padded to their widest cell read well, and cost rows × width.
const compactTableStringifier = createMarkdownStringifier({ tablePipeAlign: false });

const DETAILS_START = 'inkio-details-start';
const DETAILS_END = '<!-- inkio:details-end -->';
const DETAILS_LINE_PREFIX = /(?:[ \t>]|(?:[-+*]|\d{1,9}[.)])(?=[ \t]))*/y;
const DETAILS_LINE_END = /[ \t]*(?=\r|\n|$)/y;

type DetailsMarker = {
  start: number;
  end: number;
  opening?: string;
  pair?: DetailsMarker;
};

function findDetailsMarkers(markdown: string): DetailsMarker[] {
  const markers: DetailsMarker[] = [];
  const pending: DetailsMarker[] = [];
  let opener: { start: number; end: number; open: boolean; summaryStart?: number } | undefined;
  let previousLineStart = -1;
  let prefixEnd = -1;

  walkMdast(detailsScanner.parse(markdown) as MdastNode, (node) => {
    const tag = node.type === 'html' ? node.value?.toLowerCase() : undefined;
    const opening = tag === '<details>' || tag === '<details open>';
    if (!opening && tag !== '<summary>' && tag !== '</summary>' && tag !== '</details>') return;
    const startPoint = node.position?.start;
    const start = startPoint?.offset;
    const end = node.position?.end.offset;
    if (!startPoint || start === undefined || end === undefined) return;
    const lineStart = start - startPoint.column + 1;
    if (lineStart !== previousLineStart) {
      previousLineStart = lineStart;
      DETAILS_LINE_PREFIX.lastIndex = lineStart;
      DETAILS_LINE_PREFIX.test(markdown);
      prefixEnd = DETAILS_LINE_PREFIX.lastIndex;
    }
    DETAILS_LINE_END.lastIndex = end;
    const endsLine = DETAILS_LINE_END.test(markdown);

    if (opening && start <= prefixEnd) {
      opener = { start, end, open: tag === '<details open>' };
    } else if (tag === '<summary>' && opener && opener.summaryStart === undefined) {
      if (/^[\t >\r\n]*$/.test(markdown.slice(opener.end, start))) opener.summaryStart = end;
      else opener = undefined;
    } else if (tag === '</summary>' && opener?.summaryStart !== undefined) {
      if (endsLine) {
        // Follow the old plain-text summary semantics. Keep existing HTML
        // references for remark to decode once, and encode attribute syntax.
        const summary = markdown.slice(opener.summaryStart, start)
          .replace(/<[^<>]*>/g, '')
          .replace(/["\\\r\n]/g, (char) => `&#${char.charCodeAt(0)};`);
        const marker = { start: opener.start, end, opening: `::${DETAILS_START}{summary="${summary}"${opener.open ? ' open=true' : ''}}` };
        markers.push(marker);
        pending.push(marker);
      }
      opener = undefined;
    } else if (tag === '</details>' && start <= prefixEnd && endsLine) {
      opener = undefined;
      const open = pending.pop();
      if (open) {
        const close = { start, end, pair: open };
        open.pair = close;
        markers.push(close);
      }
    }
  });
  return markers;
}

type OffsetShift = { end: number; shift: number };

function finishParsedTree(root: MdastNode, source: string, shifts: OffsetShift[] = []): MdastNode {
  const definitions = new Map<string, MdastNode>();
  const references: MdastNode[] = [];
  let nextShift = 0;
  let shift = 0;
  let literalEnd = -1;
  // The outer directive owns the literal; descendants still count toward the
  // parser limits. Disjoint source ranges let us translate offsets in order.
  const originalOffset = (pos: number) => {
    while (nextShift < shifts.length && shifts[nextShift].end <= pos) shift = shifts[nextShift++].shift;
    return pos + shift;
  };
  walkMdast(root, (node) => {
    if (node.type === 'definition' && node.identifier && !definitions.has(node.identifier)) {
      definitions.set(node.identifier, node);
    } else if (node.type === 'linkReference' || node.type === 'imageReference') {
      references.push(node);
    } else if (node.type === 'textDirective'
      || (node.type === 'leafDirective' && node.name !== 'toc')
      || (node.type === 'containerDirective' && node.name !== 'callout' && node.name !== 'details')) {
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      if (start !== undefined && end !== undefined && start >= literalEnd) {
        // The existing HTML fallback carries literal text into JSON, not DOM.
        node.type = 'html';
        node.value = source.slice(originalOffset(start), originalOffset(end));
        literalEnd = end;
      }
    }
  });
  for (const node of references) {
    const definition = node.identifier && definitions.get(node.identifier);
    if (!definition) continue;
    node.type = node.type === 'linkReference' ? 'link' : 'image';
    node.url = definition.url;
    node.title = definition.title;
  }
  return root;
}

function parseDetails(markdown: string): MdastNode {
  const markers = findDetailsMarkers(markdown);
  const positions = new Map<number, DetailsMarker>();
  const parts: string[] = [];
  const shifts: OffsetShift[] = [];
  // Leaf directives and comments cannot steal an enclosing `:::` fence.
  let offset = 0;
  let cursor = 0;
  for (const marker of markers) {
    if (!marker.pair) continue;
    const unchanged = markdown.slice(cursor, marker.start);
    const replacement = marker.opening ?? DETAILS_END;
    parts.push(unchanged, replacement);
    offset += unchanged.length;
    positions.set(offset, marker);
    offset += replacement.length;
    cursor = marker.end;
    shifts.push({ end: offset, shift: cursor - offset });
  }
  if (parts.length === 0) return finishParsedTree(parseMarkdownTree(markdown), markdown);

  parts.push(markdown.slice(cursor));
  const root = parseMarkdownTree(parts.join(''));
  // Pair markers only as siblings, so enclosing blockquotes, lists, and
  // directives keep exactly their original Markdown container boundaries.
  walkMdast(root, (node) => {
    if (!node.children?.some((child) => positions.has(child.position?.start.offset ?? -1))) return;
    const result: MdastNode[] = [];
    const open: { marker: DetailsMarker; index: number }[] = [];
    for (const child of node.children) {
      const offset = child.position?.start.offset ?? -1;
      const marker = positions.get(offset);
      const isOpening = child.type === 'leafDirective' && child.name === DETAILS_START;
      const isClosing = child.type === 'html' && child.value?.trim() === DETAILS_END;
      if (!marker || (marker.opening ? !isOpening : !isClosing)) {
        result.push(child);
        continue;
      }
      positions.delete(offset);
      if (isOpening) {
        open.push({ marker, index: result.length });
      } else {
        const last = open[open.length - 1];
        if (last && last.marker === marker.pair) {
          open.pop();
          const [start, ...children] = result.splice(last.index);
          result.push({ type: 'containerDirective', name: 'details', attributes: start.attributes, children });
          continue;
        }
      }
      result.push({ ...child, type: 'html', value: markdown.slice(marker.start, marker.end) });
    }
    node.children = result;
  });
  // Don't leave synthetic text behind if a marker was inside opaque HTML.
  return positions.size > 0
    ? finishParsedTree(parseMarkdownTree(markdown), markdown)
    : finishParsedTree(root, markdown, shifts);
}

function createTextNode(text: string, marks?: JsonMark[]): JSONContent | null {
  if (!text) {
    return null;
  }

  return marks && marks.length > 0
    ? { type: 'text', text, marks }
    : { type: 'text', text };
}

function pushInlineNode(nodes: JSONContent[], node: JSONContent | null) {
  if (!node) {
    return;
  }

  const previous = nodes[nodes.length - 1];
  if (
    previous?.type === 'text' &&
    node.type === 'text' &&
    JSON.stringify(previous.marks ?? []) === JSON.stringify(node.marks ?? [])
  ) {
    previous.text = `${previous.text ?? ''}${node.text ?? ''}`;
    return;
  }

  nodes.push(node);
}

function ensureBlockContent(content: JSONContent[]): JSONContent[] {
  return content.length > 0 ? content : [{ type: 'paragraph' }];
}

function toLinkMark(node: MdastNode): JsonMark | null {
  const href = node.url ?? '';
  if (!isSafeUrl(href)) return null;
  return {
    type: 'link',
    attrs: {
      href,
    },
  };
}

function withMark(marks: JsonMark[], mark: JsonMark): JsonMark[] {
  return [...marks, mark];
}

function mdastInlineToJson(nodes: MdastNode[] = [], schema?: Editor['schema'], marks: JsonMark[] = []): JSONContent[] {
  const content: JSONContent[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    switch (node.type) {
      case 'text':
        pushInlineNode(content, createTextNode(node.value ?? '', marks));
        break;
      case 'break':
        content.push({ type: 'hardBreak' });
        break;
      case 'inlineCode': {
        // Standalone output targets the core schema, where inline code is
        // exclusive. A live editor can explicitly allow other marks with it.
        const code = schema?.marks.code;
        const compatible = code && marks.length ? marks.filter(mark => {
          const outer = code.schema.marks[mark.type];
          return !outer || (!code.excludes(outer) && !outer.excludes(code));
        }) : [];
        pushInlineNode(content, createTextNode(node.value ?? '', withMark(compatible, { type: 'code' })));
        break;
      }
      case 'strong':
        mdastInlineToJson(node.children, schema, withMark(marks, { type: 'bold' })).forEach((child) =>
          pushInlineNode(content, child),
        );
        break;
      case 'emphasis':
        mdastInlineToJson(node.children, schema, withMark(marks, { type: 'italic' })).forEach((child) =>
          pushInlineNode(content, child),
        );
        break;
      case 'delete':
        mdastInlineToJson(node.children, schema, withMark(marks, { type: 'strike' })).forEach((child) =>
          pushInlineNode(content, child),
        );
        break;
      case 'link': {
        const linkMark = toLinkMark(node);
        const nextMarks = linkMark ? withMark(marks, linkMark) : marks;
        mdastInlineToJson(node.children, schema, nextMarks).forEach((child) =>
          pushInlineNode(content, child),
        );
        break;
      }
      case 'image': {
        const src = node.url ?? '';
        const attrs: NonNullable<JSONContent['attrs']> = { src, alt: node.alt ?? null, title: node.title ?? null };
        const meta = nodes[i + 1]?.type === 'html' && IMAGE_META.exec(nodes[i + 1].value ?? '');
        const caption = meta && meta[3] && nodes[i + 2]?.type === 'emphasis' ? nodes[i + 2].children : undefined;
        // GFM may auto-link a URL in plain caption text. An image or another
        // edited construct must go through normal conversion, not disappear.
        if (meta && (!meta[3] || caption?.every((child) => child.type === 'text' ||
          (child.type === 'link' && child.children?.length === 1 && child.children[0].type === 'text')))) {
          i++;
          if (meta[1]) attrs.width = meta[1];
          if (meta[2]) attrs.align = meta[2];
          if (caption) {
            attrs.caption = caption.map((child) => child.value ?? child.children?.[0].value).join('');
            i++;
          }
        }
        if (isSafeUrl(src) && !src.startsWith(UPLOAD_PLACEHOLDER_PREFIX)) content.push({ type: 'imageBlock', attrs });
        else pushInlineNode(content, createTextNode([node.alt, attrs.caption].filter(Boolean).join(' '), marks));
        break;
      }
      case 'footnoteReference':
        pushInlineNode(content, createTextNode(`[^${node.label ?? node.identifier}]`, marks));
        break;
      case 'html': {
        const literal = node.value ?? '';
        // Real HTML starts with '<'; only the wiki tokenizer buffers [[...]].
        const href = literal.startsWith('[[') && literal.endsWith(']]') ? literal.slice(2, -2).trim() : '';
        if (isSafeUrl(href) && !/[[\]\r\n]/.test(href)) {
          content.push({ type: 'wikiLink', attrs: { href }, ...(marks.length ? { marks } : {}) });
        } else {
          pushInlineNode(content, createTextNode(literal, marks));
        }
        break;
      }
      default:
        if (node.children) {
          mdastInlineToJson(node.children, schema, marks).forEach((child) => pushInlineNode(content, child));
        } else if (node.value) {
          pushInlineNode(content, createTextNode(node.value, marks));
        }
        break;
    }
  }

  return content;
}

// GFM permits images wherever text can occur; the editor's images are blocks.
// Split only at images, preserving the marks and order of the text on either side.
function blocksFromInline(nodes: MdastNode[] | undefined, schema?: Editor['schema'], type = 'paragraph', attrs?: JSONContent['attrs']): JSONContent[] {
  const inline = mdastInlineToJson(nodes, schema);
  const blocks: JSONContent[] = [];
  let start = 0;
  for (let i = 0; i < inline.length; i++) {
    if (inline[i].type !== 'imageBlock') continue;
    if (i > start) blocks.push({ type, ...(attrs && { attrs }), content: inline.slice(start, i) });
    blocks.push(inline[i]);
    start = i + 1;
  }
  if (start < inline.length || !blocks.length) {
    const block: JSONContent = { type };
    if (attrs) block.attrs = attrs;
    if (inline.length) block.content = start ? inline.slice(start) : inline;
    blocks.push(block);
  }
  return blocks;
}

// This exact, adjacent comment carries editor-only layout. The caption following
// it is ordinary visible emphasis in any Markdown reader, not hidden metadata.
const IMAGE_WIDTH = '[1-9]\\d(?:\\.\\d{1,16})?%';
const VALID_IMAGE_WIDTH = new RegExp(`^${IMAGE_WIDTH}$`);
const IMAGE_META = new RegExp(`^<!-- inkio:image(?: width=(${IMAGE_WIDTH}))?(?: align=(left|right))?( caption)? -->$`);

function listItemToJson(node: MdastNode, task: boolean, budget: MarkdownReadBudget): JSONContent {
  const content = mdastBlocksToJson(node.children, budget);
  if (content[0]?.type !== 'paragraph') content.unshift({ type: 'paragraph' });
  return {
    type: task ? 'taskItem' : 'listItem',
    ...(task ? { attrs: { checked: Boolean(node.checked) } } : {}),
    content,
  };
}

function splitListChildren(node: MdastNode): Array<{ task: boolean; children: MdastNode[] }> {
  const groups: Array<{ task: boolean; children: MdastNode[] }> = [];

  for (const child of node.children ?? []) {
    const task = child.checked !== null && child.checked !== undefined;
    const lastGroup = groups[groups.length - 1];

    if (!lastGroup || lastGroup.task !== task) {
      groups.push({ task, children: [child] });
      continue;
    }

    lastGroup.children.push(child);
  }

  return groups;
}

function directiveToJson(node: MdastNode, budget: MarkdownReadBudget): JSONContent[] {
  if (node.name === 'callout') {
    // Same write boundary as the callout commands: markdown import must not
    // persist payloads that renderHTML alone would have to catch.
    return [{
      type: 'callout',
      attrs: {
        icon: normalizeCalloutIcon(node.attributes?.icon) ?? null,
        color: normalizeCalloutColor(node.attributes?.color) ?? null,
      },
      content: ensureBlockContent(mdastBlocksToJson(node.children, budget)),
    }];
  }

  const summary = createTextNode(node.attributes?.summary ?? '');
  const bodyContent = ensureBlockContent(mdastBlocksToJson(node.children, budget));
  return [{
    type: 'details',
    attrs: { open: node.attributes?.open === 'true' },
    content: [
      summary ? { type: 'detailsSummary', content: [summary] } : { type: 'detailsSummary' },
      { type: 'detailsContent', content: bodyContent },
    ],
  }];
}

type TableSpan = { row: number; column: number; colspan: number; rowspan: number };
type MarkdownReadBudget = { spanEntries: number; spanCells: number; schema?: Editor['schema'] };
const MAX_READ_SPAN_ENTRIES = 100_000;
const MAX_READ_SPAN_CELLS = 1_000_000;

/**
 * GFM has no merged cells. The writer keeps every column in place with empty
 * cells, so other tools show an aligned table, and notes the merges in a comment
 * they don't show, so this reader restores them.
 */
const TABLE_SPANS_COMMENT_START = /^<!--\s*inkio:table-spans(?=\s)/;
const TABLE_SPAN_ENTRY = /\s+(\d+),(\d+),(\d+),(\d+)/y;

function parseTableSpansComment(value: string | undefined, budget: MarkdownReadBudget): TableSpan[] | null {
  const comment = value?.trim() ?? '';
  const prefix = TABLE_SPANS_COMMENT_START.exec(comment);
  if (!prefix || !comment.endsWith('-->')) return null;
  const body = comment.slice(prefix[0].length, -3).trimEnd();
  if (body.length === 0) return null;

  const spans: TableSpan[] = [];
  TABLE_SPAN_ENTRY.lastIndex = 0;
  while (TABLE_SPAN_ENTRY.lastIndex < body.length) {
    const entry = TABLE_SPAN_ENTRY.exec(body);
    if (!entry) return null;
    if (--budget.spanEntries < 0) throw new RangeError('Cannot read Markdown: too many table spans.');
    const row = Number(entry[1]);
    const column = Number(entry[2]);
    const colspan = Number(entry[3]);
    const rowspan = Number(entry[4]);
    if (Number.isSafeInteger(row) && Number.isSafeInteger(column)
      && Number.isSafeInteger(colspan) && Number.isSafeInteger(rowspan)) {
      spans.push({ row, column, colspan, rowspan });
    }
  }
  return spans;
}

/** Merges valid rectangles of cells without discarding data or rescanning unbounded areas. */
function applyTableSpans(rows: JSONContent[], spans: TableSpan[], budget: MarkdownReadBudget): JSONContent[] {
  if (spans.length === 0) return rows;
  const covered = { type: 'covered' };
  const width = rows.reduce((max, row) => Math.max(max, row.content?.length ?? 0), 0);
  for (const { row, column, colspan, rowspan } of spans) {
    const area = colspan * rowspan;
    if (colspan < 1 || rowspan < 1 || area < 2 || row + rowspan > rows.length || column + colspan > width) {
      continue;
    }
    // Charge the proposal even if a cell later invalidates it.
    budget.spanCells -= area;
    if (budget.spanCells < 0) throw new RangeError('Cannot read Markdown: table spans cover too many cells.');

    let fits = true;
    for (let r = row; fits && r < row + rowspan; r += 1) {
      for (let c = column; fits && c < column + colspan; c += 1) {
        const cell = rows[r].content?.[c];
        const isOrigin = r === row && c === column;
        fits = Boolean(cell && cell !== covered && !cell.attrs
          && (isOrigin || !cell.content?.some((block) => block.type !== 'paragraph' || block.content?.length)));
      }
    }
    if (!fits) continue;

    rows[row].content![column].attrs = { colspan, rowspan };
    for (let r = row; r < row + rowspan; r += 1) {
      for (let c = column; c < column + colspan; c += 1) {
        if (r !== row || c !== column) rows[r].content![c] = covered;
      }
    }
  }

  for (const row of rows) row.content = row.content?.filter((cell) => cell !== covered);
  return rows;
}

/**
 * Documents can come from anywhere, and a few bytes of `colspan` can ask for a
 * huge table: every row is padded to the widest one. Merges in one document may
 * add this many cells; a table past that is written without its merges. Writing
 * is synchronous, and `toMdastRoot` resets this for each document.
 */
const MAX_CELLS_ADDED_BY_SPANS = 100_000;
let spanCellBudget = MAX_CELLS_ADDED_BY_SPANS;

/**
 * GFM pads a row shorter than the widest one. A table built in an editor is
 * rectangular and pads nothing, so this only stops malformed documents: dropping
 * their cells would lose text silently, so they fail instead.
 */
const MAX_PADDING_CELLS = 1_000_000;
let paddingCellBudget = MAX_PADDING_CELLS;

/**
 * Aligning columns repeats a column's widest cell in every row, so one long cell
 * over many rows grows without any malformed table. Past this much, a document's
 * tables are written unaligned: still the same tables, in far fewer bytes.
 */
const MAX_ALIGNED_TABLE_CHARS = 5_000_000;
let alignedTableChars = 0;

/** Roughly what a node takes in Markdown: its text, a link's address, and its syntax. */
function writtenLength(node: MdastNode): number {
  const own = [node.value, node.url, node.title, node.alt].reduce((sum, text) => sum + (text?.length ?? 0), 4);
  return (node.children ?? []).reduce((sum, child) => sum + writtenLength(child), own);
}

function chargeTablePadding(rows: MdastNode[]): void {
  const lengths = rows.map((row) => row.children?.length ?? 0);
  const width = lengths.reduce((widest, length) => Math.max(widest, length), 0);
  for (const length of lengths) paddingCellBudget -= width - length;
  if (paddingCellBudget < 0) {
    throw new RangeError('Cannot write Markdown: a table has rows of very different lengths.');
  }

  const columnWidths: number[] = [];
  for (const row of rows) {
    (row.children ?? []).forEach((cell, column) => {
      columnWidths[column] = Math.max(columnWidths[column] ?? 0, writtenLength(cell));
    });
  }
  alignedTableChars += rows.length * columnWidths.reduce((sum, columnWidth) => sum + columnWidth, 0);
}

function toSpan(value: unknown): number {
  const span = Number(value);
  return Number.isSafeInteger(span) && span > 0 ? span : 1;
}

type TableLayout = { rows: MdastNode[]; spans: TableSpan[] };

/**
 * The GFM rows of a table, with an empty cell wherever a merged cell covers a
 * column. Null when the cells this adds, measured on the finished table, don't
 * fit the budget: a merge also pushes later cells right, which widens every row.
 */
function layoutMergedTable(node: JSONContent): TableLayout | null {
  const sourceRows = node.content ?? [];
  const covered = new Set<string>();
  const spans: TableSpan[] = [];

  const rows: MdastNode[] = [];
  for (const [rowIndex, row] of sourceRows.entries()) {
    const children: MdastNode[] = [];
    const fillCovered = () => {
      while (covered.has(`${rowIndex},${children.length}`)) {
        children.push({ type: 'tableCell', children: [] });
      }
    };

    for (const cell of row.content ?? []) {
      fillCovered();
      const column = children.length;
      const colspan = toSpan(cell.attrs?.colspan);
      const rowspan = Math.min(toSpan(cell.attrs?.rowspan), sourceRows.length - rowIndex);
      const area = colspan * rowspan;
      if (area > 1) {
        // Charged before expanding and kept even if this table gives up, so
        // tables that fail can't repeat the work without limit.
        if (area > spanCellBudget) return null;
        spanCellBudget -= area;
        spans.push({ row: rowIndex, column, colspan, rowspan });
        for (let r = rowIndex; r < rowIndex + rowspan; r += 1) {
          for (let c = column; c < column + colspan; c += 1) {
            if (r !== rowIndex || c !== column) covered.add(`${r},${c}`);
          }
        }
      }
      children.push(jsonTableCellToMdast(cell));
    }
    fillCovered();
    rows.push({ type: 'tableRow', children });
  }

  const widest = (lengths: number[]) => lengths.reduce((max, length) => Math.max(max, length), 0);
  const plainWidth = widest(sourceRows.map((row) => row.content?.length ?? 0));
  const width = widest(rows.map((row) => row.children?.length ?? 0));
  const widening = (width - plainWidth) * sourceRows.length;
  if (widening > spanCellBudget) return null;

  spanCellBudget -= widening;
  return { rows, spans };
}

function jsonTableToMdast(node: JSONContent): TableLayout {
  const layout = layoutMergedTable(node) ?? {
    rows: (node.content ?? []).map((row) => ({
      type: 'tableRow',
      children: (row.content ?? []).map((cell) => jsonTableCellToMdast(cell)),
    })),
    spans: [],
  };
  chargeTablePadding(layout.rows);
  return layout;
}

function tocMaxLevel(value: unknown): number {
  const level = typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : value;
  return typeof level === 'number' && Number.isSafeInteger(level) ? level : 3;
}

function mdastBlocksToJson(nodes: MdastNode[] | undefined, budget: MarkdownReadBudget): JSONContent[] {
  const content: JSONContent[] = [];
  let tableSpans: TableSpan[] | null = null;

  for (const [index, node] of (nodes ?? []).entries()) {
    if (node.type === 'leafDirective' && node.name === 'toc') {
      content.push({ type: 'tocBlock', attrs: { maxLevel: tocMaxLevel(node.attributes?.maxLevel) } });
      continue;
    }
    switch (node.type) {
      case 'heading':
        blocksFromInline(node.children, budget.schema, 'heading', { level: Math.min(Math.max(node.depth ?? 1, 1), 6) })
          .forEach((child) => content.push(child));
        break;
      case 'paragraph':
        blocksFromInline(node.children, budget.schema).forEach((child) => content.push(child));
        break;
      case 'footnoteDefinition': {
        const body = mdastBlocksToJson(node.children, budget);
        const label = `[^${node.label ?? node.identifier}]:`;
        const first = body[0];
        if (first?.type === 'paragraph') {
          const inline = first.content ??= [];
          const prefix = label + (inline.length ? ' ' : '');
          if (inline[0]?.type === 'text' && !inline[0].marks?.length) inline[0].text = prefix + inline[0].text;
          else inline.unshift({ type: 'text', text: prefix });
        } else body.unshift({ type: 'paragraph', content: [{ type: 'text', text: label }] });
        body.forEach((child) => content.push(child));
        break;
      }
      case 'blockquote':
        content.push({
          type: 'blockquote',
          content: ensureBlockContent(mdastBlocksToJson(node.children, budget)),
        });
        break;
      case 'list': {
        let start = node.start ?? 1;
        for (const group of splitListChildren(node)) {
          content.push({
            type: group.task ? 'taskList' : (node.ordered ? 'orderedList' : 'bulletList'),
            ...(group.task || !node.ordered ? {} : { attrs: { start: start === 1 ? null : start } }),
            content: group.children.map((child) => listItemToJson(child, group.task, budget)),
          });
          start += group.children.length;
        }
        break;
      }
      case 'code':
        content.push({
          type: 'codeBlock',
          attrs: {
            language: node.lang ?? null,
          },
          content: node.value ? [{ type: 'text', text: node.value }] : undefined,
        });
        break;
      case 'thematicBreak':
        content.push({ type: 'horizontalRule' });
        break;
      case 'table': {
        const rows = (node.children ?? []).map((row, rowIndex) => ({
          type: 'tableRow',
          content: (row.children ?? []).map((cell) => ({
            type: rowIndex === 0 ? 'tableHeader' : 'tableCell',
            content: blocksFromInline(cell.children, budget.schema),
          })),
        }));
        content.push({
          type: 'table',
          content: tableSpans ? applyTableSpans(rows, tableSpans, budget) : rows,
        });
        tableSpans = null;
        break;
      }
      case 'containerDirective':
        directiveToJson(node, budget).forEach((child) => content.push(child));
        break;
      case 'html':
        if (nodes?.[index + 1]?.type === 'table') {
          tableSpans = parseTableSpansComment(node.value, budget);
          if (tableSpans) break;
        }
        content.push({
          type: 'paragraph',
          content: node.value ? [{ type: 'text', text: node.value }] : undefined,
        });
        break;
      default:
        if (node.children) {
          mdastBlocksToJson(node.children, budget).forEach((child) => content.push(child));
        } else if (node.value) {
          content.push({
            type: 'paragraph',
            content: [{ type: 'text', text: node.value }],
          });
        }
        break;
    }
  }

  return content;
}

function textFromJson(node: JSONContent | null | undefined): string {
  if (!node) {
    return '';
  }

  if (node.type === 'text') {
    return node.text ?? '';
  }
  if (node.type === 'hardBreak') return '\n';
  if (node.type === 'bookmark') return String(node.attrs?.title || node.attrs?.url || '');
  if (!node.content) return inlineReferenceLabel(node) || String(node.attrs?.label ?? '');

  return (node.content ?? []).map((child) => textFromJson(child)).join('');
}

function inlineReferenceLabel(node: JSONContent): string {
  if (node.type === 'wikiLink') {
    const { label, href } = node.attrs ?? {};
    return (typeof label === 'string' && label.trim()) || (typeof href === 'string' ? href.trim() : '');
  }
  return inlineReferenceText(node.type, node.attrs) ?? '';
}

// Merge the Markdown that remains after unsupported marks are dropped, not
// the editor's original text runs. Shared links and nested marks stay open.
function appendInline(target: MdastNode[], node: MdastNode): void {
  const last = target[target.length - 1];
  if (last?.type === node.type && last.url === node.url && last.name === node.name) {
    if (last.children && node.children) {
      for (const child of node.children) appendInline(last.children, child);
      return;
    }
    if (!node.name && (node.type === 'text' || node.type === 'inlineCode')) {
      last.value = (last.value ?? '') + (node.value ?? '');
      return;
    }
  }
  target.push(node);
}

function jsonMarksToMdast(node: MdastNode, marks: JsonMark[] = []): MdastNode {
  const linkMark = marks.find((mark) => mark.type === 'link');
  const hasCode = marks.some((mark) => mark.type === 'code');
  const hasBold = marks.some((mark) => mark.type === 'bold');
  const hasItalic = marks.some((mark) => mark.type === 'italic');
  const hasStrike = marks.some((mark) => mark.type === 'strike');

  let current = hasCode && node.type === 'text'
    ? { type: 'inlineCode', value: node.value ?? '' }
    : node;

  if (hasBold) {
    current = { type: 'strong', children: [current] };
  }

  if (hasItalic) {
    current = { type: 'emphasis', children: [current] };
  }

  if (hasStrike) {
    current = { type: 'delete', children: [current] };
  }

  if (linkMark) {
    const href = String(linkMark.attrs?.href ?? '');
    // Never stringify an unsafe href back into markdown link syntax.
    if (isSafeUrl(href)) {
      current = {
        type: 'link',
        url: href,
        children: [current],
      };
    }
  }

  return current;
}

function jsonInlineToMdast(nodes: JSONContent[] = []): MdastNode[] {
  const content: MdastNode[] = [];

  for (const node of nodes) {
    switch (node.type) {
      case 'text': {
        const text = node.text ?? '';
        if (!text) {
          break;
        }

        appendInline(content, jsonMarksToMdast({ type: 'text', value: text }, node.marks));
        break;
      }
      case 'hardBreak':
        content.push({ type: 'break' });
        break;
      case 'mention':
      case 'hashTag': {
        const value = inlineReferenceLabel(node);
        if (value) appendInline(content, jsonMarksToMdast({ type: 'text', value }, node.marks));
        break;
      }
      case 'wikiLink': {
        const name = inlineReferenceLabel(node);
        if (!name) {
          break;
        }
        if (/[[\]\r\n]/.test(name) || !isSafeUrl(name)) {
          appendInline(content, jsonMarksToMdast({ type: 'text', value: name }, node.marks));
          break;
        }
        // The delimiters stay literal for other wiki readers. The payload is
        // HTML-escaped and Markdown punctuation that could change its meaning
        // is encoded as references; remark decodes those as text on import.
        const label = escapeHtml(name)
          .replace(/[\\`*~:|]/g, (char) => `&#${char.charCodeAt(0)};`)
          .replace(/(?<![\p{L}\p{N}])_|_(?![\p{L}\p{N}])/gu, '&#95;');
        appendInline(content, jsonMarksToMdast({ type: 'text', name: 'wikiLink', value: `[[${label}]]` }, node.marks));
        break;
      }
      default:
        if (node.text) {
          content.push({ type: 'text', value: node.text });
        } else if (node.content) {
          jsonInlineToMdast(node.content).forEach((child) => content.push(child));
        }
        break;
    }
  }

  return content;
}

function jsonParagraphToMdast(node: JSONContent): MdastNode {
  const children = jsonInlineToMdast(node.content);
  if (children[children.length - 1]?.type === 'break') {
    // CommonMark needs more inline content after a hard break. An empty link
    // keeps it in this paragraph without adding text or a custom HTML token.
    children.push({ type: 'link', url: '', children: [] });
  }
  return { type: 'paragraph', children };
}

function jsonListItemToMdast(node: JSONContent, task: boolean): MdastNode {
  const children = jsonBlocksToMdast(node.content);
  if (children[0]?.type === 'paragraph' && !children[0].children?.length) {
    // The paragraph required by the editor isn't needed before a Markdown
    // heading or image. GFM does require phrasing *after* a checkbox, though.
    if (children.length > 1 && (!task || children[1].type === 'paragraph')) children.shift();
    else if (task) children[0].children = [{ type: 'link', url: '', children: [] }];
  }
  return {
    type: 'listItem',
    spread: false,
    ...(task ? { checked: Boolean(node.attrs?.checked) } : {}),
    children,
  };
}

function jsonImageToMdast(node: JSONContent): MdastNode[] {
  const attrs = node.attrs ?? {};
  const alt = typeof attrs.alt === 'string' ? attrs.alt : '';
  const caption = typeof attrs.caption === 'string' ? attrs.caption : '';
  if (!isSafeUrl(attrs.src) || attrs.src.startsWith(UPLOAD_PLACEHOLDER_PREFIX)) {
    const value = [alt, caption].filter(Boolean).join(' ');
    return value ? [{ type: 'text', value }] : [];
  }
  const children: MdastNode[] = [{
    type: 'image', url: attrs.src, alt, title: typeof attrs.title === 'string' ? attrs.title : null,
  }];
  const width = typeof attrs.width === 'string' && VALID_IMAGE_WIDTH.test(attrs.width) ? ` width=${attrs.width}` : '';
  const align = attrs.align === 'left' || attrs.align === 'right' ? ` align=${attrs.align}` : '';
  if (width || align || caption) {
    children.push({ type: 'html', value: `<!-- inkio:image${width}${align}${caption ? ' caption' : ''} -->` });
    if (caption) {
      // Entities keep a plain caption literal even at emphasis boundaries or
      // inside a GFM table (including a pipe, newline, or would-be HTML tag).
      const label = caption.replace(/[&<>\[\]\\*_`~:|.!@\r\n]|^\s|\s$/gu, (char) => `&#${char.codePointAt(0)};`);
      children.push({ type: 'html', value: `*${label}*` });
    }
  }
  return children;
}

function jsonTableCellToMdast(node: JSONContent): MdastNode {
  // GFM cells hold phrasing content only, but a JSON cell may carry several
  // blocks: serialize every block (joined by a space) instead of dropping
  // all but the first.
  const inline: MdastNode[] = [];
  const append = (block: JSONContent) => {
    let children: MdastNode[];
    if (block.type === 'imageBlock') children = jsonImageToMdast(block);
    else if (block.type === 'paragraph' || block.type === 'heading' || block.type === 'detailsSummary') {
      children = jsonInlineToMdast(block.content);
    } else if (block.content && block.type !== 'codeBlock') {
      block.content.forEach(append);
      return;
    } else {
      const value = textFromJson(block);
      children = value ? [{ type: 'text', value }] : [];
    }
    if (!children.length) return;
    const last = inline[inline.length - 1];
    if (last && !(last.type === 'text' && /\s$/.test(last.value!))
      && !(children[0].type === 'text' && /^\s/.test(children[0].value!))) {
      inline.push({ type: 'text', value: ' ' });
    }
    for (const child of children) inline.push(child);
  };
  node.content?.forEach(append);

  return {
    type: 'tableCell',
    children: inline,
  };
}

function calloutAttributes(node: JSONContent): Record<string, string> | undefined {
  const attrs: Record<string, string> = {};
  if (typeof node.attrs?.color === 'string' && node.attrs.color.length > 0) {
    attrs.color = node.attrs.color;
  }
  if (typeof node.attrs?.icon === 'string' && node.attrs.icon.length > 0) {
    attrs.icon = node.attrs.icon;
  }

  return Object.keys(attrs).length > 0 ? attrs : undefined;
}

function jsonDetailsToMdast(node: JSONContent): MdastNode {
  const summaryNode = node.content?.find((child) => child.type === 'detailsSummary');
  const contentNode = node.content?.find((child) => child.type === 'detailsContent');

  return {
    type: 'html',
    name: 'details',
    value: node.attrs?.open === true ? '<details open>' : '<details>',
    title: textFromJson(summaryNode),
    children: jsonBlocksToMdast(contentNode?.content ?? [{ type: 'paragraph' }]),
  };
}

function jsonBlocksToMdast(nodes: JSONContent[] = []): MdastNode[] {
  const content: MdastNode[] = [];

  for (const node of nodes) {
    switch (node.type) {
      case 'paragraph':
        content.push(jsonParagraphToMdast(node));
        break;
      case 'heading':
        content.push({
          type: 'heading',
          depth: Number(node.attrs?.level ?? 1),
          children: jsonInlineToMdast(node.content ?? []),
        });
        break;
      case 'blockquote':
        content.push({
          type: 'blockquote',
          children: jsonBlocksToMdast(node.content ?? []),
        });
        break;
      case 'bulletList':
        content.push({
          type: 'list',
          spread: false,
          ordered: false,
          children: (node.content ?? []).map((child) => jsonListItemToMdast(child, false)),
        });
        break;
      case 'orderedList':
        content.push({
          type: 'list',
          spread: false,
          ordered: true,
          start: typeof node.attrs?.start === 'number' ? node.attrs.start : 1,
          children: (node.content ?? []).map((child) => jsonListItemToMdast(child, false)),
        });
        break;
      case 'taskList':
        content.push({
          type: 'list',
          spread: false,
          ordered: false,
          children: (node.content ?? []).map((child) => jsonListItemToMdast(child, true)),
        });
        break;
      case 'codeBlock':
        content.push({
          type: 'code',
          lang: typeof node.attrs?.language === 'string' ? node.attrs.language : null,
          value: textFromJson(node),
        });
        break;
      case 'horizontalRule':
        content.push({ type: 'thematicBreak' });
        break;
      case 'imageBlock':
        // A root-level phrasing node would merge surrounding Markdown blocks.
        content.push({ type: 'paragraph', children: jsonImageToMdast(node) });
        break;
      case 'table': {
        const { rows, spans } = jsonTableToMdast(node);
        if (spans.length > 0) {
          const entries = spans.map((span) => `${span.row},${span.column},${span.colspan},${span.rowspan}`);
          content.push({ type: 'html', value: `<!-- inkio:table-spans ${entries.join(' ')} -->` });
        }
        content.push({
          type: 'table',
          children: rows,
        });
        break;
      }
      case 'callout':
        content.push({
          type: 'containerDirective',
          name: 'callout',
          attributes: calloutAttributes(node),
          children: jsonBlocksToMdast(node.content ?? [{ type: 'paragraph' }]),
        });
        break;
      case 'details':
        content.push(jsonDetailsToMdast(node));
        break;
      case 'tocBlock': {
        const maxLevel = tocMaxLevel(node.attrs?.maxLevel);
        content.push({ type: 'leafDirective', name: 'toc', attributes: maxLevel === 3 ? undefined : { maxLevel: String(maxLevel) } });
        break;
      }
      case 'bookmark': {
        const bookmarkUrl = typeof node.attrs?.url === 'string' ? node.attrs.url : '';
        if (bookmarkUrl.length > 0 && isSafeUrl(bookmarkUrl)) {
          content.push({
            type: 'paragraph',
            children: [{
              type: 'link',
              url: bookmarkUrl,
              children: [{
                type: 'text',
                value: String(node.attrs?.title ?? bookmarkUrl),
              }],
            }],
          });
          break;
        }
        if (bookmarkUrl.length > 0) {
          content.push({
            type: 'paragraph',
            children: [{
              type: 'text',
              value: String(node.attrs?.title ?? bookmarkUrl),
            }],
          });
          break;
        }

        content.push({
          type: 'paragraph',
          children: [{
            type: 'text',
            value: String(node.attrs?.title ?? ''),
          }],
        });
        break;
      }
      case 'comment':
        break;
      default:
        if (node.content) {
          jsonBlocksToMdast(node.content).forEach((child) => content.push(child));
        } else {
          const value = textFromJson(node);
          if (value) content.push({ type: 'paragraph', children: [{ type: 'text', value }] });
        }
        break;
    }
  }

  return content;
}

function toMdastRoot(content: JSONContent): MdastNode {
  spanCellBudget = MAX_CELLS_ADDED_BY_SPANS;
  paddingCellBudget = MAX_PADDING_CELLS;
  alignedTableChars = 0;
  const docContent = content.type === 'doc' ? (content.content ?? []) : [content];
  return {
    type: 'root',
    children: jsonBlocksToMdast(docContent),
  };
}

function parseToMdast(markdown: string): MdastNode {
  if (markdown.length > MAX_MARKDOWN_CHARS) {
    throw new RangeError('Cannot read Markdown: the document exceeds 1,000,000 characters.');
  }
  return /<details(?: open)?>/i.test(markdown)
    ? parseDetails(markdown)
    : finishParsedTree(parseMarkdownTree(markdown), markdown);
}

function stringifyFromMdast(root: MdastNode): string {
  const stringifier = alignedTableChars > MAX_ALIGNED_TABLE_CHARS ? compactTableStringifier : markdownStringifier;
  return String(stringifier.stringify(root as Parameters<typeof stringifier.stringify>[0])).trim();
}

function readMarkdown(source: string, schema?: Editor['schema']): JSONContent {
  const root = parseToMdast(source);
  const budget = { spanEntries: MAX_READ_SPAN_ENTRIES, spanCells: MAX_READ_SPAN_CELLS, schema };
  return { type: 'doc', content: ensureBlockContent(mdastBlocksToJson(root.children, budget)) };
}

/** Creates an adapter with the same input limits and HTML rules as {@link parseMarkdown}. */
export function createMarkdownAdapter() {
  return {
    parse: parseMarkdown,
    stringify(content: JSONContent): string {
      return stringifyFromMdast(toMdastRoot(content));
    },
  };
}

/**
 * Reads Markdown as editor content. Unknown HTML is literal text; supported
 * `<details>` blocks use plain-text summaries, and unsupported standalone
 * images become paragraphs containing their alt text, if any.
 *
 * @throws {RangeError} For more than 1,000,000 UTF-16 code units, 128 AST
 * levels below the root, 500,000 AST nodes, 100,000 table span entries, or
 * 1,000,000 candidate table span cells across the document.
 */
export function parseMarkdown(markdown: string): JSONContent {
  return readMarkdown(markdown);
}

/**
 * Writes supported Markdown constructs, with escaped wiki labels and details
 * summaries. Only details nodes get HTML wrappers; fenced examples stay code.
 */
export function stringifyMarkdown(content: JSONContent): string {
  return createMarkdownAdapter().stringify(content);
}

export type MarkdownAccess = {
  markdown: string;
};

export type MarkdownEditor<T extends Editor = InkioEditor> = T & MarkdownAccess;

type InheritedConfig<O, S, N extends string> = Partial<ExtensionConfig<O, S>> & { name?: N; onBeforeCreate?: never };

// configure and ordinary extend inherit the installer. If extend overrides
// onBeforeCreate, Tiptap's original (unbranded) overload remains available.
type MarkdownExtension<O = any, S = any, N extends string = 'inkioMarkdown'> = {
  name: N;
  configure(options?: Partial<O>): MarkdownExtension<O, S, N>;
  extend<Options = O, Storage = S, const Name extends string = N>(
    config?: InheritedConfig<Options, Storage, Name> | (() => InheritedConfig<Options, Storage, Name>),
  ): MarkdownExtension<Options, Storage, N | Name>;
} & EditorExtensionAccess<MarkdownAccess> & Extension<O, S>;

const markdownEditors = new WeakSet<Editor>();

/** Adds Markdown access to registered editors without changing paste behavior. */
export const Markdown = Extension.create({
  name: 'inkioMarkdown',
  onBeforeCreate({ editor }) {
    if (markdownEditors.has(editor)) return;
    if ('markdown' in editor) {
      throw new TypeError('Cannot install Inkio Markdown: editor.markdown already exists.');
    }

    let cachedDoc: Editor['state']['doc'] | undefined;
    let cachedMarkdown: string;
    Object.defineProperty(editor, 'markdown', {
      get(): string {
        const { doc } = editor.state;
        if (doc !== cachedDoc) {
          cachedMarkdown = stringifyMarkdown(doc.toJSON());
          cachedDoc = doc;
        }
        return cachedMarkdown;
      },
      set(source: string) {
        const doc = editor.schema.nodeFromJSON(readMarkdown(source, editor.schema));
        doc.check();
        const before = editor.state.doc;
        if (doc.eq(before)) return;
        // Filters can veto a replacement, or an appended transaction can restore
        // the old content. Other normalizations need not equal the requested doc.
        if (!editor.commands.setContent(doc) || editor.state.doc.eq(before)) {
          throw new RangeError('Cannot set Markdown: the editor rejected the replacement.');
        }
      },
    });
    markdownEditors.add(editor);
  },
}) as MarkdownExtension;

// Markdown copied as plain text: a block marker at the start of a line, or a
// span only Markdown writes. Prose with a stray `*` or `-` stays prose.
const MARKDOWN_PASTE_RE = /^ *(?:#{1,6} |[-*+] |\d+\. |> |```|\|.*\|$|-{3,} *$)|\*\*\S|~~\S|\[[^[\]\r\n]+\]\([^\s[\]]+\)/m;

/**
 * Turns Markdown pasted as plain text into document content. It lives here so
 * the parser stays out of the editor bundle: add it with `extensions`.
 * Input outside the Markdown limits is left to normal paste handling.
 */
export const MarkdownPaste = Extension.create({
  name: 'markdownPaste',

  addProseMirrorPlugins() {
    const { editor } = this;
    return [
      new Plugin({
        key: new PluginKey('markdownPaste'),
        props: {
          handleDOMEvents: {
            paste(view) {
              // A native paste may beat selectionchange after a click. Flush
              // ProseMirror's own observer before it parses the clipboard
              // against the previous block (and before any handlePaste hook).
              if (!view.composing) {
                (view as typeof view & { domObserver: { flush(): void } }).domObserver.flush();
              }
              return false;
            },
          },
          handlePaste: (view, event) => {
            const clipboard = event.clipboardData;
            const text = clipboard?.getData('text/plain');
            if (!text || text.length > MAX_MARKDOWN_CHARS || clipboard?.getData('text/html') || !MARKDOWN_PASTE_RE.test(text)) {
              return false;
            }
            // Paste-as-plain-text and code blocks keep every character. The
            // shift state is only on ProseMirror's private input record.
            const { input } = view as unknown as { input?: { shiftKey?: boolean } };
            if (input?.shiftKey || view.state.selection.$from.parent.type.spec.code) {
              return false;
            }
            let content: JSONContent[];
            try {
              content = readMarkdown(text, editor.schema).content ?? [];
            } catch {
              // Declining lets ProseMirror use the original clipboard slice.
              return false;
            }
            // One paragraph is a span: inserted as a block it would split the
            // paragraph the caret is in.
            const [first] = content;
            if (content.length === 1 && first.type === 'paragraph') {
              return first.content?.length ? editor.commands.insertContent(first.content) : false;
            }
            return editor.commands.insertContent(content);
          },
        },
      }),
    ];
  },
}) as Extension & { name: 'markdownPaste' };
