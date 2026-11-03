import { Extension, type Editor, type Range } from '@tiptap/core';
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import { createElement, type ComponentType, type ReactNode } from 'react';
import {
  ImageIcon,
  ListTreeIcon,
  resolveIconRegistry,
  type InkioIconRegistry,
} from '@inkio/core/icons';
import {
  createLatestWinsItems,
  createSuggestionRenderer,
  enCoreMessages,
  mergeCoreMessages,
  runOptionalChainCommand,
  toCoreMessageOverrides,
  toError,
  type InkioCoreMessageOverrides,
  type InkioErrorHandler,
  type InkioLocaleInput,
  type InkioMessageOverrides,
} from '@inkio/core';

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
  // Typed with the item type: `Parameters<typeof Suggestion>` erases the
  // generics to unknown, which breaks the spread below (e.g. initialItems).
  suggestion?: Partial<SuggestionOptions<SlashCommandItem, SlashCommandItem>>;
  /** Function to fetch command items */
  items?: (props: { query: string; editor: Editor }) => SlashCommandItem[] | Promise<SlashCommandItem[]>;
  /** Transform the default items before they are filtered by query. */
  transformItems?: SlashCommandTransform;
  /** Generic extension-level error callback */
  onError?: InkioErrorHandler;
  /** Locale of the default items and the popup's own words */
  locale?: InkioLocaleInput;
  /** Message overrides for the default items and the popup's own words */
  messages?: InkioCoreMessageOverrides | InkioMessageOverrides;
  /** Icon overrides for the default items */
  icons?: Partial<InkioIconRegistry>;
}

export const SlashCommandPluginKey = new PluginKey('slashCommand');

export interface SlashCommandItemSource {
  items: SlashCommandOptions['items'];
  transformItems: SlashCommandOptions['transformItems'];
  onError: SlashCommandOptions['onError'];
  /** What to offer without custom `items`; defaults to defaultSlashCommands. */
  defaults?: SlashCommandItem[];
  /** Shared sequence cell; callers supersede each other across keystrokes. */
  latest: { value: number };
}

/**
 * Resolve slash suggestions with the same contract as Mention/HashTag: a
 * throwing custom source reports via onError and yields [] instead of an
 * unhandled rejection, and stale sequences yield [] so slow responses never
 * overwrite newer ones. Exported beside filterSlashCommandItems so the
 * contract is unit-testable without driving the suggestion plugin.
 */
export async function resolveSlashCommandItems(
  context: SlashCommandContext,
  source: SlashCommandItemSource,
): Promise<SlashCommandItem[]> {
  const { items, transformItems, onError, defaults = defaultSlashCommands, latest } = source;
  // No debounce: the slash menu resolves synchronously-cheap defaults and
  // must feel instant. The caller-owned `latest` cell is the scope.
  const resolve = createLatestWinsItems<SlashCommandContext, SlashCommandItem>({
    scope: () => latest,
    onError: (error) => {
      onError?.(error, { source: 'slashCommand.suggestion', recoverable: true });
    },
    source: async ({ query, editor }, { isCurrent }) => {
      const base = items
        ? await items({ query, editor })
        : defaults.map((item) => ({ ...item }));
      if (!isCurrent()) return [];
      // transformItems always applies — even on top of custom `items` and
      // even over an empty base (a transform may inject contextual items) —
      // so combining `slashCommands` + `transformSlashCommands` is never
      // silently dead.
      const transformed = transformItems
        ? await transformItems(base, { query, editor })
        : base;
      if (!isCurrent()) return [];

      // Custom items() callers may skip filtering; enforce it here for
      // consistent prefix/inclusion behavior and schema availability guards.
      return filterSlashCommandItems(transformed, query, editor);
    },
  });
  return resolve(context);
}

function hasSchemaNode(editor: Editor, name: string): boolean {
  return name in editor.state.schema.nodes;
}

function isInsideTable(editor: Editor): boolean {
  const $from = editor.state.selection?.$from;
  for (let depth = $from?.depth ?? 0; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === 'table') return true;
  }
  return false;
}

const LIST_ITEM_NODES = ['listItem', 'taskItem'];
const LIST_OF_COMMAND: Record<string, string> = {
  bulletList: 'bulletList',
  numberedList: 'orderedList',
  taskList: 'taskList',
};
/** Blocks a list item would hold beside an empty line, or refuse outright. */
const LEAVES_LIST = new Set(['table', 'horizontalRule', 'callout', 'toggleList', 'toc', 'image']);

/**
 * Where a command typed in a list item applies. A list command for the list it
 * is already in has nothing to do; a block takes the item's place outside the
 * list, as headings and code blocks do by themselves. Null means done.
 */
function prepareRange(editor: Editor, range: Range, id: unknown): Range | null {
  const { $from } = editor.state.selection;
  const item = LIST_ITEM_NODES.find((name) => $from.node($from.depth - 1)?.type.name === name);
  if (!item || typeof id !== 'string') return range;

  if (LIST_OF_COMMAND[id] === $from.node($from.depth - 2)?.type.name) {
    editor.chain().focus().deleteRange(range).run();
    return null;
  }
  if (!LEAVES_LIST.has(id)) return range;

  const length = range.to - range.from;
  while (editor.can().liftListItem(item)) {
    editor.commands.liftListItem(item);
  }
  const to = editor.state.selection.from;
  return { from: to - length, to };
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
    // The id doubles as a short alias (`toc` for "Table of Contents").
    if (
      normalizedQuery
      && !item.label.toLowerCase().includes(normalizedQuery)
      && !item.id.toLowerCase().includes(normalizedQuery)
    ) {
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
    label: enCoreMessages.slashCommand.heading1,
    command: ({ editor, range }) => {
      runOptionalChainCommand(editor, 'setHeading', {
        args: { level: 1 },
        prepare: (chain) => chain.deleteRange(range),
      });
    },
  },
  {
    id: 'heading2',
    label: enCoreMessages.slashCommand.heading2,
    command: ({ editor, range }) => {
      runOptionalChainCommand(editor, 'setHeading', {
        args: { level: 2 },
        prepare: (chain) => chain.deleteRange(range),
      });
    },
  },
  {
    id: 'heading3',
    label: enCoreMessages.slashCommand.heading3,
    command: ({ editor, range }) => {
      runOptionalChainCommand(editor, 'setHeading', {
        args: { level: 3 },
        prepare: (chain) => chain.deleteRange(range),
      });
    },
  },
  {
    id: 'bulletList',
    label: enCoreMessages.slashCommand.bulletList,
    command: ({ editor, range }) => {
      runOptionalChainCommand(editor, 'toggleBulletList', {
        prepare: (chain) => chain.deleteRange(range),
      });
    },
  },
  {
    id: 'numberedList',
    label: enCoreMessages.slashCommand.numberedList,
    command: ({ editor, range }) => {
      runOptionalChainCommand(editor, 'toggleOrderedList', {
        prepare: (chain) => chain.deleteRange(range),
      });
    },
  },
  {
    id: 'taskList',
    label: enCoreMessages.slashCommand.taskList,
    command: ({ editor, range }) => {
      runOptionalChainCommand(editor, 'toggleTaskList', {
        prepare: (chain) => chain.deleteRange(range),
      });
    },
  },
  {
    id: 'table',
    label: enCoreMessages.slashCommand.table,
    command: ({ editor, range }) => {
      runOptionalChainCommand(editor, 'insertTable', {
        args: { rows: 3, cols: 3, withHeaderRow: true },
        prepare: (chain) => chain.deleteRange(range),
      });
    },
    isAvailable: (editor) => hasSchemaNode(editor, 'table') && !isInsideTable(editor),
  },
  {
    id: 'codeBlock',
    label: enCoreMessages.slashCommand.codeBlock,
    command: ({ editor, range }) => {
      runOptionalChainCommand(editor, 'toggleCodeBlock', {
        prepare: (chain) => chain.deleteRange(range),
      });
    },
  },
  {
    id: 'horizontalRule',
    label: enCoreMessages.slashCommand.horizontalRule,
    command: ({ editor, range }) => {
      runOptionalChainCommand(editor, 'setHorizontalRule', {
        prepare: (chain) => chain.deleteRange(range),
      });
    },
  },
  {
    id: 'callout',
    label: enCoreMessages.slashCommand.callout,
    command: ({ editor, range }) => {
      runOptionalChainCommand(editor, 'setCallout', {
        prepare: (chain) => chain.deleteRange(range),
      });
    },
  },
  {
    id: 'toggleList',
    label: enCoreMessages.slashCommand.toggleList,
    command: ({ editor, range }) => {
      runOptionalChainCommand(editor, 'setDetails', {
        prepare: (chain) => chain.deleteRange(range),
      });
    },
    isAvailable: (editor) => hasSchemaNode(editor, 'details'),
  },
  {
    id: 'toc',
    label: enCoreMessages.slashCommand.toc,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent({ type: 'tocBlock' }).run();
    },
    isAvailable: (editor) => hasSchemaNode(editor, 'tocBlock') && !isInsideTable(editor),
  },
  {
    id: 'image',
    label: enCoreMessages.slashCommand.image,
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

function localizedSlashCommands(
  locale: SlashCommandOptions['locale'],
  messages: SlashCommandOptions['messages'],
  icons: SlashCommandOptions['icons'],
): SlashCommandItem[] {
  const said: Record<string, string> =
    mergeCoreMessages(locale, toCoreMessageOverrides(messages)).slashCommand;
  const registry = resolveIconRegistry(icons);
  // The same icon each action has in the other menus; two have no action there.
  const iconOf: Record<string, ComponentType<{ size?: number; strokeWidth?: number }> | undefined> = {
    ...registry,
    numberedList: registry.orderedList,
    toc: ListTreeIcon,
    image: ImageIcon,
  };
  return defaultSlashCommands.map((item) => {
    const Icon = iconOf[item.id];
    return {
      ...item,
      label: said[item.id] ?? item.label,
      ...(Icon ? { icon: createElement(Icon, { size: 16, strokeWidth: 1.8 }) } : {}),
    };
  });
}

export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {},
      // No default source: filtering it here would hide items from
      // transformItems, which sees them before they are filtered by query.
      items: undefined,
      transformItems: undefined,
      onError: undefined,
      locale: undefined,
      messages: undefined,
      icons: undefined,
    };
  },

  addProseMirrorPlugins() {
    const { items, transformItems, onError, locale, messages, icons } = this.options;
    const defaults = localizedSlashCommands(locale, messages, icons);
    // One sequence cell per plugin instance (i.e. per editor) so
    // interleaved editors never drop each other's results.
    const latest = { value: 0 };

    const resolvedItems = async ({ query, editor }: SlashCommandContext) =>
      resolveSlashCommandItems({ query, editor }, { items, transformItems, onError, defaults, latest });

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

            const target = prepareRange(editor, range, props.id);
            if (!target) return;
            const maybePromise = props.command({ editor, range: target });
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
        // Any paragraph that starts with the slash: lists, quotes and cells too.
        allow: ({ state, range }) => {
          const { parent } = state.doc.resolve(range.from);
          return parent.type.name === 'paragraph' && parent.textContent.charAt(0) === '/';
        },
        render: createSuggestionRenderer<SlashCommandItem>({ locale, messages }),
        ...this.options.suggestion,
      }),
    ];
  },
});
