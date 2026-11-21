import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { Editor, Node } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { Comment } from '../comment/Comment';

const PlainBlock = Node.create({
  name: 'plainBlock',
  group: 'block',
  content: 'text*',
  marks: '',
  renderHTML: () => ['pre', 0],
});

function createEditor(editable: boolean, onCommentSubmit = vi.fn()) {
  return new Editor({
    element: document.createElement('div'),
    editable,
    extensions: [
      Document,
      Paragraph,
      Text,
      PlainBlock,
      Comment.configure({
        onCommentSubmit,
        locale: 'en',
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

  it('does not open the composer for text in a block that disallows marks', () => {
    const editor = createEditor(true);
    try {
      editor.commands.setContent({
        type: 'doc',
        content: [{ type: 'plainBlock', content: [{ type: 'text', text: 'plain code' }] }],
      });
      editor.commands.setTextSelection({ from: 1, to: 6 });
      expect(editor.commands.openCommentComposer()).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it('does not persist a thread if its pending selection becomes unmarkable', async () => {
    const onCommentSubmit = vi.fn();
    const editor = createEditor(true, onCommentSubmit);
    vi.spyOn(editor.view, 'coordsAtPos').mockReturnValue({ left: 0, right: 1, top: 0, bottom: 1 });
    try {
      act(() => {
        editor.commands.setTextSelection({ from: 2, to: 4 });
        expect(editor.commands.openCommentComposer()).toBe(true);
      });
      const input = await screen.findByPlaceholderText('Add a comment…');
      fireEvent.change(input, { target: { value: 'Review this' } });
      act(() => {
        editor.view.dispatch(editor.state.tr.setBlockType(2, 4, editor.schema.nodes.plainBlock));
      });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onCommentSubmit).not.toHaveBeenCalled();
    } finally {
      await act(async () => { editor.destroy(); });
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
