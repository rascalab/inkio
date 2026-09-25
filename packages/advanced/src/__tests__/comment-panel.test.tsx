// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import { CommentPanel, type CommentThreadData } from '../comment/components/CommentPanel';

function orphanThread(resolved = false): CommentThreadData {
  return {
    id: 't-orphan',
    messages: [{ id: 'm1', author: 'Ada', text: 'orphan message', createdAt: new Date() }],
    resolved,
  };
}

function createMockEditor(onCommentResolve?: (id: string) => void) {
  const resolveComment = vi.fn();
  const editor = {
    extensionManager: {
      extensions: [{ name: 'comment', options: { onCommentResolve } }],
    },
    commands: { resolveComment },
    state: {
      schema: { marks: {} },
      doc: { descendants: () => {} },
    },
    view: { dispatch: vi.fn() },
    on: vi.fn(),
    off: vi.fn(),
    chain: () => ({
      focus: () => ({ setTextSelection: () => ({ run: () => true }) }),
    }),
  } as unknown as Editor;
  return { editor, resolveComment };
}

describe('CommentPanel single source of truth', () => {
  it('renders orphan threads (no document mark) so the panel matches the external store', () => {
    const { editor } = createMockEditor();
    const { container } = render(
      <CommentPanel
        editor={editor}
        threads={[orphanThread(false)]}
        onReply={vi.fn()}
        onResolve={vi.fn()}
        onDelete={vi.fn()}
        currentUser="Tester"
      />,
    );

    expect(screen.getAllByText('orphan message')).toHaveLength(2); // quote + message
    // Open count includes the orphan instead of showing an empty panel.
    expect(container.querySelector('.inkio-comment-badge')?.textContent).toBe('1');
  });

  it('filters orphans by their own resolved flag', () => {
    const { editor } = createMockEditor();
    render(
      <CommentPanel
        editor={editor}
        threads={[orphanThread(true)]}
        onReply={vi.fn()}
        onResolve={vi.fn()}
        onDelete={vi.fn()}
        currentUser="Tester"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /resolved/i }));
    expect(screen.getAllByText('orphan message')).toHaveLength(2); // quote + message
  });

  it('does not double-call resolve when panel and extension share the same handler', () => {
    const shared = vi.fn();
    const { editor, resolveComment } = createMockEditor(shared);
    const { container } = render(
      <CommentPanel
        editor={editor}
        threads={[orphanThread(false)]}
        onReply={vi.fn()}
        onResolve={shared}
        onDelete={vi.fn()}
        currentUser="Tester"
      />,
    );

    fireEvent.click(container.querySelector('.inkio-comment-action-btn.resolve')!);
    // Document command runs once; the shared consumer callback is skipped.
    expect(resolveComment).toHaveBeenCalledTimes(1);
    expect(shared).not.toHaveBeenCalled();
  });

  it('notifies both sides when panel and extension handlers differ', () => {
    const extensionResolve = vi.fn();
    const panelResolve = vi.fn();
    const { editor, resolveComment } = createMockEditor(extensionResolve);
    const { container } = render(
      <CommentPanel
        editor={editor}
        threads={[orphanThread(false)]}
        onReply={vi.fn()}
        onResolve={panelResolve}
        onDelete={vi.fn()}
        currentUser="Tester"
      />,
    );

    fireEvent.click(container.querySelector('.inkio-comment-action-btn.resolve')!);
    expect(resolveComment).toHaveBeenCalledWith('t-orphan');
    expect(panelResolve).toHaveBeenCalledWith('t-orphan');
  });

  it('renders override action icons when provided, text-only otherwise', () => {
    const { editor } = createMockEditor();
    const StubIcon = () => (
      <svg data-testid="resolve-override-icon" />
    );
    const base = {
      editor,
      threads: [orphanThread(false)],
      currentUser: 'Tester',
      onResolve: () => {},
    };
    const { container, rerender } = render(<CommentPanel {...base} />);
    expect(container.querySelector('[data-testid="resolve-override-icon"]')).toBeNull();

    rerender(<CommentPanel {...base} icons={{ resolve: StubIcon as never }} />);
    expect(container.querySelector('[data-testid="resolve-override-icon"]')).not.toBeNull();
  });

  it('ignores scroll-to for stale mark positions instead of throwing', () => {
    const markType = {};
    const staleNode = {
      isText: true,
      nodeSize: 5,
      text: 'stale',
      marks: [{ type: markType, attrs: { commentId: 't-stale', resolved: false } }],
    };
    const setTextSelection = vi.fn(() => ({ run: vi.fn(() => true) }));
    const domAtPos = vi.fn(() => {
      throw new Error('no node at stale position');
    });
    const editor = {
      extensionManager: { extensions: [{ name: 'comment', options: {} }] },
      commands: {},
      state: {
        schema: { marks: { comment: markType } },
        doc: {
          content: { size: 5 },
          descendants: (fn: (node: unknown, pos: number) => void) => {
            fn(staleNode, 9999);
          },
        },
      },
      view: { dispatch: vi.fn(), domAtPos },
      on: vi.fn(),
      off: vi.fn(),
      chain: () => ({ focus: () => ({ setTextSelection }) }),
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

  it('still selects when the position maps but has no DOM node', () => {
    const markType = {};
    const remappedNode = {
      isText: true,
      nodeSize: 3,
      text: 'old',
      marks: [{ type: markType, attrs: { commentId: 't-remap', resolved: false } }],
    };
    const run = vi.fn(() => true);
    const setTextSelection = vi.fn(() => ({ run }));
    const domAtPos = vi.fn(() => {
      throw new Error('remapped position has no DOM node');
    });
    const editor = {
      extensionManager: { extensions: [{ name: 'comment', options: {} }] },
      commands: {},
      state: {
        schema: { marks: { comment: markType } },
        doc: {
          content: { size: 20 },
          descendants: (fn: (node: unknown, pos: number) => void) => {
            fn(remappedNode, 2);
          },
        },
      },
      view: { dispatch: vi.fn(), domAtPos },
      on: vi.fn(),
      off: vi.fn(),
      chain: () => ({ focus: () => ({ setTextSelection }) }),
    } as unknown as Editor;
    const { container } = render(
      <CommentPanel editor={editor} threads={[]} currentUser="Tester" />,
    );

    const quote = container.querySelector('.inkio-comment-thread-quote');
    expect(quote).not.toBeNull();
    // Selection applies; only the best-effort scroll is skipped.
    expect(() => fireEvent.click(quote!)).not.toThrow();
    expect(setTextSelection).toHaveBeenCalledWith({ from: 2, to: 5 });
    expect(run).toHaveBeenCalled();
  });

  it('renders override action icons when provided, text-only otherwise', () => {
    const { editor } = createMockEditor();
    const StubIcon = () => (
      <svg data-testid="resolve-override-icon" />
    );
    const base = {
      editor,
      threads: [orphanThread(false)],
      currentUser: 'Tester',
      onResolve: () => {},
    };
    const { container, rerender } = render(<CommentPanel {...base} />);
    expect(container.querySelector('[data-testid="resolve-override-icon"]')).toBeNull();

    rerender(<CommentPanel {...base} icons={{ resolve: StubIcon as never }} />);
    expect(container.querySelector('[data-testid="resolve-override-icon"]')).not.toBeNull();
  });

  it('ignores scroll-to for stale mark positions instead of throwing', () => {
    const markType = {};
    const staleNode = {
      isText: true,
      nodeSize: 5,
      text: 'stale',
      marks: [{ type: markType, attrs: { commentId: 't-stale', resolved: false } }],
    };
    const setTextSelection = vi.fn(() => ({ run: vi.fn(() => true) }));
    const domAtPos = vi.fn(() => {
      throw new Error('no node at stale position');
    });
    const editor = {
      extensionManager: { extensions: [{ name: 'comment', options: {} }] },
      commands: {},
      state: {
        schema: { marks: { comment: markType } },
        doc: {
          content: { size: 5 },
          descendants: (fn: (node: unknown, pos: number) => void) => {
            fn(staleNode, 9999);
          },
        },
      },
      view: { dispatch: vi.fn(), domAtPos },
      on: vi.fn(),
      off: vi.fn(),
      chain: () => ({ focus: () => ({ setTextSelection }) }),
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

  it('still selects when the position maps but has no DOM node', () => {
    const markType = {};
    const remappedNode = {
      isText: true,
      nodeSize: 3,
      text: 'old',
      marks: [{ type: markType, attrs: { commentId: 't-remap', resolved: false } }],
    };
    const run = vi.fn(() => true);
    const setTextSelection = vi.fn(() => ({ run }));
    const domAtPos = vi.fn(() => {
      throw new Error('remapped position has no DOM node');
    });
    const editor = {
      extensionManager: { extensions: [{ name: 'comment', options: {} }] },
      commands: {},
      state: {
        schema: { marks: { comment: markType } },
        doc: {
          content: { size: 20 },
          descendants: (fn: (node: unknown, pos: number) => void) => {
            fn(remappedNode, 2);
          },
        },
      },
      view: { dispatch: vi.fn(), domAtPos },
      on: vi.fn(),
      off: vi.fn(),
      chain: () => ({ focus: () => ({ setTextSelection }) }),
    } as unknown as Editor;
    const { container } = render(
      <CommentPanel editor={editor} threads={[]} currentUser="Tester" />,
    );

    const quote = container.querySelector('.inkio-comment-thread-quote');
    expect(quote).not.toBeNull();
    // Selection applies; only the best-effort scroll is skipped.
    expect(() => fireEvent.click(quote!)).not.toThrow();
    expect(setTextSelection).toHaveBeenCalledWith({ from: 2, to: 5 });
    expect(run).toHaveBeenCalled();
  });

  it('renders a frozen view with no actions when callbacks are omitted', () => {
    const { editor } = createMockEditor();
    const { container } = render(
      <CommentPanel editor={editor} threads={[orphanThread(false)]} currentUser="Tester" />,
    );

    expect(screen.getAllByText('orphan message')).toHaveLength(2);
    expect(container.querySelector('.inkio-comment-reply-row')).toBeNull();
    expect(container.querySelector('.inkio-comment-thread-actions')).toBeNull();
  });
});
