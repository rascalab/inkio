import { mentionConfig } from './trigger-config';
import { createTriggerSuggestionPlugin } from './trigger-suggestion';
import { createTriggerNode, type TriggerNodeOptions } from './trigger-node';

export interface MentionItem {
  id: string;
  label: string;
  [key: string]: unknown;
}

// Shape documented on TriggerNodeOptions: HTMLAttributes, suggestion(s),
// deleteTriggerWithBackspace, renderText/renderHTML, items, onError, onClick.
export interface MentionOptions extends TriggerNodeOptions<MentionItem> {}

export { MentionPluginKey } from './trigger-config';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mention: {
      /** Insert a mention */
      insertMention: (attributes: { id: string; label: string }) => ReturnType;
    };
  }
}

export const Mention = createTriggerNode<MentionOptions, MentionItem>(mentionConfig, createTriggerSuggestionPlugin);
