import { Mark, mergeAttributes } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import {
  commentComposerPluginKey,
  normalizeCommentId,
  type CommentOptions,
} from './comment-shared';
import { createCommentComposerPlugin } from './comment-composer-plugin';
import { createCommentThreadPopoverPlugin } from './comment-thread-popover-plugin';

export * from './comment-shared';

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
        // Read-only surfaces must not open the composer.
        if (!this.editor.isEditable) {
          return false;
        }
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
          ({ state, dispatch }) => {
            if (!this.editor.isEditable) {
              return false;
            }
            const trimmedId = normalizeCommentId(commentId);

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
              this.options.onCommentResolve?.(trimmedId);
            }

            return true;
          },
      unresolveComment:
        (commentId) =>
          ({ state, dispatch }) => {
            if (!this.editor.isEditable) {
              return false;
            }
            const trimmedId = normalizeCommentId(commentId);
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
            if (!this.editor.isEditable) {
              return false;
            }
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

/**
 * The comment mark for an editor with no comment config, such as a read-only
 * page: the document must still load, so the mark exists, but it has no commands,
 * threads or highlight.
 */
export const CommentDisplay = Comment.extend<CommentOptions & { displayOnly: true }>({
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
