import { Node, mergeAttributes } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import { createSuggestionRenderer, toError, type InkioErrorHandler } from '@inkio/editor';

export interface HashTagItem {
  id: string;
  label: string;
  [key: string]: unknown;
}

export interface HashTagOptions {
  HTMLAttributes: Record<string, any>;
  /** Function to fetch hashtag items */
  items?: (props: { query: string }) => HashTagItem[] | Promise<HashTagItem[]>;
  /** Suggestion options override */
  suggestion?: Partial<Parameters<typeof Suggestion>[0]>;
  /** Generic extension-level error callback */
  onError?: InkioErrorHandler;
}

export const HashTagPluginKey = new PluginKey('hashTag');

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    hashTag: {
      /** Insert a hashtag */
      insertHashTag: (attributes: { id: string; label: string }) => ReturnType;
    };
  }
}

export const HashTag = Node.create<HashTagOptions>({
  name: 'hashTag',

  group: 'inline',

  inline: true,

  selectable: false,

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      items: () => [],
      suggestion: {},
      onError: undefined,
    };
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-id'),
        renderHTML: (attributes) => ({
          'data-id': attributes.id,
        }),
      },
      label: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-label'),
        renderHTML: (attributes) => ({
          'data-label': attributes.label,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-hashtag]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(
        { 'data-hashtag': '', 'data-type': 'hashTag' },
        this.options.HTMLAttributes,
        HTMLAttributes
      ),
      `#${HTMLAttributes['data-label']}`,
    ];
  },

  addCommands() {
    return {
      insertHashTag:
        (attributes) =>
          ({ commands }) => {
            return commands.insertContent({
              type: this.name,
              attrs: attributes,
            });
          },
    };
  },

  addProseMirrorPlugins() {
    const hashtagItems: HashTagOptions['items'] = this.options.items;
    const { onError } = this.options;

    return [
      Suggestion<HashTagItem>({
        editor: this.editor,
        char: '#',
        pluginKey: HashTagPluginKey,
        items: async (props) => {
          try {
            const result = await hashtagItems?.(props);
            return result ?? [];
          } catch (error) {
            onError?.(toError(error), { source: 'hashTag.suggestion', recoverable: true });
            return [];
          }
        },
        command: ({ editor, range, props }) => {
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
                type: this.name,
                attrs: props,
              },
              {
                type: 'text',
                text: ' ',
              },
            ])
            .run();
        },
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          const type = state.schema.nodes[this.name];
          const allow = !!$from.parent.type.contentMatch.matchType(type);
          return allow;
        },
        render: createSuggestionRenderer<HashTagItem>({ header: 'Hashtags' }),
        ...(this.options.suggestion as Omit<typeof this.options.suggestion, 'items'>),
      }),
    ];
  },
});
