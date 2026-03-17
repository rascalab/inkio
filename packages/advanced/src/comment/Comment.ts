import { Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { CommentThreadData, CommentMessage } from './components/CommentPanel';
import type {
  InkioLocaleInput,
  InkioMessageOverrides,
} from '@inkio/core';
import type { InkioIconRegistry } from '@inkio/core/icons';
import type { InkioCommentMessageOverrides } from './i18n';
import { createCommentComposerPlugin } from './comment-composer-plugin';
import { createCommentThreadPopoverPlugin } from './comment-thread-popover-plugin';

// ─── Plugin Keys ────────────────────────────────────────────

export const commentComposerPluginKey = new PluginKey('commentComposer');
export const commentThreadPopoverPluginKey = new PluginKey('commentThreadPopover');

// ─── Helpers ────────────────────────────────────────────────

export function defaultGenerateId(): string {
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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

// ─── Command Augmentation ───────────────────────────────────

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    comment: {
      setComment: (attrs: { commentId: string }) => ReturnType;
      unsetComment: () => ReturnType;
      resolveComment: (commentId: string) => ReturnType;
      unresolveComment: (commentId: string) => ReturnType;
      openCommentComposer: () => ReturnType;
    };
  }
}

// ─── Extension ──────────────────────────────────────────────

export const Comment = Mark.create<CommentOptions>({
  name: 'comment',

  addOptions() {
    return {
      HTMLAttributes: {},
      onCommentSubmit: undefined,
      onCommentReply: undefined,
      onCommentResolve: undefined,
      onCommentUnresolve: undefined,
      onCommentDelete: undefined,
      getThread: undefined,
      generateId: undefined,
      currentUser: undefined,
      composerEnabled: true,
      threadPopoverEnabled: true,
      locale: undefined,
      messages: undefined,
      icons: undefined,
    };
  },

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-comment-id'),
        renderHTML: (attributes) => {
          if (!attributes.commentId) {
            return {};
          }

          return { 'data-comment-id': attributes.commentId };
        },
      },
      resolved: {
        default: false,
        parseHTML: (element) => {
          const value = element.getAttribute('data-comment-resolved');
          return value === '' || value === 'true' || value === '1';
        },
        renderHTML: (attributes) =>
          attributes.resolved ? { 'data-comment-resolved': 'true' } : {},
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-comment-id]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const isResolved = Boolean(HTMLAttributes['data-comment-resolved']);

    return [
      'span',
      mergeAttributes(
        {
          class: isResolved ? 'inkio-comment-resolved' : 'inkio-comment',
        },
        this.options.HTMLAttributes,
        HTMLAttributes
      ),
      0,
    ];
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-m': () => {
        const { state, view } = this.editor;
        const { from, to } = state.selection;

        if (from === to) {
          return false;
        }

        // Try the auto-managed composer command first
        const opened = this.editor.commands.openCommentComposer();
        if (opened) {
          return true;
        }

        // Legacy fallback: dispatch event for consumer-managed composer
        const start = view.coordsAtPos(from);
        const end = view.coordsAtPos(to);
        const left = Math.min(start.left, end.left);
        const right = Math.max(start.right, end.right);
        const top = Math.min(start.top, end.top);
        const bottom = Math.max(start.bottom, end.bottom);

        window.dispatchEvent(
          new CustomEvent('inkio:comment-request', {
            detail: {
              from,
              to,
              rect: {
                top,
                left,
                right,
                bottom,
                width: Math.max(1, right - left),
                height: Math.max(1, bottom - top),
              },
            },
          }),
        );

        return true;
      },
    };
  },

  addCommands() {
    return {
      setComment:
        (attrs) =>
          ({ commands }) => {
            const commentId = attrs.commentId?.trim();

            if (!commentId) {
              return false;
            }

            return commands.setMark(this.name, {
              commentId,
              resolved: false,
            });
          },
      unsetComment:
        () =>
          ({ commands }) => {
            return commands.unsetMark(this.name);
          },
      resolveComment:
        (commentId) =>
          ({ state, dispatch }) => {
            const trimmedId = commentId.trim();

            if (!trimmedId) {
              return false;
            }

            const markType = state.schema.marks[this.name];

            if (!markType) {
              return false;
            }

            const ranges: Array<{ from: number; to: number; attrs: Record<string, any> }> = [];

            state.doc.descendants((node, pos) => {
              if (!node.isText || node.nodeSize <= 0) {
                return;
              }

              const mark = node.marks.find(
                (candidate) => candidate.type === markType && candidate.attrs.commentId === trimmedId
              );

              if (!mark || mark.attrs.resolved) {
                return;
              }

              ranges.push({
                from: pos,
                to: pos + node.nodeSize,
                attrs: mark.attrs as Record<string, any>,
              });
            });

            if (ranges.length === 0) {
              return false;
            }

            const transaction = state.tr;

            ranges.forEach(({ from, to, attrs }) => {
              transaction.removeMark(from, to, markType);
              transaction.addMark(
                from,
                to,
                markType.create({
                  ...attrs,
                  resolved: true,
                })
              );
            });

            if (dispatch) {
              dispatch(transaction);
            }

            return true;
          },
      unresolveComment:
        (commentId) =>
          ({ state, dispatch }) => {
            const trimmedId = commentId.trim();
            if (!trimmedId) return false;

            const markType = state.schema.marks[this.name];
            if (!markType) return false;

            const ranges: Array<{ from: number; to: number; attrs: Record<string, any> }> = [];

            state.doc.descendants((node, pos) => {
              if (!node.isText || node.nodeSize <= 0) return;

              const mark = node.marks.find(
                (candidate) => candidate.type === markType && candidate.attrs.commentId === trimmedId
              );

              if (!mark || !mark.attrs.resolved) return;

              ranges.push({
                from: pos,
                to: pos + node.nodeSize,
                attrs: mark.attrs as Record<string, any>,
              });
            });

            if (ranges.length === 0) return false;

            const transaction = state.tr;

            ranges.forEach(({ from, to, attrs }) => {
              transaction.removeMark(from, to, markType);
              transaction.addMark(
                from,
                to,
                markType.create({
                  ...attrs,
                  resolved: false,
                })
              );
            });

            if (dispatch) {
              dispatch(transaction);
              this.options.onCommentUnresolve?.(trimmedId);
            }

            return true;
          },
      openCommentComposer:
        () =>
          ({ state, dispatch }) => {
            const { from, to } = state.selection;

            if (from === to) {
              return false;
            }

            // Only works when the composer plugin is registered
            const pluginState = commentComposerPluginKey.getState(state);
            if (pluginState === undefined) {
              return false;
            }

            if (dispatch) {
              dispatch(
                state.tr.setMeta(commentComposerPluginKey, {
                  active: true,
                  from,
                  to,
                })
              );
            }

            return true;
          },
    };
  },

  addProseMirrorPlugins() {
    const plugins: Plugin[] = [];

    // Auto-managed composer (when onCommentSubmit is provided)
    if (this.options.composerEnabled !== false && this.options.onCommentSubmit) {
      plugins.push(createCommentComposerPlugin(this.editor, this.options));
    }

    // Auto-managed thread popover (when getThread is provided)
    if (this.options.threadPopoverEnabled !== false && this.options.getThread) {
      plugins.push(createCommentThreadPopoverPlugin(this.editor, this.options));
    }

    return plugins;
  },
});
