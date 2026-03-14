import type { Extensions, JSONContent } from '@tiptap/core';
import { unified } from 'unified';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';

export interface MarkdownAdapterOptions {
  extensions?: Extensions;
}

type JsonMark = NonNullable<JSONContent['marks']>[number];
type MdastNode = {
  type: string;
  value?: string;
  depth?: number;
  ordered?: boolean;
  checked?: boolean | null;
  start?: number | null;
  lang?: string | null;
  url?: string;
  title?: string | null;
  alt?: string | null;
  name?: string;
  attributes?: Record<string, string | null | undefined>;
  children?: MdastNode[];
};

const markdownParser = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkDirective);

const markdownStringifier = unified()
  .use(remarkStringify, {
    bullet: '-',
    fences: true,
    emphasis: '*',
    listItemIndent: 'one',
    resourceLink: true,
    strong: '*',
  })
  .use(remarkGfm)
  .use(remarkDirective);

const DETAILS_BLOCK_RE = /<details>\s*<summary>([\s\S]*?)<\/summary>\s*([\s\S]*?)<\/details>/gi;
const DETAILS_DIRECTIVE_RE = /:::details(?:\{([^}]*)\})?\n([\s\S]*?)\n:::/g;
const DIRECTIVE_ATTR_RE = /(\w+)="((?:\\.|[^"])*)"/g;

function escapeDirectiveValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function decodeDirectiveValue(value: string): string {
  return value.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

function parseDirectiveAttributes(raw?: string): Record<string, string> {
  if (!raw) {
    return {};
  }

  const attrs: Record<string, string> = {};
  for (const match of raw.matchAll(DIRECTIVE_ATTR_RE)) {
    attrs[match[1]] = decodeDirectiveValue(match[2]);
  }
  return attrs;
}

function preprocessMarkdown(markdown: string): string {
  return markdown.replace(DETAILS_BLOCK_RE, (_match, rawSummary, rawBody) => {
    const summary = rawSummary.replace(/<[^>]*>/g, '').trim();
    const body = rawBody.trim();
    const summaryAttr = `summary="${escapeDirectiveValue(summary)}"`;
    return body.length > 0
      ? `:::details{${summaryAttr}}\n${body}\n:::`
      : `:::details{${summaryAttr}}\n\n:::`;
  });
}

function postprocessMarkdown(markdown: string): string {
  return markdown.replace(DETAILS_DIRECTIVE_RE, (_match, rawAttrs, rawBody) => {
    const attrs = parseDirectiveAttributes(rawAttrs);
    const summary = attrs.summary ?? '';
    const body = rawBody.trim();

    if (body.length === 0) {
      return `<details>\n<summary>${escapeHtml(summary)}</summary>\n\n</details>`;
    }

    return `<details>\n<summary>${escapeHtml(summary)}</summary>\n\n${body}\n</details>`;
  });
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

function ensureParagraphContent(content: JSONContent[]): JSONContent[] | undefined {
  return content.length > 0 ? content : undefined;
}

function ensureBlockContent(content: JSONContent[]): JSONContent[] {
  return content.length > 0 ? content : [{ type: 'paragraph' }];
}

function toLinkMark(node: MdastNode): JsonMark {
  return {
    type: 'link',
    attrs: {
      href: node.url ?? '',
    },
  };
}

function withMark(marks: JsonMark[], mark: JsonMark): JsonMark[] {
  return [...marks, mark];
}

function mdastInlineToJson(nodes: MdastNode[] = [], marks: JsonMark[] = []): JSONContent[] {
  const content: JSONContent[] = [];

  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        pushInlineNode(content, createTextNode(node.value ?? '', marks));
        break;
      case 'break':
        content.push({ type: 'hardBreak' });
        break;
      case 'inlineCode':
        pushInlineNode(content, createTextNode(node.value ?? '', withMark(marks, { type: 'code' })));
        break;
      case 'strong':
        mdastInlineToJson(node.children, withMark(marks, { type: 'bold' })).forEach((child) =>
          pushInlineNode(content, child),
        );
        break;
      case 'emphasis':
        mdastInlineToJson(node.children, withMark(marks, { type: 'italic' })).forEach((child) =>
          pushInlineNode(content, child),
        );
        break;
      case 'delete':
        mdastInlineToJson(node.children, withMark(marks, { type: 'strike' })).forEach((child) =>
          pushInlineNode(content, child),
        );
        break;
      case 'link':
        mdastInlineToJson(node.children, withMark(marks, toLinkMark(node))).forEach((child) =>
          pushInlineNode(content, child),
        );
        break;
      case 'image':
        pushInlineNode(content, createTextNode(node.alt ?? node.url ?? '', marks));
        break;
      case 'html':
        pushInlineNode(content, createTextNode(node.value ?? '', marks));
        break;
      default:
        if (node.children) {
          mdastInlineToJson(node.children, marks).forEach((child) => pushInlineNode(content, child));
        } else if (node.value) {
          pushInlineNode(content, createTextNode(node.value, marks));
        }
        break;
    }
  }

  return content;
}

function paragraphFromInline(nodes: MdastNode[] = []): JSONContent {
  const content = mdastInlineToJson(nodes);
  return content.length > 0
    ? { type: 'paragraph', content }
    : { type: 'paragraph' };
}

function isStandaloneImage(node: MdastNode): boolean {
  return node.type === 'paragraph'
    && Array.isArray(node.children)
    && node.children.length === 1
    && node.children[0].type === 'image';
}

function imageNodeToJson(node: MdastNode): JSONContent {
  return {
    type: 'imageBlock',
    attrs: {
      src: node.url ?? '',
      alt: node.alt ?? null,
      title: node.title ?? null,
    },
  };
}

function listItemToJson(node: MdastNode, task: boolean): JSONContent {
  const content = ensureBlockContent(mdastBlocksToJson(node.children ?? []));
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

function tableCellToJson(node: MdastNode, type: 'tableHeader' | 'tableCell'): JSONContent {
  const inline = mdastInlineToJson(node.children ?? []);
  return {
    type,
    content: [
      inline.length > 0 ? { type: 'paragraph', content: inline } : { type: 'paragraph' },
    ],
  };
}

function directiveToJson(node: MdastNode): JSONContent[] {
  if (node.name === 'callout') {
    return [{
      type: 'callout',
      attrs: {
        icon: node.attributes?.icon ?? null,
        color: node.attributes?.color ?? null,
      },
      content: ensureBlockContent(mdastBlocksToJson(node.children ?? [])),
    }];
  }

  if (node.name === 'details') {
    const summary = node.attributes?.summary ?? '';
    const bodyContent = ensureBlockContent(mdastBlocksToJson(node.children ?? []));
    const summaryContent = mdastInlineToJson([{ type: 'text', value: summary }]);

    return [{
      type: 'details',
      content: [
        summaryContent.length > 0
          ? { type: 'detailsSummary', content: summaryContent }
          : { type: 'detailsSummary' },
        {
          type: 'detailsContent',
          content: bodyContent,
        },
      ],
    }];
  }

  const attrs = Object.entries(node.attributes ?? {})
    .map(([key, value]) => value ? `${key}="${value}"` : key)
    .join(' ');
  const open = attrs ? `:::${node.name}{${attrs}}` : `:::${node.name}`;
  const body = (node.children ?? []).map((child) => child.value ?? '').join('\n').trim();
  return [{
    type: 'paragraph',
    content: [{ type: 'text', text: body ? `${open}\n${body}\n:::` : `${open}\n:::` }],
  }];
}

function mdastBlocksToJson(nodes: MdastNode[] = []): JSONContent[] {
  const content: JSONContent[] = [];

  for (const node of nodes) {
    switch (node.type) {
      case 'heading':
        content.push({
          type: 'heading',
          attrs: { level: Math.min(Math.max(node.depth ?? 1, 1), 6) },
          content: ensureParagraphContent(mdastInlineToJson(node.children ?? [])),
        });
        break;
      case 'paragraph':
        if (isStandaloneImage(node)) {
          content.push(imageNodeToJson(node.children![0]));
          break;
        }

        content.push(paragraphFromInline(node.children));
        break;
      case 'blockquote':
        content.push({
          type: 'blockquote',
          content: ensureBlockContent(mdastBlocksToJson(node.children ?? [])),
        });
        break;
      case 'list': {
        for (const group of splitListChildren(node)) {
          content.push({
            type: group.task ? 'taskList' : (node.ordered ? 'orderedList' : 'bulletList'),
            ...(group.task || !node.ordered ? {} : { attrs: { start: node.start && node.start > 1 ? node.start : null } }),
            content: group.children.map((child) => listItemToJson(child, group.task)),
          });
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
      case 'table':
        content.push({
          type: 'table',
          content: (node.children ?? []).map((row, rowIndex) => ({
            type: 'tableRow',
            content: (row.children ?? []).map((cell) =>
              tableCellToJson(cell, rowIndex === 0 ? 'tableHeader' : 'tableCell'),
            ),
          })),
        });
        break;
      case 'containerDirective':
        directiveToJson(node).forEach((child) => content.push(child));
        break;
      case 'html':
        content.push({
          type: 'paragraph',
          content: node.value ? [{ type: 'text', text: node.value }] : undefined,
        });
        break;
      case 'image':
        content.push(imageNodeToJson(node));
        break;
      default:
        if (node.children) {
          mdastBlocksToJson(node.children).forEach((child) => content.push(child));
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

  return (node.content ?? []).map((child) => textFromJson(child)).join('');
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
    current = {
      type: 'link',
      url: String(linkMark.attrs?.href ?? ''),
      children: [current],
    };
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

        content.push(jsonMarksToMdast({ type: 'text', value: text }, node.marks ?? []));
        break;
      }
      case 'hardBreak':
        content.push({ type: 'break' });
        break;
      case 'mention':
        content.push({ type: 'text', value: `@${node.attrs?.label ?? node.attrs?.id ?? ''}` });
        break;
      case 'hashTag':
        content.push({ type: 'text', value: `#${node.attrs?.label ?? node.attrs?.id ?? ''}` });
        break;
      case 'wikiLink':
        content.push({ type: 'text', value: String(node.attrs?.label ?? node.attrs?.href ?? '') });
        break;
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
  return {
    type: 'paragraph',
    children: jsonInlineToMdast(node.content ?? []),
  };
}

function jsonListItemToMdast(node: JSONContent, task: boolean): MdastNode {
  return {
    type: 'listItem',
    ...(task ? { checked: Boolean(node.attrs?.checked) } : {}),
    children: jsonBlocksToMdast(node.content ?? []),
  };
}

function jsonTableCellToMdast(node: JSONContent): MdastNode {
  const block = node.content?.[0];
  const inline = block?.type === 'paragraph'
    ? jsonInlineToMdast(block.content ?? [])
    : [{ type: 'text', value: textFromJson(block) }];

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
    type: 'containerDirective',
    name: 'details',
    attributes: {
      summary: textFromJson(summaryNode).trim(),
    },
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
          ordered: false,
          children: (node.content ?? []).map((child) => jsonListItemToMdast(child, false)),
        });
        break;
      case 'orderedList':
        content.push({
          type: 'list',
          ordered: true,
          start: typeof node.attrs?.start === 'number' ? node.attrs.start : 1,
          children: (node.content ?? []).map((child) => jsonListItemToMdast(child, false)),
        });
        break;
      case 'taskList':
        content.push({
          type: 'list',
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
        content.push({
          type: 'image',
          url: String(node.attrs?.src ?? ''),
          alt: typeof node.attrs?.alt === 'string' ? node.attrs.alt : null,
          title: typeof node.attrs?.title === 'string' ? node.attrs.title : null,
        });
        break;
      case 'table': {
        const rows = (node.content ?? []).map((row) => ({
          type: 'tableRow',
          children: (row.content ?? []).map((cell) => jsonTableCellToMdast(cell)),
        }));
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
      case 'bookmark':
        if (typeof node.attrs?.url === 'string' && node.attrs.url.length > 0) {
          content.push({
            type: 'paragraph',
            children: [{
              type: 'link',
              url: node.attrs.url,
              children: [{
                type: 'text',
                value: String(node.attrs?.title ?? node.attrs.url),
              }],
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
      case 'comment':
        break;
      default:
        if (node.content) {
          jsonBlocksToMdast(node.content).forEach((child) => content.push(child));
        } else if (node.text) {
          content.push({
            type: 'paragraph',
            children: [{ type: 'text', value: node.text }],
          });
        }
        break;
    }
  }

  return content;
}

function toMdastRoot(content: JSONContent): MdastNode {
  const docContent = content.type === 'doc' ? (content.content ?? []) : [content];
  return {
    type: 'root',
    children: jsonBlocksToMdast(docContent),
  };
}

function parseToMdast(markdown: string): MdastNode {
  return markdownParser.parse(preprocessMarkdown(markdown)) as MdastNode;
}

function stringifyFromMdast(root: MdastNode): string {
  return postprocessMarkdown(String(markdownStringifier.stringify(root as any)).trim());
}

export function createMarkdownAdapter(options: MarkdownAdapterOptions = {}) {
  void options.extensions;

  return {
    parse(markdown: string): JSONContent {
      const root = parseToMdast(markdown);
      const content = ensureBlockContent(mdastBlocksToJson(root.children ?? []));
      return {
        type: 'doc',
        content,
      };
    },
    stringify(content: JSONContent): string {
      return stringifyFromMdast(toMdastRoot(content));
    },
  };
}

export function parseMarkdown(markdown: string): JSONContent {
  return createMarkdownAdapter().parse(markdown);
}

export function stringifyMarkdown(content: JSONContent): string {
  return createMarkdownAdapter().stringify(content);
}
