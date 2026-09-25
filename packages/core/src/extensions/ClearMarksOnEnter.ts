import { Extension } from '@tiptap/core';

/**
 * Clears all inline marks (bold, italic, etc.) on Enter, GitHub Markdown
 * style: marks never carry over to the new line.
 */
export const ClearMarksOnEnter = Extension.create({
  name: 'clearMarksOnEnter',

  addStorage() {
    return {
      timeoutId: null as ReturnType<typeof setTimeout> | null,
    };
  },

  onDestroy() {
    if (this.storage.timeoutId !== null) {
      clearTimeout(this.storage.timeoutId);
      this.storage.timeoutId = null;
    }
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { state } = editor;
        if (!state || !state.selection) {
          return false;
        }

        const { $from } = state.selection;
        if (!$from) {
          return false;
        }

        // Only the marks lookup is guarded: a torn-down selection can throw
        // here, and a failed lookup must fall through to plain Enter.
        let marks: readonly unknown[] | undefined;
        try {
          marks = $from.marks?.() as readonly unknown[] | undefined;
        } catch {
          return false;
        }

        const hasStoredMarks = !!state.storedMarks && state.storedMarks.length > 0;
        const hasCurrentMarks = !!marks && marks.length > 0;

        if (hasStoredMarks || hasCurrentMarks) {
          // Clear after Enter lands to avoid a double transaction.
          // Cancel the previous timer so rapid Enters neither leak timers
          // nor run unsetAllMarks twice.
          if (this.storage.timeoutId !== null) {
            clearTimeout(this.storage.timeoutId);
          }
          this.storage.timeoutId = setTimeout(() => {
            this.storage.timeoutId = null;
            if (!editor.isDestroyed) {
              editor.commands.unsetAllMarks();
            }
          }, 0);
        }

        // Always return false so the default Enter behavior (newline) runs.
        return false;
      },
    };
  },
});
