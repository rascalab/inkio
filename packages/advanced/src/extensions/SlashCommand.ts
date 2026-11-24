import { Extension, type Editor, type EditorEvents, type Range } from '@tiptap/core';
import { Suggestion, type SuggestionOptions } from '@tiptap/suggestion';
import { PluginKey, Selection } from '@tiptap/pm/state';
import { createElement, type ComponentType, type ReactNode } from 'react';
import { resolveIconRegistry, type InkioIconRegistry } from '@inkio/core/icons';
import {
  createLatestWinsItems,
  createSuggestionRenderer,
  enCoreMessages,
  editorUi,
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
  signal?: AbortSignal,
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
  return resolve(context, signal);
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
  // Labels hold spaces (`제목 1`), and people may or may not type them.
  const compact = (text: string) => text.toLowerCase().replace(/\s+/g, '');
  const normalizedQuery = compact(query);
  const result: SlashCommandItem[] = [];
  for (const item of items) {
    if (result.length >= limit) break;
    if (item.isAvailable && !item.isAvailable(editor)) {
      continue;
    }
    // The id doubles as a short alias (`toc` for "Table of Contents").
    if (
      normalizedQuery
      && !compact(item.label).includes(normalizedQuery)
      && !compact(item.id).includes(normalizedQuery)
    ) {
      continue;
    }
    result.push(item);
  }
  return result;
}

function chainItem(id: keyof typeof enCoreMessages.slashCommand, command: string, args?: object): SlashCommandItem {
  return {
    id,
    label: enCoreMessages.slashCommand[id],
    command: ({ editor, range }) => {
      runOptionalChainCommand(editor, command, { args, prepare: (chain) => chain.deleteRange(range) });
    },
  };
}

export const defaultSlashCommands: SlashCommandItem[] = [
  chainItem('heading1', 'setHeading', { level: 1 }),
  chainItem('heading2', 'setHeading', { level: 2 }),
  chainItem('heading3', 'setHeading', { level: 3 }),
  chainItem('bulletList', 'toggleBulletList'),
  chainItem('numberedList', 'toggleOrderedList'),
  chainItem('taskList', 'toggleTaskList'),
  {
    ...chainItem('table', 'insertTable', { rows: 3, cols: 3, withHeaderRow: true }),
    isAvailable: (editor) => hasSchemaNode(editor, 'table') && !isInsideTable(editor),
  },
  chainItem('codeBlock', 'toggleCodeBlock'),
  chainItem('horizontalRule', 'setHorizontalRule'),
  chainItem('callout', 'setCallout'),
  {
    ...chainItem('toggleList', 'setDetails'),
    isAvailable: (editor) => hasSchemaNode(editor, 'details'),
  },
  {
    id: 'toc',
    label: enCoreMessages.slashCommand.toc,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent({ type: 'tocBlock' }).run();
      // Insertion selects the block, and typing would replace it: write below it.
      const { doc, schema, selection, tr } = editor.state;
      if (!doc.resolve(selection.to).nodeAfter) tr.insert(selection.to, schema.nodes.paragraph.create());
      editor.view.dispatch(tr.setSelection(Selection.near(tr.doc.resolve(selection.to), 1)));
    },
    isAvailable: (editor) => hasSchemaNode(editor, 'tocBlock') && !isInsideTable(editor),
  },
  {
    id: 'image',
    label: enCoreMessages.slashCommand.image,
    command: ({ editor, range }) => {
      if (!editor.isEditable || typeof editor.commands.uploadImageBlock !== 'function') return;
      const trigger = editor.state.doc.slice(range.from, range.to);
      let target: Range | null = { ...range };
      const track = ({ transaction, appendedTransactions }: EditorEvents['transaction']) => {
        for (const tr of [transaction, ...appendedTransactions]) {
          if (!target || !tr.docChanged) continue;
          const from = tr.mapping.mapResult(target.from, 1);
          const to = tr.mapping.mapResult(target.to, -1);
          target = from.deleted || to.deleted || from.pos >= to.pos ? null : { from: from.pos, to: to.pos };
        }
      };
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      const cleanup = () => { editor.off('transaction', track); };
      input.oncancel = cleanup;
      input.onchange = () => {
        const files = Array.from(input.files ?? []);
        if (!files.length) {
          cleanup();
          return;
        }
        requestAnimationFrame(() => {
          cleanup();
          if (!target || editor.isDestroyed || !editor.isEditable
            || !trigger.eq(editor.state.doc.slice(target.from, target.to))) return;
          editor.chain().focus().deleteRange(target).uploadImageBlock(files, target.from).run();
        });
      };
      editor.on('transaction', track);
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
  // The same icon each action has in the other menus.
  const iconOf: Record<string, ComponentType<{ size?: number; strokeWidth?: number }> | undefined> = {
    ...registry,
    numberedList: registry.orderedList,
    toc: registry.tableOfContents,
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
    // One sequence cell per plugin instance (i.e. per editor) so
    // interleaved editors never drop each other's results.
    const latest = { value: 0 };

    // Only a settled renderer update belongs to the current query: the
    // provider also resolves stale/aborted requests with an empty list.
    let unmatched: { from: number; text: string } | null = null;
    const render = this.options.suggestion?.render ?? createSuggestionRenderer<SlashCommandItem>({
      locale, messages, pluginKey: this.options.suggestion?.pluginKey ?? SlashCommandPluginKey,
    });
    const resolvedItems = ({ query, editor, signal }: SlashCommandContext & { signal: AbortSignal }) => {
      const ui = editorUi(editor, { locale, messages, icons });
      const defaults = localizedSlashCommands(ui.locale, ui.messages, ui.icons);
      return resolveSlashCommandItems({ query, editor }, { items, transformItems, onError, defaults, latest }, signal);
    };

    return [
      Suggestion<SlashCommandItem, SlashCommandItem>({
        editor: this.editor,
        char: '/',
        pluginKey: SlashCommandPluginKey,
        items: resolvedItems,
        allowSpaces: true,
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
          const $from = state.doc.resolve(range.from);
          if ($from.parent.type.name !== 'paragraph' || $from.parentOffset !== 0) return false;
          if (unmatched?.from !== range.from) return true;
          const text = state.doc.textBetween(range.from, range.to);
          return !text.startsWith(unmatched.text) || !/\s/.test(text.charAt(unmatched.text.length));
        },
        ...this.options.suggestion,
        render: () => {
          const renderer = render();
          return {
            ...renderer,
            onUpdate(props) {
              unmatched = !props.loading && !props.items.length ? { from: props.range.from, text: props.text } : null;
              renderer.onUpdate?.(props);
            },
          };
        },
      }),
    ];
  },
});
