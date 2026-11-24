import {
  mergeAttributes,
  type CommandProps,
  type RawCommands,
} from '@tiptap/core';
import { Mention as TiptapMention } from '@tiptap/extension-mention';
import type { PluginKey } from '@tiptap/pm/state';
import type { SuggestionOptions } from '@tiptap/suggestion';
import type { createTriggerSuggestionPlugin } from './trigger-suggestion';
import type {
  CreateSuggestionRendererOptions,
  InkioCoreMessageOverrides,
  InkioErrorHandler,
  InkioLocaleInput,
  InkioMessageOverrides,
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
  /** Locale of the suggestion popup's own words */
  locale?: InkioLocaleInput;
  /** Message overrides for the suggestion popup's own words */
  messages?: InkioCoreMessageOverrides | InkioMessageOverrides;
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
  header: CreateSuggestionRendererOptions['header'];
  /** Name of the insert command, e.g. `insertMention`. */
  insertCommand: string;
  /** Trailing debounce for async `items()` sources (ms). */
  debounceMs?: number;
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
>(config: TriggerNodeConfig, createSuggestionPlugin?: typeof createTriggerSuggestionPlugin) {
  const { name, char, pluginKey, clickPluginKey, dataAttribute, insertCommand } = config;
  const markerAttributes = { [dataAttribute]: '', 'data-type': name };
  // An app's label may already start with the trigger (`#inkio`).
  const labelText = (attrs: TriggerNodeAttrs) => {
    const raw = attrs.label === '' || attrs.label == null ? attrs.id : attrs.label;
    const text = typeof raw === 'string' || typeof raw === 'number' ? String(raw) : '';
    return text.startsWith(char) ? text : char + text;
  };

  return TiptapMention.extend<Options>({
    name,

    addOptions() {
      return {
        HTMLAttributes: {},
        suggestions: [],
        items: undefined,
        onError: undefined,
        onClick: undefined,
        locale: undefined,
        messages: undefined,
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

    renderHTML({ node, HTMLAttributes }) {
      return [
        'span',
        mergeAttributes(
          markerAttributes,
          this.options.HTMLAttributes,
          HTMLAttributes,
        ),
        labelText(node.attrs as TriggerNodeAttrs),
      ];
    },

    renderText({ node }) {
      return labelText(node.attrs as TriggerNodeAttrs);
    },

    addProseMirrorPlugins() {
      // A multi-trigger `suggestions` list keeps the base Tiptap behavior;
      // otherwise build the single default suggestion here, where the live
      // options are directly reachable (no extensionManager lookup).
      const suggestion = this.options.suggestion as Partial<SuggestionOptions<Item, Item>> | undefined;
      // Without a source there is nothing to suggest: no empty popup on `@`.
      const hasSource = Boolean(this.options.items ?? suggestion?.items);
      const suggestionPlugins = this.options.suggestions?.length
        ? (this.parent?.() ?? [])
        : hasSource && createSuggestionPlugin
          ? [createSuggestionPlugin<Item>(this.editor, config, () => this.options)]
          : [];
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
