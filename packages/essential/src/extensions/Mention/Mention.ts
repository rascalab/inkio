import { mergeAttributes, type Range } from '@tiptap/core';
import { Mention as TiptapMention } from '@tiptap/extension-mention';
import { PluginKey as PMPluginKey } from '@tiptap/pm/state';
import { createSuggestionRenderer, toError, type InkioErrorHandler } from '@inkio/core';

export interface MentionItem {
  id: string;
  label: string;
  [key: string]: unknown;
}

export interface MentionOptions {
  HTMLAttributes: Record<string, unknown>;
  /** Suggestion options override */
  suggestion?: Record<string, unknown>;
  suggestions?: unknown[];
  deleteTriggerWithBackspace?: boolean;
  renderText?: (props: { node: { attrs: Record<string, string | null> } }) => string;
  renderHTML?: (props: {
    options: { HTMLAttributes: Record<string, unknown> };
    node: { attrs: Record<string, string | null> };
  }) => unknown;
  /** Function to fetch mention items */
  items?: (props: { query: string }) => MentionItem[] | Promise<MentionItem[]>;
  /** Generic extension-level error callback */
  onError?: InkioErrorHandler;
}

export const MentionPluginKey = new PMPluginKey('mention');

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mention: {
      /** Insert a mention */
      insertMention: (attributes: { id: string; label: string }) => ReturnType;
    };
  }
}

function createMentionSuggestionCommand(name: string, char: string) {
  return ({ editor, range, props }: { editor: any; range: Range; props: unknown }) => {
    const attributes = (props ?? {}) as MentionItem;
    const nodeAfter = editor.view.state.selection.$to.nodeAfter;
    const overrideSpace = nodeAfter?.text?.startsWith(' ');

    if (overrideSpace) {
      range.to += 1;
    }

    editor
      .chain()
      .focus()
      .insertContentAt(range, [
        {
          type: name,
          attrs: {
            ...attributes,
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

export const Mention = TiptapMention.extend<MentionOptions>({
  name: 'mention',

  addOptions() {
    const extension = this as typeof this & { options: MentionOptions };

    return {
      HTMLAttributes: {},
      suggestions: [],
      items: () => [],
      onError: undefined,
      deleteTriggerWithBackspace: false,
      suggestion: {
        char: '@',
        pluginKey: MentionPluginKey,
        items: async ({ query }: { query: string }) => {
          try {
            const result = await extension.options.items?.({ query });
            return result ?? [];
          } catch (error) {
            extension.options.onError?.(toError(error), {
              source: 'mention.suggestion',
              recoverable: true,
            });
            return [];
          }
        },
        command: createMentionSuggestionCommand(this.name, '@'),
        allow: ({ state, range }: { state: any; range: Range }) => {
          const $from = state.doc.resolve(range.from);
          const type = state.schema.nodes[extension.name];
          return !!type && !!$from.parent.type.contentMatch.matchType(type);
        },
        render: createSuggestionRenderer<MentionItem>({ header: 'Mentions' }),
      },
      renderText: ({ node }: { node: { attrs: Record<string, string | null> } }) => `@${node.attrs.label ?? node.attrs.id}`,
      renderHTML: ({ options, node }: {
        options: { HTMLAttributes: Record<string, unknown> };
        node: { attrs: Record<string, string | null> };
      }) => [
        'span',
        mergeAttributes(
          { 'data-mention': '', 'data-type': 'mention' },
          options.HTMLAttributes,
        ),
        `@${node.attrs.label ?? node.attrs.id}`,
      ],
    };
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-id'),
        renderHTML: (attributes: Record<string, string | null>) => (
          attributes.id ? { 'data-id': attributes.id } : {}
        ),
      },
      label: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-label'),
        renderHTML: (attributes: Record<string, string | null>) => (
          attributes.label ? { 'data-label': attributes.label } : {}
        ),
      },
      mentionSuggestionChar: {
        default: '@',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-mention-suggestion-char') ?? '@',
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'span[data-mention]' },
      { tag: 'span[data-type="mention"]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(
        { 'data-mention': '', 'data-type': 'mention' },
        this.options.HTMLAttributes,
        HTMLAttributes,
      ),
      `@${HTMLAttributes['data-label'] ?? HTMLAttributes['data-id'] ?? ''}`,
    ];
  },

  renderText({ node }) {
    return `@${node.attrs.label ?? node.attrs.id}`;
  },

  addCommands() {
    return {
      insertMention:
        (attributes) =>
          ({ commands }) => {
            return commands.insertContent({
              type: this.name,
              attrs: {
                ...attributes,
                mentionSuggestionChar: '@',
              },
            });
          },
    };
  },
});
