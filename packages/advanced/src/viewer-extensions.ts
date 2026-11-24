import type { Extensions } from '@tiptap/core';
import { CommentDisplay, CommentThread } from './comment/CommentThread';
import type { CommentConfig } from './comment/comment-shared';
import { Bookmark } from './extensions/Bookmark';
import { hashTagConfig, mentionConfig } from './extensions/trigger-config';
import { createTriggerNode } from './extensions/trigger-node';
import { WikiLinkDisplay } from './extensions/wiki-link-display';

const ViewerMention = createTriggerNode(mentionConfig);
const ViewerHashTag = createTriggerNode(hashTagConfig);

/** Advanced additions to the core live viewer: document nodes, clicks and threads, without editing UI. */
export function getAdvancedViewerExtensions(comment?: Pick<CommentConfig, 'getComments'>): Extensions {
  const mark = comment ? CommentThread.configure({
    getThread: comment.getComments,
  }) : CommentDisplay;
  return [ViewerMention, ViewerHashTag, WikiLinkDisplay, Bookmark, mark];
}
