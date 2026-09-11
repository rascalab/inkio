export { Comment, toCommentOptions, notifyCommentThreadsChanged, COMMENT_THREADS_CHANGED_EVENT } from './Comment';
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
