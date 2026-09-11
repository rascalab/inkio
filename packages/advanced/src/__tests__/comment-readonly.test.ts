import { describe, expect, it, vi } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { Comment } from '../comment/Comment';

function createEditor(editable: boolean) {
  return new Editor({
    element: document.createElement('div'),
    editable,
    extensions: [
      Document,
      Paragraph,
      Text,
      Comment.configure({
        onCommentSubmit: vi.fn(),
        getThread: () => null,
      }),
    ],
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'hello',
              marks: [{ type: 'comment', attrs: { commentId: 't1' } }],
            },
          ],
        },
      ],
    },
  });
}

/**
 * Read-only surfaces must not mutate comments: composer, setComment,
 * resolve/unresolve commands, and the Mod-Shift-M shortcut are all gated
 * on editor.isEditable.
 */
describe('Comment read-only gating', () => {
  it('blocks openCommentComposer and setComment when not editable', () => {
    const editor = createEditor(false);
    try {
      editor.commands.setTextSelection({ from: 1, to: 3 });
      expect(editor.commands.openCommentComposer()).toBe(false);
      expect(editor.commands.setComment({ commentId: 't2' })).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it('allows openCommentComposer and setComment when editable', () => {
    const editor = createEditor(true);
    try {
      editor.commands.setTextSelection({ from: 1, to: 3 });
      expect(editor.commands.openCommentComposer()).toBe(true);
      expect(editor.commands.setComment({ commentId: 't2' })).toBe(true);
    } finally {
      editor.destroy();
    }
  });

  it('blocks resolveComment/unresolveComment when not editable', () => {
    const editor = createEditor(false);
    try {
      expect(editor.commands.resolveComment('t1')).toBe(false);
      expect(editor.commands.unresolveComment('t1')).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it('Mod-Shift-M shortcut returns false when not editable', () => {
    const shortcuts = Comment.config.addKeyboardShortcuts!.call(
      { editor: { isEditable: false } } as never,
    );
    expect(shortcuts['Mod-Shift-m']({ editor: { isEditable: false } } as never)).toBe(false);
  });
});
