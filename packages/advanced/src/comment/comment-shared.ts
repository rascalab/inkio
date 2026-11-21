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

/** Host thread data is separate from document marks; a mark is not evidence of access. */
export function isKnownCommentThread(value: unknown, expectedId?: string): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const { id, resolved, messages } = value as Record<string, unknown>;
  if (typeof id !== 'string' || normalizeCommentId(id) !== id ||
      (expectedId !== undefined && id !== expectedId) ||
      typeof resolved !== 'boolean' || !Array.isArray(messages)) {
    return false;
  }
  if (messages.length === 0) return true;
  const ids = new Set<string>();
  for (const message of messages) {
    if (typeof message !== 'object' || message === null) return false;
    const { id: messageId, author, text, createdAt } = message as Record<string, unknown>;
    if (typeof messageId !== 'string' || !messageId.trim() || ids.has(messageId) ||
        typeof author !== 'string' || typeof text !== 'string' ||
        !(createdAt instanceof Date || typeof createdAt === 'string' || typeof createdAt === 'number')) {
      return false;
    }
    ids.add(messageId);
  }
  return true;
}

export function readCommentThread(
  getThread: CommentOptions['getThread'],
  id: string,
): CommentThreadData | null {
  try {
    const thread = getThread?.(id);
    return thread && isKnownCommentThread(thread, id) ? thread : null;
  } catch {
    // An unavailable host lookup must not turn into a writable thread.
    return null;
  }
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
  /**
   * Retrieve only threads belonging to this document that the active user may
   * see. Existing-thread mutations are gated on this lookup; the host must
   * still authenticate and authorize every operation against its own store.
   */
  getThread?: (threadId: string) => CommentThreadData | null;
  /** Custom ID generator; must return a unique ID in the host's thread store. */
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
  /** Document-scoped lookup; the host must authorize every mutation independently. */
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
    getThread: config.getComments,
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
