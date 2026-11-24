import type { Extensions } from '@tiptap/core';
import { Document } from '@tiptap/extension-document';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';
import { HardBreak } from '@tiptap/extension-hard-break';
import { Bold } from '@tiptap/extension-bold';
import { Italic } from '@tiptap/extension-italic';
import { Underline } from '@tiptap/extension-underline';
import { Strike } from '@tiptap/extension-strike';
import { Code } from '@tiptap/extension-code';
import { Highlight } from '@tiptap/extension-highlight';
import { Link } from '@tiptap/extension-link';
import { Color } from '@tiptap/extension-color';
import { Heading } from '@tiptap/extension-heading';
import { BulletList } from '@tiptap/extension-bullet-list';
import { OrderedList } from '@tiptap/extension-ordered-list';
import { ListItem } from '@tiptap/extension-list-item';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { HorizontalRule } from '@tiptap/extension-horizontal-rule';
import { Blockquote } from '@tiptap/extension-blockquote';
import { CodeBlock } from '@tiptap/extension-code-block';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { TextAlign } from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details';
import { TableRow } from '@tiptap/extension-table-row';
import { isSafeUrl } from '../utils/url-safety';
import { BoundedTableSchema, BoundedTableCell, BoundedTableHeader } from './bounded-table-schema';
import { CalloutSchema } from './callout-schema';
import { ImageBlockSchema } from './image-block-schema';
import { TocBlockSchema } from './TocBlock/toc-block-schema';
import type { ImageBlock } from './ImageBlock';
import type { CoreExtensionOptions } from './get-extensions';

// An editor supplies interactive variants and plugins in their original order.
// The static caller sees only the shared schema and never imports these variants.
type EditorExtensions = {
  beforeMarks: Extensions;
  listKeymap?: Extensions[number];
  taskItem: (item: typeof TaskItem) => Extensions[number];
  codeBlock: typeof CodeBlock;
  afterCode: Extensions;
  imageBlock: typeof ImageBlock;
  afterImage?: Extensions[number];
  callout: Extensions[number];
  beforeDetails?: Extensions[number];
  detailsShortcut?: Extensions[number];
  table: typeof BoundedTableSchema;
  tocBlock: typeof TocBlockSchema;
};

// A closed toggle hides what comes next: Enter in its summary would leave it.
// So one just inserted is open; a document says what its own toggles are.
const OpenOnInsertDetails = Details.extend({
  addAttributes() {
    const parent = (this.parent?.() ?? {}) as Record<string, object>;
    return { ...parent, open: { ...parent.open, default: true } };
  },
});

export function getSchemaExtensions(options: CoreExtensionOptions = {}, editor?: EditorExtensions): Extensions {
  const {
    heading,
    bold,
    italic,
    underline,
    strike,
    code,
    highlight,
    textColor,
    subscript,
    superscript,
    link,
    textAlign,
    blockquote,
    bulletList,
    orderedList,
    taskList,
    horizontalRule,
    codeBlock,
    imageBlock,
    callout,
    toggleList,
    table,
    tocBlock,
  } = options;

  const extensions: Extensions = [Document, Paragraph, Text, HardBreak];
  if (editor) extensions.push(...editor.beforeMarks);

  // Optional marks
  if (bold !== false) extensions.push(Bold);
  if (italic !== false) extensions.push(Italic);
  if (underline !== false) extensions.push(Underline);
  if (strike !== false) extensions.push(Strike);
  if (code !== false) extensions.push(Code);
  if (textColor !== false) extensions.push(TextStyle, Color);
  if (highlight !== false) extensions.push(Highlight.configure({ multicolor: true }));
  if (subscript !== false) extensions.push(Subscript);
  if (superscript !== false) extensions.push(Superscript);

  if (link !== false) {
    const linkOpts = typeof link === 'object' ? link : {};
    extensions.push(Link.configure({
      openOnClick: linkOpts.openOnClick ?? false,
      autolink: linkOpts.autolink ?? true,
      defaultProtocol: linkOpts.defaultProtocol ?? 'https',
      // Block unsafe URLs at parse/typing time, including obfuscated protocols.
      validate: (href: string) => isSafeUrl(href),
    }));
  }

  // Optional block nodes
  if (heading !== false) {
    extensions.push(Heading.configure({
      levels: (heading?.levels ?? [1, 2, 3, 4, 5, 6]) as [1, 2, 3, 4, 5, 6],
    }));
  }
  if (textAlign !== false) {
    extensions.push(TextAlign.configure({
      types: textAlign?.types ?? ['heading', 'paragraph'],
      alignments: ['left', 'center', 'right'],
    }));
  }
  if (bulletList !== false || orderedList !== false) extensions.push(ListItem);
  if (editor?.listKeymap && (bulletList !== false || orderedList !== false || taskList !== false)) {
    // Backspace joins the item to the one above, not a second paragraph.
    extensions.push(editor.listKeymap);
  }
  if (bulletList !== false) extensions.push(BulletList);
  if (orderedList !== false) extensions.push(OrderedList);
  if (taskList !== false) {
    const item = TaskItem.configure({ nested: true });
    extensions.push(TaskList, editor?.taskItem(item) ?? item);
  }
  if (blockquote !== false) extensions.push(Blockquote);
  if (horizontalRule !== false) extensions.push(HorizontalRule);
  if (codeBlock !== false) {
    extensions.push((editor?.codeBlock ?? CodeBlock).configure({ enableTabIndentation: true, tabSize: 2 }));
  }
  if (editor) extensions.push(...editor.afterCode);
  if (imageBlock !== false) {
    const imageBlockOpts = typeof imageBlock === 'object' ? imageBlock : {};
    extensions.push(editor?.imageBlock.configure(imageBlockOpts) ?? ImageBlockSchema);
  }
  if (editor?.afterImage) extensions.push(editor.afterImage);
  if (callout !== false) extensions.push(editor?.callout ?? CalloutSchema);
  if (editor?.beforeDetails) extensions.push(editor.beforeDetails);

  if (toggleList !== false) {
    extensions.push(
      OpenOnInsertDetails.configure({ persist: true, HTMLAttributes: {} }),
      DetailsSummary,
      DetailsContent,
    );
    if (editor?.detailsShortcut) extensions.push(editor.detailsShortcut);
  }
  if (table !== false) {
    extensions.push(
      (editor?.table ?? BoundedTableSchema).configure({
        HTMLAttributes: {},
        resizable: false,
        allowTableNodeSelection: false,
        // Wide tables scroll horizontally before squeezing cells.
        cellMinWidth: 96,
        renderWrapper: true,
      }),
      TableRow,
      BoundedTableHeader,
      BoundedTableCell,
    );
  }
  if (tocBlock !== false) {
    const toc = editor?.tocBlock ?? TocBlockSchema;
    extensions.push(tocBlock ? toc.configure({ maxLevel: tocBlock.maxLevel ?? 3 }) : toc);
  }

  return extensions;
}
