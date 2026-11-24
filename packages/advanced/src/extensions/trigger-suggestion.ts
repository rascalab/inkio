import type { Editor, Range } from '@tiptap/core';
import type { EditorState } from '@tiptap/pm/state';
import { Suggestion, type SuggestionOptions } from '@tiptap/suggestion';
import { createLatestWinsItems, createSuggestionRenderer } from '@inkio/core';
import type { TriggerNodeConfig, TriggerNodeItem, TriggerNodeOptions } from './trigger-node';

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
export function createTriggerSuggestionPlugin<Item extends TriggerNodeItem>(
  editor: Editor,
  config: TriggerNodeConfig,
  getOptions: () => TriggerNodeOptions<Item> | undefined,
): ReturnType<typeof Suggestion<Item, Item>> {
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

  return Suggestion<Item, Item>({
    editor,
    char,
    pluginKey,
    items: ({ query, editor, signal }) => items({ query, editor }, signal),
    command: createTriggerSuggestionCommand(name, char) as SuggestionOptions<Item, Item>['command'],
    allow: ({ state, range }: { state: EditorState; range: Range }) => {
      const $from = state.doc.resolve(range.from);
      const type = state.schema.nodes[name];
      return !!type && !!$from.parent.type.contentMatch.matchType(type);
    },
    render: createSuggestionRenderer<Item>({
      pluginKey: (getOptions()?.suggestion as Partial<SuggestionOptions> | undefined)?.pluginKey ?? pluginKey,
      header,
      locale: getOptions()?.locale,
      messages: getOptions()?.messages,
    }),
    ...(getOptions()?.suggestion as Partial<SuggestionOptions<Item, Item>>),
  });
}
