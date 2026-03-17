export { Comment, toCommentOptions } from './Comment';
export type { CommentOptions, CommentConfig, CommentData } from './Comment';
export {
  commentComposerPluginKey,
  commentThreadPopoverPluginKey,
} from './Comment';
export {
  CommentPanel,
  CommentComposer,
  CommentThreadPopover,
} from './components';
export type {
  CommentPanelProps,
  CommentThreadData,
  CommentMessage,
  CommentComposerProps,
  CommentThreadPopoverProps,
} from './components';
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
