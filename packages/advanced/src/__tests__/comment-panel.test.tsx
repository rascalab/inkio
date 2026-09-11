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
});
