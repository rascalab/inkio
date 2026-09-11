import { Extension, type Editor, type Range } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import type { ReactNode } from 'react';
import { createSuggestionRenderer, toError, type InkioErrorHandler } from '@inkio/core';
import { runOptionalChainCommand } from './optional-commands';

export interface SlashCommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  command: (props: { editor: Editor; range: Range }) => void | Promise<void>;
  isAvailable?: (editor: Editor) => boolean;
  [key: string]: unknown;
}

export interface SlashCommandContext {
  query: string;
  editor: Editor;
}

export type SlashCommandTransform = (
  defaults: SlashCommandItem[],
  context: SlashCommandContext,
) => SlashCommandItem[] | Promise<SlashCommandItem[]>;

export interface SlashCommandOptions {
  /** Suggestion options override */
  suggestion?: Partial<Parameters<typeof Suggestion>[0]>;
  /** Function to fetch command items */
  items?: (props: { query: string; editor: Editor }) => SlashCommandItem[] | Promise<SlashCommandItem[]>;
  /** Transform the default items before they are filtered by query. */
  transformItems?: SlashCommandTransform;
  /** Generic extension-level error callback */
  onError?: InkioErrorHandler;
}

export const SlashCommandPluginKey = new PluginKey('slashCommand');

function hasSchemaNode(editor: Editor, name: string): boolean {
  return name in editor.state.schema.nodes;
}

/**
 * Cap on suggestion rows. The popup renders every returned item, so an
 * unbounded custom items() list costs layout per keystroke; the filter stops
 * collecting once the cap is reached instead of scanning the rest.
 */
export const SLASH_COMMAND_MAX_ITEMS = 50;

export function filterSlashCommandItems(
  items: SlashCommandItem[],
  query: string,
  editor: Editor,
  limit: number = SLASH_COMMAND_MAX_ITEMS,
) {
  if (limit <= 0) return [];
  const normalizedQuery = query.toLowerCase();
  const result: SlashCommandItem[] = [];
  for (const item of items) {
    if (result.length >= limit) break;
    if (item.isAvailable && !item.isAvailable(editor)) {
      continue;
    }
    if (normalizedQuery && !item.label.toLowerCase().includes(normalizedQuery)) {
      continue;
    }
    result.push(item);
  }
  return result;
}

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
    id: 'table',
    label: 'Table',
    description: 'Insert a table',
    command: ({ editor, range }) => {
      runOptionalChainCommand(editor, 'insertTable', {
        args: { rows: 3, cols: 3, withHeaderRow: true },
        prepare: (chain) => chain.deleteRange(range),
      });
    },
    isAvailable: (editor) => hasSchemaNode(editor, 'table'),
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
      runOptionalChainCommand(editor, 'setDetails', {
        prepare: (chain) => chain.deleteRange(range),
      });
    },
    isAvailable: (editor) => hasSchemaNode(editor, 'details'),
  },
  {
    id: 'toc',
    label: 'Table of Contents',
    description: 'Insert a table of contents',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent({ type: 'tocBlock' }).run();
    },
    isAvailable: (editor) => hasSchemaNode(editor, 'tocBlock'),
  },
  {
    id: 'image',
    label: 'Image',
    description: 'Upload an image',
    command: ({ editor, range }) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (files && files.length > 0) {
          const fileArray = Array.from(files);
          requestAnimationFrame(() => {
            if (editor.isDestroyed) {
              return;
            }

            editor.chain().focus().deleteRange(range).run();
            const commands = editor.commands as { uploadImageBlock?: (uploadFiles: File[], pos?: number) => boolean };
            if (typeof commands.uploadImageBlock === 'function') {
              commands.uploadImageBlock(fileArray, range.from);
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
      items: ({ query, editor }) => {
        return filterSlashCommandItems(defaultSlashCommands, query, editor);
      },
      transformItems: undefined,
      onError: undefined,
    };
  },

  addProseMirrorPlugins() {
    const { items, transformItems, onError } = this.options;
    let latestRequestSeq = 0;

    const resolvedItems = async ({ query, editor }: SlashCommandContext) => {
      const seq = ++latestRequestSeq;
      // Cheap early-exit: an empty base list cannot produce suggestions, so
      // skip transform + filter entirely.
      const base = items
        ? await items({ query, editor })
        : defaultSlashCommands.map((item) => ({ ...item }));
      if (seq !== latestRequestSeq) return [];
      if (base.length === 0) return base;
      // transformItems always applies — even on top of custom `items` — so
      // combining `slashCommands` + `transformSlashCommands` is not silently dead.
      const transformed = transformItems
        ? await transformItems(base, { query, editor })
        : base;
      if (seq !== latestRequestSeq) return [];

      // Custom items() callers may skip filtering; enforce it here for
      // consistent prefix/inclusion behavior and schema availability guards.
      return filterSlashCommandItems(transformed, query, editor);
    };

    return [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Extension.create erases items' return type to unknown[]; Suggestion expects SlashCommandItem[]
      Suggestion<SlashCommandItem, SlashCommandItem>({
        editor: this.editor,
        char: '/',
        pluginKey: SlashCommandPluginKey,
        items: resolvedItems as any,
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
