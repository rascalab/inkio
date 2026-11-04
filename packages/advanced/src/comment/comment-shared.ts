import { PluginKey } from '@tiptap/pm/state';
import { createId } from '@inkio/core';
import type {
  InkioLocaleInput,
  InkioMessageOverrides,
} from '@inkio/core';
import type { InkioIconRegistry } from '@inkio/core/icons';
import type { InkioCommentMessageOverrides } from './i18n';

export interface CommentMessage {
  id: string;
  author: string;
  text: string;
  createdAt: Date;
}

export interface CommentThreadData {
  id: string;
  messages: CommentMessage[];
  resolved: boolean;
}

// ─── Plugin Keys ────────────────────────────────────────────

export const commentComposerPluginKey = new PluginKey('commentComposer');
export const commentThreadPopoverPluginKey = new PluginKey('commentThreadPopover');

// ─── Helpers ────────────────────────────────────────────────

export function defaultGenerateId(): string {
  return createId();
}

/**
 * Single id boundary for every comment command: non-string or blank input
 * normalizes to null (command returns false) instead of throwing on trim.
 */
export function normalizeCommentId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

// ─── Options ────────────────────────────────────────────────

export interface CommentOptions {
  HTMLAttributes: Record<string, any>;
  /** Called when user submits a new comment via the composer */
  onCommentSubmit?: (threadId: string, text: string, selection: string) => void;
  /** Called when user replies to a thread via the popover */
  onCommentReply?: (threadId: string, text: string) => void;
  /** Called when user resolves a thread */
  onCommentResolve?: (threadId: string) => void;
  /** Called when user unresolves a thread */
  onCommentUnresolve?: (threadId: string) => void;
  /** Called when user deletes a thread */
  onCommentDelete?: (threadId: string) => void;
  /** Retrieve thread data for the popover display */
  getThread?: (threadId: string) => CommentThreadData | null;
  /** Custom ID generator for new comment threads */
  generateId?: () => string;
  /** Display name for the current user */
  currentUser?: string;
  /** Enable the auto-managed comment composer. Default: true */
  composerEnabled?: boolean;
  /** Enable the auto-managed thread popover on mark click. Default: true */
  threadPopoverEnabled?: boolean;
  /** Locale for UI strings */
  locale?: InkioLocaleInput;
  /** Message overrides */
  messages?: InkioCommentMessageOverrides | InkioMessageOverrides;
  /** Icon overrides */
  icons?: Partial<InkioIconRegistry>;
}

// ─── Public API ─────────────────────────────────────────────

/** Public-facing comment thread data (renamed from CommentThreadData) */
export interface CommentData {
  id: string;
  messages: CommentMessage[];
  resolved: boolean;
}

/** Public-facing comment configuration — simplified naming */
export interface CommentConfig {
  onSubmit?: (commentId: string, text: string, selection: string) => void;
  onReply?: (commentId: string, text: string) => void;
  onResolve?: (commentId: string) => void;
  onUnresolve?: (commentId: string) => void;
  onDelete?: (commentId: string) => void;
  getComments?: (commentId: string) => CommentData | null;
  generateId?: () => string;
}

/** Maps public CommentConfig to internal CommentOptions */
export function toCommentOptions(config: CommentConfig): Partial<CommentOptions> {
  return {
    onCommentSubmit: config.onSubmit,
    onCommentReply: config.onReply,
    onCommentResolve: config.onResolve,
    onCommentUnresolve: config.onUnresolve,
    onCommentDelete: config.onDelete,
    getThread: config.getComments as CommentOptions['getThread'],
    generateId: config.generateId,
  };
}

// ─── Cross-surface sync ────────────────────────────────────

/**
 * Fired whenever externally managed thread data changes (e.g. the
 * `CommentPanel` `threads` prop). The open thread popover listens for this
 * and re-reads `getThread` so it never shows stale messages. The event name
 * is part of the internal contract between `CommentPanel` and the popover
 * plugin — use {@link notifyCommentThreadsChanged} to emit it.
 */
export const COMMENT_THREADS_CHANGED_EVENT = 'inkio:comment-threads-changed';

/** Notify open comment surfaces (popover) that thread data changed. */
export function notifyCommentThreadsChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(COMMENT_THREADS_CHANGED_EVENT));
  }
}
