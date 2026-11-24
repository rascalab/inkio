import { CommentThread } from './CommentThread';
import { createCommentComposerPlugin } from './comment-composer-plugin';
import { canCommentOnRange } from './utils';

export * from './comment-shared';
export { CommentDisplay } from './CommentThread';

export const Comment = CommentThread.extend({
  addKeyboardShortcuts() {
    return {
      'Mod-Shift-m': () => {
        // Read-only surfaces must not open the composer.
        if (!this.editor.isEditable) {
          return false;
        }
        const { state, view } = this.editor;
        const { from, to } = state.selection;

        if (typeof window === 'undefined' || !canCommentOnRange(state.doc, from, to)) {
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

  addProseMirrorPlugins() {
    const threads = this.parent?.() ?? [];
    return this.options.composerEnabled !== false && this.options.onCommentSubmit
      ? [createCommentComposerPlugin(this.editor, this.options), ...threads]
      : threads;
  },
});
