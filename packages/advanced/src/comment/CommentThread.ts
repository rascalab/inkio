import { Mark, mergeAttributes } from '@tiptap/core';
import {
  commentComposerPluginKey,
  normalizeCommentId,
  readCommentThread,
  type CommentOptions,
} from './comment-shared';
import { canCommentOnRange, updateCommentResolution } from './utils';
import { createCommentThreadPopoverPlugin } from './comment-thread-popover-plugin';

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

export const CommentThread = Mark.create<CommentOptions>({
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
        parseHTML: (element) => normalizeCommentId(element.getAttribute('data-comment-id')),
        renderHTML: (attributes) => {
          const id = normalizeCommentId(attributes.commentId);
          return id ? { 'data-comment-id': id } : {};
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

  addCommands() {
    return {
      setComment:
        (attrs) =>
          ({ commands }) => {
            // Read-only surfaces must not mutate the document.
            if (!this.editor.isEditable) {
              return false;
            }
            const commentId = normalizeCommentId(attrs?.commentId);

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
            if (!this.editor.isEditable) {
              return false;
            }
            return commands.unsetMark(this.name);
          },
      resolveComment:
        (commentId) =>
          ({ tr, dispatch }) => {
            const id = normalizeCommentId(commentId);
            if (!this.editor.isEditable || !id || !updateCommentResolution(tr, id, true, !!dispatch)) {
              return false;
            }
            const { getThread, onCommentResolve } = this.options;
            if (dispatch && onCommentResolve && readCommentThread(getThread, id)) onCommentResolve(id);
            return true;
          },
      unresolveComment:
        (commentId) =>
          ({ tr, dispatch }) => {
            const id = normalizeCommentId(commentId);
            if (!this.editor.isEditable || !id || !updateCommentResolution(tr, id, false, !!dispatch)) {
              return false;
            }
            const { getThread, onCommentUnresolve } = this.options;
            if (dispatch && onCommentUnresolve && readCommentThread(getThread, id)) onCommentUnresolve(id);
            return true;
          },
      openCommentComposer:
        () =>
          ({ state, dispatch }) => {
            if (!this.editor.isEditable) {
              return false;
            }
            const { from, to } = state.selection;

            if (!canCommentOnRange(state.doc, from, to)) {
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
    return this.options.threadPopoverEnabled !== false && this.options.getThread
      ? [createCommentThreadPopoverPlugin(this.editor, this.options)]
      : [];
  },
});

/**
 * The comment mark for an editor with no comment config, such as a read-only
 * page: the document must still load, so the mark exists, but it has no commands,
 * threads or highlight.
 */
export const CommentDisplay = CommentThread.extend<CommentOptions & { displayOnly: true }>({
  addOptions() {
    return { ...(this.parent?.() as CommentOptions), displayOnly: true };
  },
  addCommands() {
    return {};
  },
  addKeyboardShortcuts() {
    return {};
  },
  addProseMirrorPlugins() {
    return [];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0];
  },
});
