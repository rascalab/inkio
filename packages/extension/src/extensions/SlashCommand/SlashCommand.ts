import { Extension, type Editor, type Range } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import type { ReactNode } from 'react';
import { createSuggestionRenderer, toError, type InkioErrorHandler } from '@inkio/editor';
import { runOptionalChainCommand, runOptionalEditorCommand } from '../optionalCommands';

export interface SlashCommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  command: (props: { editor: Editor; range: Range }) => void | Promise<void>;
  [key: string]: unknown;
}

export interface SlashCommandOptions {
  /** Suggestion options override */
  suggestion?: Partial<Parameters<typeof Suggestion>[0]>;
  /** Function to fetch command items */
  items?: (props: { query: string; editor: Editor }) => SlashCommandItem[] | Promise<SlashCommandItem[]>;
  /** Generic extension-level error callback */
  onError?: InkioErrorHandler;
}

export const SlashCommandPluginKey = new PluginKey('slashCommand');

// Default slash commands
export const defaultSlashCommands: SlashCommandItem[] = [
  {
    id: 'heading1',
    label: 'Heading 1',
    description: 'Large section heading',
    command: ({ editor, range }) => {
      runOptionalChainCommand(editor, 'setHeading', {
        args: { level: 1 },
        prepare: (chain) => chain.deleteRange(range),
      });
    },
  },
  {
    id: 'heading2',
    label: 'Heading 2',
    description: 'Medium section heading',
    command: ({ editor, range }) => {
      runOptionalChainCommand(editor, 'setHeading', {
        args: { level: 2 },
        prepare: (chain) => chain.deleteRange(range),
      });
    },
  },
  {
    id: 'heading3',
    label: 'Heading 3',
    description: 'Small section heading',
    command: ({ editor, range }) => {
      runOptionalChainCommand(editor, 'setHeading', {
        args: { level: 3 },
        prepare: (chain) => chain.deleteRange(range),
      });
    },
  },
  {
    id: 'bulletList',
    label: 'Bullet List',
    description: 'Create a simple list',
    command: ({ editor, range }) => {
      runOptionalChainCommand(editor, 'toggleBulletList', {
        prepare: (chain) => chain.deleteRange(range),
      });
    },
  },
  {
    id: 'numberedList',
    label: 'Numbered List',
    description: 'Create a numbered list',
    command: ({ editor, range }) => {
      runOptionalChainCommand(editor, 'toggleOrderedList', {
        prepare: (chain) => chain.deleteRange(range),
      });
    },
  },
  {
    id: 'taskList',
    label: 'Task List',
    description: 'Create a to-do list',
    command: ({ editor, range }) => {
      runOptionalChainCommand(editor, 'toggleTaskList', {
        prepare: (chain) => chain.deleteRange(range),
      });
    },
  },
  {
    id: 'codeBlock',
    label: 'Code Block',
    description: 'Add a code snippet',
    command: ({ editor, range }) => {
      runOptionalChainCommand(editor, 'toggleCodeBlock', {
        prepare: (chain) => chain.deleteRange(range),
      });
    },
  },
  {
    id: 'horizontalRule',
    label: 'Divider',
    description: 'Add a horizontal rule',
    command: ({ editor, range }) => {
      runOptionalChainCommand(editor, 'setHorizontalRule', {
        prepare: (chain) => chain.deleteRange(range),
      });
    },
  },
  {
    id: 'callout',
    label: 'Callout',
    description: 'Add a callout block',
    command: ({ editor, range }) => {
      runOptionalChainCommand(editor, 'setCallout', {
        prepare: (chain) => chain.deleteRange(range),
      });
    },
  },
  {
    id: 'toggleList',
    label: 'Toggle List',
    description: 'Add a collapsible section',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent({
        type: 'details',
        content: [
          { type: 'detailsSummary' },
          { type: 'detailsContent', content: [{ type: 'paragraph' }] },
        ],
      }).run();
    },
  },
  {
    id: 'image',
    label: 'Image',
    description: 'Upload an image',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (files && files.length > 0) {
          const fileArray = Array.from(files);
          requestAnimationFrame(() => {
            if (!editor.isDestroyed) {
              runOptionalEditorCommand(editor, 'uploadImageBlock', fileArray);
            }
          });
        }
      };
      input.click();
    },
  },
];

export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {},
      items: ({ query }) => {
        return defaultSlashCommands.filter((item) =>
          item.label.toLowerCase().includes(query.toLowerCase())
        );
      },
      onError: undefined,
    };
  },

  addProseMirrorPlugins() {
    const { items, onError } = this.options;

    return [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Extension.create erases items' return type to unknown[]; Suggestion expects SlashCommandItem[]
      Suggestion<SlashCommandItem, SlashCommandItem>({
        editor: this.editor,
        char: '/',
        pluginKey: SlashCommandPluginKey,
        items: items as any,
        command: ({ editor, range, props }) => {
          try {
            if (!props || typeof props.command !== 'function') {
              throw new Error('Slash command item is missing a valid command handler.');
            }

            const maybePromise = props.command({ editor, range });
            if (
              maybePromise
              && typeof maybePromise === 'object'
              && typeof (maybePromise as Promise<unknown>).then === 'function'
            ) {
              (maybePromise as Promise<unknown>).catch((error) => {
                onError?.(toError(error), { source: 'slashCommand.command', recoverable: true });
              });
            }
          } catch (error) {
            onError?.(toError(error), { source: 'slashCommand.command', recoverable: true });
          }
        },
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          const isRootDepth = $from.depth === 1;
          const isParagraph = $from.parent.type.name === 'paragraph';
          const isStartOfNode = $from.parent.textContent?.charAt(0) === '/';

          // Check if we're in a callout or toggle list (depth > 1)
          let isInCalloutOrToggle = false;
          for (let d = $from.depth; d > 0; d--) {
            const nodeName = $from.node(d).type.name;
            if (nodeName === 'callout' || nodeName === 'detailsContent') {
              isInCalloutOrToggle = true;
              break;
            }
          }

          // Allow slash command in paragraph at root, in callout, or in toggle list
          return isParagraph && (isRootDepth || isInCalloutOrToggle) && isStartOfNode;
        },
        render: createSuggestionRenderer<SlashCommandItem>({ header: 'Commands' }),
        ...this.options.suggestion,
      }),
    ];
  },
});
