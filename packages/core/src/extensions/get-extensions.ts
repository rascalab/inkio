import { Extension, Extensions } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { TaskItemView } from '../components/TaskItemView';
import type { InkioIconComponent } from '../icons';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import History from '@tiptap/extension-history';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import Underline from '@tiptap/extension-underline';
import Strike from '@tiptap/extension-strike';
import Code from '@tiptap/extension-code';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Color from '@tiptap/extension-color';
import Heading from '@tiptap/extension-heading';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import HardBreak from '@tiptap/extension-hard-break';
import Blockquote from '@tiptap/extension-blockquote';
import { CodeBlock } from './CodeBlock';
import Dropcursor from '@tiptap/extension-dropcursor';
import Gapcursor from '@tiptap/extension-gapcursor';
import Placeholder from '@tiptap/extension-placeholder';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { ClearMarksOnEnter } from './ClearMarksOnEnter';
import { ListMerge } from './ListMerge';
import { ImageBlock } from './ImageBlock';
import type { ImageBlockOptions } from './ImageBlock';
import { LinkClickHandler } from './LinkClickHandler';
import type { LinkClickHandlerOptions } from './LinkClickHandler';
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import { Callout } from './Callout';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { DetailsShortcut } from './DetailsShortcut';

export interface CoreExtensionOptions {
  /** Placeholder text shown when the editor is empty */
  placeholder?: string;
  /** Set to `false` to disable heading, or pass `{ levels }` to customize */
  heading?: false | { levels: number[] };
  /** Set to `false` to disable bold */
  bold?: false;
  /** Set to `false` to disable italic */
  italic?: false;
  /** Set to `false` to disable underline */
  underline?: false;
  /** Set to `false` to disable strikethrough */
  strike?: false;
  /** Set to `false` to disable inline code */
  code?: false;
  /** Set to `false` to disable highlight */
  highlight?: false;
  /** Set to `false` to disable text color */
  textColor?: false;
  /** Set to `false` to disable subscript */
  subscript?: false;
  /** Set to `false` to disable superscript */
  superscript?: false;
  /** Set to `false` to disable link, or pass options to customize */
  link?: false | { openOnClick?: boolean; autolink?: boolean; defaultProtocol?: string };
  /** Set to `false` to disable text alignment, or pass node types to customize. */
  textAlign?: false | { types?: ('heading' | 'paragraph')[] };
  /** Set to `false` to disable bullet list */
  bulletList?: false;
  /** Set to `false` to disable ordered list */
  orderedList?: false;
  /** Set to `false` to disable task list */
  taskList?: false;
  /** Set to `false` to disable blockquote */
  blockquote?: false;
  /** Set to `false` to disable horizontal rule */
  horizontalRule?: false;
  /** Set to `false` to disable code block */
  codeBlock?: false;
  /** Set to `false` to disable history (undo/redo) */
  history?: false;
  /** Set to `false` to disable clear marks on enter */
  clearMarksOnEnter?: false;
  /** Set to `false` to disable image block, or pass options to customize */
  imageBlock?: false | Omit<Partial<ImageBlockOptions>, 'HTMLAttributes'>;
  /** Set to `false` to disable Cmd/Ctrl+Click link handler, or pass options to customize.
   *  Requires the `link` extension to be enabled (default). Ignored when `link` is `false`. */
  linkClickHandler?: false | LinkClickHandlerOptions;
  /**
   * Tab key behavior inside the editor.
   * - `'indent'` (default): Tab sinks list items / Shift+Tab lifts them. Prevents browser focus navigation.
   * - `'default'`: Tab follows normal browser behavior (focus next element).
   */
  tabBehavior?: 'indent' | 'default';
  /** Custom icon component for the task list checkbox (checked state). Defaults to Lucide Check. */
  taskCheckIcon?: InkioIconComponent;
  /** Set to `false` to disable the callout block extension */
  callout?: false;
  /** Set to `false` to disable the toggle list (details/summary) extension */
  toggleList?: false;
  /** Set to `false` to disable the table extension */
  table?: false;
  /** Set to `false` to disable keyboard shortcuts extension */
  keyboardShortcuts?: false;
}

export const getExtensions = (options: CoreExtensionOptions = {}) => {
  const {
    placeholder,
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
    history,
    clearMarksOnEnter,
    imageBlock,
    linkClickHandler,
    callout,
    toggleList,
    table,
    keyboardShortcuts,
  } = options;

  const extensions: Extensions = [
    // Required base nodes
    Document,
    Paragraph,
    Text,
    HardBreak,
    Dropcursor,
    Gapcursor,
    Placeholder.configure({
      placeholder: placeholder || 'Start typing...',
    }),
  ];

  // Optional marks
  if (bold !== false) extensions.push(Bold);
  if (italic !== false) extensions.push(Italic);
  if (underline !== false) extensions.push(Underline);
  if (strike !== false) extensions.push(Strike);
  if (code !== false) extensions.push(Code);

  if (textColor !== false) {
    extensions.push(TextStyle);
    extensions.push(Color);
  }

  if (highlight !== false) {
    extensions.push(Highlight.configure({ multicolor: true }));
  }

  if (subscript !== false) {
    extensions.push(Subscript);
  }

  if (superscript !== false) {
    extensions.push(Superscript);
  }

  if (link !== false) {
    const linkOpts = typeof link === 'object' ? link : {};
    extensions.push(
      Link.configure({
        openOnClick: linkOpts.openOnClick ?? false,
        autolink: linkOpts.autolink ?? true,
        defaultProtocol: linkOpts.defaultProtocol ?? 'https',
      })
    );
  }

  // Optional block nodes
  if (heading !== false) {
    extensions.push(
      Heading.configure({
        levels: (heading && typeof heading === 'object' ? heading.levels : [1, 2, 3, 4, 5, 6]) as [1, 2, 3, 4, 5, 6],
      })
    );
  }

  if (textAlign !== false) {
    extensions.push(
      TextAlign.configure({
        types: textAlign?.types ?? ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right'],
      }),
    );
  }

  if (bulletList !== false || orderedList !== false) {
    extensions.push(ListItem);
  }
  if (bulletList !== false) {
    extensions.push(BulletList);
  }
  if (orderedList !== false) extensions.push(OrderedList);

  if (taskList !== false) {
    extensions.push(TaskList);
    extensions.push(
      TaskItem.configure({ nested: true }).extend({
        addOptions() {
          return {
            ...this.parent?.(),
            checkIcon: options.taskCheckIcon,
          };
        },
        addNodeView() {
          return ReactNodeViewRenderer(TaskItemView);
        },
      }),
    );
  }

  if (blockquote !== false) extensions.push(Blockquote);
  if (horizontalRule !== false) extensions.push(HorizontalRule);
  if (codeBlock !== false) extensions.push(CodeBlock);
  if (history !== false) extensions.push(History);
  if (clearMarksOnEnter !== false) extensions.push(ClearMarksOnEnter);
  if (bulletList !== false || orderedList !== false || taskList !== false) {
    extensions.push(ListMerge);
  }

  if (imageBlock !== false) {
    const imageBlockOpts = typeof imageBlock === 'object' ? imageBlock : {};
    extensions.push(ImageBlock.configure(imageBlockOpts));
  }

  if (link !== false && linkClickHandler !== false) {
    const linkClickOpts = typeof linkClickHandler === 'object' ? linkClickHandler : {};
    extensions.push(LinkClickHandler.configure(linkClickOpts));
  }

  if (callout !== false) {
    extensions.push(Callout);
  }

  if (keyboardShortcuts !== false) {
    extensions.push(KeyboardShortcuts);
  }

  if (toggleList !== false) {
    extensions.push(
      Details.configure({ persist: true, HTMLAttributes: {} }),
      DetailsSummary,
      DetailsContent,
      DetailsShortcut,
    );
  }

  if (table !== false) {
    extensions.push(
      Table.configure({ HTMLAttributes: {}, resizable: false, allowTableNodeSelection: false }),
      TableRow,
      TableHeader,
      TableCell,
    );
  }

  if (options.tabBehavior !== 'default') {
    extensions.push(
      Extension.create({
        name: 'tabIndent',
        addKeyboardShortcuts() {
          return {
            Tab: ({ editor }) => {
              if (editor.can().sinkListItem('listItem')) return editor.commands.sinkListItem('listItem');
              if (editor.can().sinkListItem('taskItem')) return editor.commands.sinkListItem('taskItem');
              // Prevent Tab from leaving the editor
              return true;
            },
            'Shift-Tab': ({ editor }) => {
              if (editor.can().liftListItem('listItem')) return editor.commands.liftListItem('listItem');
              if (editor.can().liftListItem('taskItem')) return editor.commands.liftListItem('taskItem');
              return true;
            },
          };
        },
      }),
    );
  }

  return extensions;
};
