// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { Comment } from '../comment/Comment';
import { CommentPanel, type CommentThreadData } from '../comment/components/CommentPanel';

function thread(id = 't-1', resolved = false): CommentThreadData {
  return {
    id,
    messages: [{ id: 'm1', author: 'Ada', text: 'thread message', createdAt: new Date() }],
    resolved,
  };
}

const markType = {
  isInSet(marks: { type: unknown }[]) {
    return marks.find((mark) => mark.type === this);
  },
};
const schema = { marks: { comment: markType } };

/** An editor whose document holds `markedIds`, one commented text node each. */
function createMockEditor(onCommentResolve?: (id: string) => void, markedIds: string[] = ['t-1']) {
  const resolveComment = vi.fn(() => true);
  const editor = {
    isEditable: true,
    extensionManager: {
      extensions: [{
        name: 'comment',
        options: { onCommentResolve, getThread: (id: string) => thread(id) },
      }],
    },
    commands: { resolveComment },
    state: {
      schema,
      doc: {
        type: { schema },
        descendants: (visit: (node: unknown, pos: number) => void) => {
          markedIds.forEach((commentId, index) => {
            visit({
              isText: true,
              nodeSize: 5,
              text: 'quote',
              marks: [{ type: markType, attrs: { commentId, resolved: false } }],
            }, index * 10);
          });
        },
      },
    },
    view: { dispatch: vi.fn() },
    on: vi.fn(),
    off: vi.fn(),
  } as unknown as Editor;
  return { editor, resolveComment };
}

describe('CommentPanel single source of truth', () => {
  it('does not list a thread whose text is not in the document', () => {
    const { editor } = createMockEditor(undefined, ['t-1']);
    const { container } = render(
      <CommentPanel
        editor={editor}
        threads={[thread('t-1'), thread('t-deleted')]}
        onReply={vi.fn()}
        onResolve={vi.fn()}
        onDelete={vi.fn()}
        currentUser="Tester"
      />,
    );

    expect(container.querySelectorAll('.inkio-comment-thread')).toHaveLength(1);
    expect(container.querySelector('.inkio-comment-badge')?.textContent).toBe('1');
  });

  it('files a thread by its own resolved flag', () => {
    const { editor } = createMockEditor();
    render(
      <CommentPanel
        editor={editor}
        threads={[thread('t-1', true)]}
        onReply={vi.fn()}
        onResolve={vi.fn()}
        onDelete={vi.fn()}
        currentUser="Tester"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /resolved/i }));
    expect(screen.getAllByText('thread message')).toHaveLength(1);
  });

  it.each(['inherit', 'override', 'same handler'] as const)('runs one callback per action and updates marks: %s', (mode) => {
    const registered = { onReply: vi.fn(), onResolve: vi.fn(), onDelete: vi.fn() };
    const panel = mode === 'override' ? { onReply: vi.fn(), onResolve: vi.fn(), onDelete: vi.fn() } : registered;
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [Document, Paragraph, Text, Comment.configure({
        getThread: (id) => thread(id),
        onCommentReply: registered.onReply,
        onCommentResolve: registered.onResolve,
        onCommentDelete: registered.onDelete,
      })],
      content: '<p><span data-comment-id="t-1">quote</span></p>',
    });
    const view = render(<CommentPanel editor={editor} threads={[thread()]} {...(mode === 'inherit' ? {} : panel)} />);
    try {
      const input = view.getByRole('textbox');
      fireEvent.change(input, { target: { value: ' Reply ' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(panel.onReply.mock.calls).toEqual([['t-1', 'Reply']]);
      fireEvent.click(view.container.querySelector('.inkio-comment-action-btn.resolve')!);
      expect(panel.onResolve.mock.calls).toEqual([['t-1']]);
      expect(editor.getHTML()).toContain('data-comment-resolved="true"');
      fireEvent.click(view.container.querySelector('.inkio-comment-action-btn.delete')!);
      expect(panel.onDelete.mock.calls).toEqual([['t-1']]);
      expect(editor.getHTML()).not.toContain('data-comment-id');
      if (mode === 'override') {
        for (const handler of Object.values(registered)) expect(handler).not.toHaveBeenCalled();
      }
    } finally {
      view.unmount();
      editor.destroy();
    }
  });

  it('allows hiding inherited actions individually and rechecks the lookup on click', () => {
    const resolve = vi.fn();
    const { editor } = createMockEditor(resolve);
    const options = editor.extensionManager.extensions[0]!.options;
    options.onCommentReply = vi.fn();
    options.onCommentDelete = vi.fn();
    const view = render(<CommentPanel editor={editor} threads={[thread()]} onDelete={false} onReply={false} />);
    expect(view.queryByRole('textbox')).toBeNull();
    expect(view.container.querySelector('.delete')).toBeNull();
    options.getThread = () => null;
    fireEvent.click(view.container.querySelector('.inkio-comment-action-btn.resolve')!);
    expect(resolve).not.toHaveBeenCalled();
    view.rerender(<CommentPanel editor={editor} threads={[thread()]} />);
    expect(view.queryByRole('textbox')).toBeNull();
    expect(view.container.querySelector('.inkio-comment-thread-actions')).toBeNull();

    // Even an otherwise valid panel row cannot authorize a registered handler by itself.
    delete options.getThread;
    view.rerender(<CommentPanel editor={editor} threads={[thread()]} />);
    expect(view.queryByRole('textbox')).toBeNull();
    expect(view.container.querySelector('.inkio-comment-thread-actions')).toBeNull();
  });

  it('renders override action icons when provided, text-only otherwise', () => {
    const { editor } = createMockEditor();
    const StubIcon = () => (
      <svg data-testid="resolve-override-icon" />
    );
    const base = {
      editor,
      threads: [thread()],
      currentUser: 'Tester',
      onResolve: () => {},
    };
    const { container, rerender } = render(<CommentPanel {...base} />);
    expect(container.querySelector('[data-testid="resolve-override-icon"]')).toBeNull();

    rerender(<CommentPanel {...base} icons={{ resolve: StubIcon as never }} />);
    expect(container.querySelector('[data-testid="resolve-override-icon"]')).not.toBeNull();
  });

  it('ignores scroll-to for stale mark positions instead of throwing', () => {
    const staleNode = {
      isText: true,
      nodeSize: 5,
      text: 'stale',
      marks: [{ type: markType, attrs: { commentId: 't-stale', resolved: false } }],
    };
    const setTextSelection = vi.fn();
    const domAtPos = vi.fn(() => {
      throw new Error('no node at stale position');
    });
    const editor = {
      extensionManager: { extensions: [{ name: 'comment', options: {} }] },
      commands: { setTextSelection },
      state: {
        schema,
        doc: {
          type: { schema },
          content: { size: 5 },
          descendants: (fn: (node: unknown, pos: number) => void) => {
            fn(staleNode, 9999);
          },
        },
      },
      view: { dispatch: vi.fn(), domAtPos },
      on: vi.fn(),
      off: vi.fn(),
    } as unknown as Editor;
    const { container } = render(
      <CommentPanel editor={editor} threads={[]} currentUser="Tester" />,
    );

    const quote = container.querySelector('.inkio-comment-thread-quote');
    expect(quote).not.toBeNull();
    // Out-of-range target returns before touching the editor.
    expect(() => fireEvent.click(quote!)).not.toThrow();
    expect(setTextSelection).not.toHaveBeenCalled();
    expect(domAtPos).not.toHaveBeenCalled();
  });

  it('selects the quote even without a scroll target and lets a reply take focus immediately', () => {
    const mount = document.body.appendChild(document.createElement('div'));
    const editor = new Editor({
      element: mount,
      extensions: [Document, Paragraph, Text, Comment],
      content: '<p>a<span data-comment-id="t-1">old</span></p>',
      editorProps: { handleScrollToSelection: () => true },
    });
    const domAtPos = vi.spyOn(editor.view, 'domAtPos').mockImplementation(() => {
      throw new Error('remapped position has no DOM node');
    });
    const panel = render(<CommentPanel editor={editor} threads={[thread()]} onReply={vi.fn()} />);
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
    try {
      const reply = panel.container.querySelector<HTMLInputElement>('.inkio-comment-reply-input')!;
      act(() => reply.focus());
      fireEvent.click(panel.container.querySelector('.inkio-comment-thread-quote')!);
      expect(domAtPos).toHaveBeenCalledWith(2);
      expect(editor.state.selection).toMatchObject({ from: 2, to: 5 });
      expect(document.activeElement).toBe(editor.view.dom);
      expect(window.getSelection()?.toString()).toBe('old');

      act(() => reply.focus());
      act(() => { vi.advanceTimersToNextFrame(); });
      expect(document.activeElement).toBe(reply);
    } finally {
      vi.useRealTimers();
      panel.unmount();
      editor.destroy();
      mount.remove();
    }
  });

  it('renders a frozen view with no actions when callbacks are omitted', () => {
    const { editor } = createMockEditor();
    const { container } = render(
      <CommentPanel editor={editor} threads={[thread()]} currentUser="Tester" />,
    );

    expect(screen.getAllByText('thread message')).toHaveLength(1);
    expect(container.querySelector('.inkio-comment-reply-row')).toBeNull();
    expect(container.querySelector('.inkio-comment-thread-actions')).toBeNull();
  });

  it('shows the document quote without mutations when host data is invalid or unavailable', () => {
    const { editor } = createMockEditor(undefined, ['t-1', 't-missing']);
    const { container } = render(
      <CommentPanel
        editor={editor}
        threads={[{ id: 't-1', resolved: false, messages: null } as never]}
        onReply={vi.fn()}
        onResolve={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(container.querySelectorAll('.inkio-comment-thread-quote')).toHaveLength(2);
    expect(screen.queryByPlaceholderText(/reply/i)).toBeNull();
    expect(container.querySelector('.inkio-comment-thread-actions')).toBeNull();
  });

  it('keeps panel actions hidden in a read-only editor even if callbacks are provided', () => {
    const { editor } = createMockEditor();
    render(
      <CommentPanel
        editor={{ ...editor, isEditable: false } as Editor}
        threads={[thread()]}
        onReply={vi.fn()}
        onResolve={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText('thread message')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/reply/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
  });
});
