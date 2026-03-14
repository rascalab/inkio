export { Comment } from './Comment';
export type { CommentOptions } from './Comment';
export {
  commentComposerPluginKey,
  commentThreadPopoverPluginKey,
} from './Comment';
export {
  CommentPanel,
  CommentComposer,
  CommentThreadPopover,
} from './Comment/components';
export type {
  CommentPanelProps,
  CommentThreadData,
  CommentMessage,
  CommentComposerProps,
  CommentThreadPopoverProps,
} from './Comment/components';
export {
  enCommentMessages,
  mergeCommentMessages,
  resolveCommentMessages,
  toCommentMessageOverrides,
  formatRelativeTime,
} from './i18n';
export type {
  InkioCommentLocaleId,
  InkioCommentMessages,
  InkioCommentMessageOverrides,
  InkioTypedCommentMessageOverrides,
} from './i18n';
