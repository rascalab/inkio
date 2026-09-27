import {
  mergeAttributes,
  type CommandProps,
  type Editor,
  type Range,
  type RawCommands,
} from '@tiptap/core';
import { Mention as TiptapMention } from '@tiptap/extension-mention';
import type { EditorState, PluginKey } from '@tiptap/pm/state';
import { Suggestion, type SuggestionOptions } from '@tiptap/suggestion';
import {
  createLatestWinsItems,
  createSuggestionRenderer,
  type InkioErrorHandler,
} from '@inkio/core';
import { createInlineNodeClickPlugin } from './inline-node-click';

/** Item shape shared by trigger-char inline nodes (mention, hashtag). */
export interface TriggerNodeItem {
  id: string;
  label: string;
  [key: string]: unknown;
}

type TriggerNodeAttrs = Record<string, string | null>;

export interface TriggerNodeOptions<Item extends TriggerNodeItem> {
  HTMLAttributes: Record<string, unknown>;
  /** Suggestion options override */
  suggestion?: Record<string, unknown>;
  suggestions?: unknown[];
  deleteTriggerWithBackspace?: boolean;
  renderText?: (props: { node: { attrs: TriggerNodeAttrs } }) => string;
  renderHTML?: (props: {
    options: { HTMLAttributes: Record<string, unknown> };
    node: { attrs: TriggerNodeAttrs };
  }) => unknown;
  /** Function to fetch suggestion items */
  items?: (props: { query: string }) => Item[] | Promise<Item[]>;
  /** Generic extension-level error callback */
  onError?: InkioErrorHandler;
  /** Observational click callback (selection behavior unchanged) */
  onClick?: (id: string) => void;
}

export interface TriggerNodeConfig {
  /** Node/extension name, e.g. `mention`. Also the `data-type` value. */
  name: string;
  /** Trigger character, e.g. `@`. */
  char: string;
  /** Suggestion plugin key. */
  pluginKey: PluginKey;
  /** Click plugin key (see inline-node-click). */
  clickPluginKey: PluginKey;
  /** Marker attribute rendered on the span, e.g. `data-mention`. */
  dataAttribute: string;
  /** Suggestion popup header. */
  header: string;
  /** Name of the insert command, e.g. `insertMention`. */
  insertCommand: string;
  /** Trailing debounce for async `items()` sources (ms). */
  debounceMs?: number;
}

const DEFAULT_DEBOUNCE_MS = 150;

function createTriggerSuggestionCommand(name: string, char: string) {
  return ({ editor, range, props }: { editor: Editor; range: Range; props: unknown }) => {
    const attributes = (props ?? {}) as TriggerNodeItem;
    const id = typeof attributes.id === 'string' ? attributes.id : '';
    const label = typeof attributes.label === 'string' ? attributes.label : '';
    if (!id || !label) return;

    // Never mutate the caller's range. Resolve the char after `range.to`
    // (not the live selection) and only consume a single directly-adjacent space.
    const insertRange = { from: range.from, to: range.to };
    try {
      const $to = editor.view.state.doc.resolve(insertRange.to);
      const nodeAfter = $to.nodeAfter;
      const textAfter = typeof nodeAfter?.text === 'string' ? nodeAfter.text : '';
      const offsetIntoNode = $to.textOffset;
      if (offsetIntoNode === 0 && textAfter.startsWith(' ')) {
        insertRange.to += 1;
      }
    } catch {
      // Fall through with the unextended range.
    }

    editor
      .chain()
      .focus()
      .insertContentAt(insertRange, [
        {
          type: name,
          attrs: {
            id,
            label,
            mentionSuggestionChar: char,
          },
        },
        {
          type: 'text',
          text: ' ',
        },
      ])
      .run();
  };
}

/**
 * Default suggestion options for a trigger node. Built per plugin instance
 * (i.e. per editor), so the latest-wins sequence is isolated per editor and
 * the extension's live options are read directly via `getOptions`.
 */
export function createTriggerSuggestion<Item extends TriggerNodeItem>(
  config: TriggerNodeConfig,
  getOptions: () => TriggerNodeOptions<Item> | undefined,
): Omit<SuggestionOptions<Item, Item>, 'editor'> {
  const { name, char, pluginKey, header } = config;
  const items = createLatestWinsItems<{ query: string; editor: Editor }, Item>({
    // Trailing debounce: rapid keystrokes resolve only the latest query, so
    // an async items() source is not hammered once per keystroke.
    debounceMs: config.debounceMs ?? DEFAULT_DEBOUNCE_MS,
    source: ({ query }) => getOptions()?.items?.({ query }),
    onError: (error) => {
      getOptions()?.onError?.(error, {
        source: `${name}.suggestion`,
        recoverable: true,
      });
    },
  });

  return {
    char,
    pluginKey,
    items,
    command: createTriggerSuggestionCommand(name, char) as SuggestionOptions<Item, Item>['command'],
    allow: ({ state, range }: { state: EditorState; range: Range }) => {
      const $from = state.doc.resolve(range.from);
      const type = state.schema.nodes[name];
      return !!type && !!$from.parent.type.contentMatch.matchType(type);
    },
    render: createSuggestionRenderer<Item>({ header }),
  };
}

/**
 * Factory for trigger-char inline atom nodes (Mention `@`, HashTag `#`):
 * shared attributes, HTML/text rendering, suggestion wiring, click plugin
 * and insert command. Each caller supplies only its identity (name, char,
 * keys, marker attribute).
 */
export function createTriggerNode<
  Options extends TriggerNodeOptions<Item>,
  Item extends TriggerNodeItem = TriggerNodeItem,
>(config: TriggerNodeConfig) {
  const { name, char, pluginKey, clickPluginKey, dataAttribute, insertCommand } = config;
  const markerAttributes = { [dataAttribute]: '', 'data-type': name };
  const labelText = (attrs: TriggerNodeAttrs) => `${char}${attrs.label ?? attrs.id}`;

  return TiptapMention.extend<Options>({
    name,

    addOptions() {
      return {
        HTMLAttributes: {},
        suggestions: [],
        items: () => [],
        onError: undefined,
        onClick: undefined,
        deleteTriggerWithBackspace: false,
        // The full suggestion (items/command/allow/render) is assembled in
        // addProseMirrorPlugins; user `suggestion` overrides still win.
        suggestion: {
          char,
          pluginKey,
        },
        renderText: ({ node }: { node: { attrs: TriggerNodeAttrs } }) => labelText(node.attrs),
        renderHTML: ({ options, node }: {
          options: { HTMLAttributes: Record<string, unknown> };
          node: { attrs: TriggerNodeAttrs };
        }) => [
          'span',
          mergeAttributes(markerAttributes, options.HTMLAttributes),
          labelText(node.attrs),
        ],
      } as unknown as Options;
    },

    addAttributes() {
      return {
        id: {
          default: null,
          parseHTML: (element: HTMLElement) => element.getAttribute('data-id'),
          renderHTML: (attributes: TriggerNodeAttrs) => (
            attributes.id ? { 'data-id': attributes.id } : {}
          ),
        },
        label: {
          default: null,
          parseHTML: (element: HTMLElement) => element.getAttribute('data-label'),
          renderHTML: (attributes: TriggerNodeAttrs) => (
            attributes.label ? { 'data-label': attributes.label } : {}
          ),
        },
        mentionSuggestionChar: {
          default: char,
          parseHTML: (element: HTMLElement) => element.getAttribute('data-mention-suggestion-char') ?? char,
          renderHTML: () => ({}),
        },
      };
    },

    parseHTML() {
      return [
        { tag: `span[${dataAttribute}]` },
        { tag: `span[data-type="${name}"]` },
      ];
    },

    renderHTML({ HTMLAttributes }) {
      return [
        'span',
        mergeAttributes(
          markerAttributes,
          this.options.HTMLAttributes,
          HTMLAttributes,
        ),
        `${char}${HTMLAttributes['data-label'] ?? HTMLAttributes['data-id'] ?? ''}`,
      ];
    },

    renderText({ node }) {
      return labelText(node.attrs as TriggerNodeAttrs);
    },

    addProseMirrorPlugins() {
      // A multi-trigger `suggestions` list keeps the base Tiptap behavior;
      // otherwise build the single default suggestion here, where the live
      // options are directly reachable (no extensionManager lookup).
      const suggestionPlugins = this.options.suggestions?.length
        ? (this.parent?.() ?? [])
        : [
            Suggestion<Item, Item>({
              editor: this.editor,
              ...createTriggerSuggestion<Item>(config, () => this.options),
              ...(this.options.suggestion as Partial<SuggestionOptions<Item, Item>> | undefined),
            }),
          ];
      return [
        ...suggestionPlugins,
        createInlineNodeClickPlugin(clickPluginKey, this.name, () => this.options.onClick),
      ];
    },

    addCommands() {
      return {
        [insertCommand]:
          (attributes: { id: string; label: string }) =>
            ({ commands, editor }: CommandProps) => {
              // Same contract as the suggestion path: reject empty ids and
              // never mutate a read-only document from a programmatic call.
              if (!attributes.id || !attributes.label) return false;
              if (editor && !editor.isEditable) return false;
              return commands.insertContent({
                type: this.name,
                attrs: {
                  ...attributes,
                  mentionSuggestionChar: char,
                },
              });
            },
      } as unknown as Partial<RawCommands>;
    },
  });
}
