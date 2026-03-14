import { mergeAttributes, type Range } from '@tiptap/core';
import { Mention as TiptapMention } from '@tiptap/extension-mention';
import { PluginKey as PMPluginKey } from '@tiptap/pm/state';
import { createSuggestionRenderer, toError, type InkioErrorHandler } from '@inkio/core';

export interface HashTagItem {
  id: string;
  label: string;
  [key: string]: unknown;
}

export interface HashTagOptions {
  HTMLAttributes: Record<string, unknown>;
  /** Function to fetch hashtag items */
  items?: (props: { query: string }) => HashTagItem[] | Promise<HashTagItem[]>;
  /** Suggestion options override */
  suggestion?: Record<string, unknown>;
  suggestions?: unknown[];
  deleteTriggerWithBackspace?: boolean;
  renderText?: (props: { node: { attrs: Record<string, string | null> } }) => string;
  renderHTML?: (props: {
    options: { HTMLAttributes: Record<string, unknown> };
    node: { attrs: Record<string, string | null> };
  }) => unknown;
  /** Generic extension-level error callback */
  onError?: InkioErrorHandler;
}

export const HashTagPluginKey = new PMPluginKey('hashTag');

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    hashTag: {
      /** Insert a hashtag */
      insertHashTag: (attributes: { id: string; label: string }) => ReturnType;
    };
  }
}

function createHashTagSuggestionCommand(name: string, char: string) {
  return ({ editor, range, props }: { editor: any; range: Range; props: unknown }) => {
    const attributes = (props ?? {}) as HashTagItem;
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

export const HashTag = TiptapMention.extend<HashTagOptions>({
  name: 'hashTag',

  addOptions() {
    const extension = this as typeof this & { options: HashTagOptions };

    return {
      HTMLAttributes: {},
      suggestions: [],
      items: () => [],
      onError: undefined,
      deleteTriggerWithBackspace: false,
      suggestion: {
        char: '#',
        pluginKey: HashTagPluginKey,
        items: async ({ query }: { query: string }) => {
          try {
            const result = await extension.options.items?.({ query });
            return result ?? [];
          } catch (error) {
            extension.options.onError?.(toError(error), {
              source: 'hashTag.suggestion',
              recoverable: true,
            });
            return [];
          }
        },
        command: createHashTagSuggestionCommand(this.name, '#'),
        allow: ({ state, range }: { state: any; range: Range }) => {
          const $from = state.doc.resolve(range.from);
          const type = state.schema.nodes[extension.name];
          return !!type && !!$from.parent.type.contentMatch.matchType(type);
        },
        render: createSuggestionRenderer<HashTagItem>({ header: 'Hashtags' }),
      },
      renderText: ({ node }: { node: { attrs: Record<string, string | null> } }) => `#${node.attrs.label ?? node.attrs.id}`,
      renderHTML: ({ options, node }: {
        options: { HTMLAttributes: Record<string, unknown> };
        node: { attrs: Record<string, string | null> };
      }) => [
        'span',
        mergeAttributes(
          { 'data-hashtag': '', 'data-type': 'hashTag' },
          options.HTMLAttributes,
        ),
        `#${node.attrs.label ?? node.attrs.id}`,
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
        default: '#',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-mention-suggestion-char') ?? '#',
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'span[data-hashtag]' },
      { tag: 'span[data-type="hashTag"]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(
        { 'data-hashtag': '', 'data-type': 'hashTag' },
        this.options.HTMLAttributes,
        HTMLAttributes,
      ),
      `#${HTMLAttributes['data-label'] ?? HTMLAttributes['data-id'] ?? ''}`,
    ];
  },

  renderText({ node }) {
    return `#${node.attrs.label ?? node.attrs.id}`;
  },

  addCommands() {
    return {
      insertHashTag:
        (attributes) =>
          ({ commands }) => {
            return commands.insertContent({
              type: this.name,
              attrs: {
                ...attributes,
                mentionSuggestionChar: '#',
              },
            });
          },
    };
  },
});
