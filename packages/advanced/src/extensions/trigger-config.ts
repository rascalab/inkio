import { PluginKey } from '@tiptap/pm/state';
import { hashTagClickPluginKey, mentionClickPluginKey } from './inline-node-click';
import type { TriggerNodeConfig } from './trigger-node';

export const MentionPluginKey = new PluginKey('mention');
export const HashTagPluginKey = new PluginKey('hashTag');

export const mentionConfig: TriggerNodeConfig = {
  name: 'mention',
  char: '@',
  pluginKey: MentionPluginKey,
  clickPluginKey: mentionClickPluginKey,
  dataAttribute: 'data-mention',
  header: (said) => said.mentions,
  insertCommand: 'insertMention',
};

export const hashTagConfig: TriggerNodeConfig = {
  name: 'hashTag',
  char: '#',
  pluginKey: HashTagPluginKey,
  clickPluginKey: hashTagClickPluginKey,
  dataAttribute: 'data-hashtag',
  header: (said) => said.hashtags,
  insertCommand: 'insertHashTag',
};
