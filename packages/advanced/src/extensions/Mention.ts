import { mergeAttributes, type Editor, type Range } from '@tiptap/core';
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

export const Mention = TiptapMention.extend<MentionOptions>({
  name: 'mention',

  addOptions() {
    // `this` inside addOptions is a transient context whose `.options` is never
    // populated — resolve the live options from the editor at suggestion time.
    const extensionName = this.name;
    // Drop stale async responses: a slow earlier keystroke must not overwrite
    // a newer query's list.
    let latestRequestSeq = 0;
    // Trailing debounce: rapid keystrokes resolve only the latest query, so
    // an async items() source is not hammered once per keystroke. Superseded
    // sequences return before ever invoking items().

    return {
      HTMLAttributes: {},
      suggestions: [],
      items: () => [],
      onError: undefined,
      deleteTriggerWithBackspace: false,
      suggestion: {
        char: '@',
        pluginKey: MentionPluginKey,
        items: async ({ query, editor }: { query: string; editor: Editor }) => {
          const options = editor.extensionManager.extensions
            .find((ext) => ext.name === extensionName)?.options as MentionOptions | undefined;
          const seq = ++latestRequestSeq;
          const debounceMs = 150;
          await new Promise<void>((resolve) => setTimeout(resolve, debounceMs));
          if (seq !== latestRequestSeq) return [];
          try {
            const result = await options?.items?.({ query });
            if (seq !== latestRequestSeq) return [];
            return result ?? [];
          } catch (error) {
            if (seq !== latestRequestSeq) return [];
            options?.onError?.(toError(error), {
              source: 'mention.suggestion',
              recoverable: true,
            });
            return [];
          }
        },
        command: createMentionSuggestionCommand(this.name, '@'),
        allow: ({ state, range }: { state: any; range: Range }) => {
          const $from = state.doc.resolve(range.from);
          const type = state.schema.nodes[extensionName];
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
