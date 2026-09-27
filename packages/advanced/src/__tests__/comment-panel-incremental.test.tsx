// @vitest-environment jsdom
import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { Slice, Fragment } from '@tiptap/pm/model';
import { Comment } from '../comment/Comment';
import { CommentPanel, stepMayAffectComments } from '../comment/components/CommentPanel';

function createEditor() {
  return new Editor({
    element: document.createElement('div'),
    extensions: [
      Document,
      Paragraph,
      Text,
      Comment.configure({ onCommentSubmit: vi.fn(), getThread: () => null }),
    ],
    content: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'intro text' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'see ' },
            { type: 'text', text: 'this', marks: [{ type: 'comment', attrs: { commentId: 't1' } }] },
            { type: 'text', text: ' here' },
          ],
        },
      ],
    },
  });
}

function affects(editor: Editor, tr: ReturnType<Editor['state']['tr']['insertText']>) {
  const markType = editor.state.schema.marks.comment;
  return tr.steps.some((step, i) => stepMayAffectComments(tr.docs[i], step, markType));
}

describe('stepMayAffectComments', () => {
  it('ignores typing away from comment marks', () => {
    const editor = createEditor();
    try {
      expect(affects(editor, editor.state.tr.insertText('x', 2))).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it('flags edits inside or next to commented text, mark changes and marked pastes', () => {
    const editor = createEditor();
    try {
      // "this" starts at 12 + 4 ("see ") = 17.
      expect(affects(editor, editor.state.tr.insertText('x', 18))).toBe(true);
      expect(affects(editor, editor.state.tr.insertText('x', 17))).toBe(true);
      const markType = editor.state.schema.marks.comment;
      expect(
        affects(editor, editor.state.tr.addMark(2, 5, markType.create({ commentId: 't2' }))),
      ).toBe(true);
      expect(affects(editor, editor.state.tr.removeMark(17, 21, markType))).toBe(true);
      const marked = editor.state.schema.text('pasted', [markType.create({ commentId: 't3' })]);
      expect(
        affects(editor, editor.state.tr.replace(2, 2, new Slice(Fragment.from(marked), 0, 0))),
      ).toBe(true);
    } finally {
      editor.destroy();
    }
  });
});

describe('CommentPanel with a live editor', () => {
  it('selects the current range after typing shifted the comment', async () => {
    const editor = createEditor();
    try {
      const { container } = render(
        <CommentPanel editor={editor as never} threads={[]} currentUser="Tester" />,
      );
      await act(async () => {
        editor.commands.insertContentAt(2, 'shift ');
      });
      const quote = container.querySelector('.inkio-comment-thread-quote');
      expect(quote).not.toBeNull();
      fireEvent.click(quote!);
      const { from, to } = editor.state.selection;
      expect(editor.state.doc.textBetween(from, to)).toBe('this');
    } finally {
      editor.destroy();
    }
  });

  it('refreshes the panel when commented text changes', async () => {
    const editor = createEditor();
    try {
      const { container } = render(
        <CommentPanel editor={editor as never} threads={[]} currentUser="Tester" />,
      );
      await act(async () => {
        editor.view.dispatch(editor.state.tr.insertText('X', 19));
      });
      expect(container.querySelector('.inkio-comment-thread-quote')?.textContent).toContain('thXis');
    } finally {
      editor.destroy();
    }
  });
});
