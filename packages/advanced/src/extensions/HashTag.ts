import { hashTagConfig } from './trigger-config';
import { createTriggerSuggestionPlugin } from './trigger-suggestion';
import { createTriggerNode, type TriggerNodeOptions } from './trigger-node';

export interface HashTagItem {
  id: string;
  label: string;
  [key: string]: unknown;
}

// Shape documented on TriggerNodeOptions (identical to MentionOptions).
export interface HashTagOptions extends TriggerNodeOptions<HashTagItem> {}

export { HashTagPluginKey } from './trigger-config';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    hashTag: {
      /** Insert a hashtag */
      insertHashTag: (attributes: { id: string; label: string }) => ReturnType;
    };
  }
}

export const HashTag = createTriggerNode<HashTagOptions, HashTagItem>(hashTagConfig, createTriggerSuggestionPlugin);
