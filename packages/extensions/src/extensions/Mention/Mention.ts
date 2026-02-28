import { Node, mergeAttributes } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import { createSuggestionRenderer, toError, type InkioErrorHandler } from '@inkio/editor';

export interface MentionItem {
  id: string;
  label: string;
  [key: string]: unknown;
}

export interface MentionOptions {
  HTMLAttributes: Record<string, any>;
  /** Suggestion options override */
  suggestion?: Partial<Parameters<typeof Suggestion>[0]>;
  /** Function to fetch mention items */
  items?: (props: { query: string }) => MentionItem[] | Promise<MentionItem[]>;
  /** Generic extension-level error callback */
  onError?: InkioErrorHandler;
}

export const MentionPluginKey = new PluginKey('mention');

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mention: {
      /** Insert a mention */
      insertMention: (attributes: { id: string; label: string }) => ReturnType;
    };
  }
}

export const Mention = Node.create<MentionOptions>({
  name: 'mention',

  group: 'inline',

  inline: true,

  selectable: false,

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      suggestion: {},
      items: () => [],
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
        tag: 'span[data-mention]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(
        { 'data-mention': '', 'data-type': 'mention' },
        this.options.HTMLAttributes,
        HTMLAttributes
      ),
      `@${HTMLAttributes['data-label']}`,
    ];
  },

  addCommands() {
    return {
      insertMention:
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
    const mentionItems: MentionOptions['items'] = this.options.items;
    const { onError } = this.options;

    return [
      Suggestion<MentionItem>({
        editor: this.editor,
        char: '@',
        pluginKey: MentionPluginKey,
        items: async (props) => {
          try {
            const result = await mentionItems?.(props);
            return result ?? [];
          } catch (error) {
            onError?.(toError(error), { source: 'mention.suggestion', recoverable: true });
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
        render: createSuggestionRenderer<MentionItem>({ header: 'Mentions' }),
        ...(this.options.suggestion as Omit<typeof this.options.suggestion, 'items'>),
      }),
    ];
  },
});
