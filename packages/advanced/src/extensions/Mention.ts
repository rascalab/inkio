import { PluginKey as PMPluginKey } from '@tiptap/pm/state';
import { mentionClickPluginKey } from './inline-node-click';
import { createTriggerNode, type TriggerNodeOptions } from './trigger-node';

export interface MentionItem {
  id: string;
  label: string;
  [key: string]: unknown;
}

// Shape documented on TriggerNodeOptions: HTMLAttributes, suggestion(s),
// deleteTriggerWithBackspace, renderText/renderHTML, items, onError, onClick.
export interface MentionOptions extends TriggerNodeOptions<MentionItem> {}

export const MentionPluginKey = new PMPluginKey('mention');

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mention: {
      /** Insert a mention */
      insertMention: (attributes: { id: string; label: string }) => ReturnType;
    };
  }
}

export const Mention = createTriggerNode<MentionOptions, MentionItem>({
  name: 'mention',
  char: '@',
  pluginKey: MentionPluginKey,
  clickPluginKey: mentionClickPluginKey,
  dataAttribute: 'data-mention',
  header: 'Mentions',
  insertCommand: 'insertMention',
});
