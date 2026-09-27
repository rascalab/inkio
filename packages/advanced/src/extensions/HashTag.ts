import { PluginKey as PMPluginKey } from '@tiptap/pm/state';
import { hashTagClickPluginKey } from './inline-node-click';
import { createTriggerNode, type TriggerNodeOptions } from './trigger-node';

export interface HashTagItem {
  id: string;
  label: string;
  [key: string]: unknown;
}

// Shape documented on TriggerNodeOptions (identical to MentionOptions).
export interface HashTagOptions extends TriggerNodeOptions<HashTagItem> {}

export const HashTagPluginKey = new PMPluginKey('hashTag');

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    hashTag: {
      /** Insert a hashtag */
      insertHashTag: (attributes: { id: string; label: string }) => ReturnType;
    };
  }
}

export const HashTag = createTriggerNode<HashTagOptions, HashTagItem>({
  name: 'hashTag',
  char: '#',
  pluginKey: HashTagPluginKey,
  clickPluginKey: hashTagClickPluginKey,
  dataAttribute: 'data-hashtag',
  header: 'Hashtags',
  insertCommand: 'insertHashTag',
});
