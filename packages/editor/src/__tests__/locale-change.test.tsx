import { act, render, waitFor } from '@testing-library/react';
import type { TiptapEditor } from '@inkio/core';
import { Editor } from '../components/Editor';

const placeholderOf = (editor: TiptapEditor) =>
  editor.view.dom.querySelector('[data-placeholder]')?.getAttribute('data-placeholder');

describe('@inkio/editor locale change', () => {
  it('changes what the editor shows in the same editor, keeping document, caret and undo', async () => {
    const created: TiptapEditor[] = [];
    const onCreate = (editor: TiptapEditor) => created.push(editor);
    const { rerender } = render(<Editor content="<p>처음</p>" locale="ko" onCreate={onCreate} />);
    await waitFor(() => expect(created).toHaveLength(1));
    const [editor] = created;

    act(() => {
      editor.commands.insertContentAt(editor.state.doc.content.size - 1, ' 쓴 글');
      editor.commands.setTextSelection(2);
    });
    rerender(<Editor content="<p>처음</p>" locale="en" onCreate={onCreate} />);
    await waitFor(() =>
      expect((editor.storage as unknown as { inkioUi: { locale: string } }).inkioUi.locale).toBe('en'));

    expect(created).toHaveLength(1);
    expect(editor.isDestroyed).toBe(false);
    expect(editor.getText()).toContain('쓴 글');
    expect(editor.state.selection.from).toBe(2);
    act(() => {
      editor.commands.undo();
    });
    expect(editor.getText()).not.toContain('쓴 글');
  });

  it('updates the placeholder of an open editor', async () => {
    const created: TiptapEditor[] = [];
    const onCreate = (editor: TiptapEditor) => created.push(editor);
    const { rerender } = render(<Editor content="" locale="ko" onCreate={onCreate} />);
    await waitFor(() => expect(created).toHaveLength(1));
    const before = placeholderOf(created[0]);

    rerender(<Editor content="" locale="en" onCreate={onCreate} />);
    await waitFor(() => expect(placeholderOf(created[0])).not.toBe(before));
  });

  it('updates a placeholder the app gives per locale, without rebuilding extensions', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const created: TiptapEditor[] = [];
    const onCreate = (editor: TiptapEditor) => created.push(editor);
    const { rerender } = render(<Editor content="" locale="ko" placeholder="글을 쓰세요" onCreate={onCreate} />);
    await waitFor(() => expect(placeholderOf(created[0])).toBe('글을 쓰세요'));

    rerender(<Editor content="" locale="en" placeholder="Write here" onCreate={onCreate} />);
    await waitFor(() => expect(placeholderOf(created[0])).toBe('Write here'));

    expect(created).toHaveLength(1);
    expect(warn.mock.calls.flat().join(' ')).not.toContain('recreated between renders');
    warn.mockRestore();
  });

  it('dispatches nothing when the locale stays the same', async () => {
    const created: TiptapEditor[] = [];
    const onCreate = (editor: TiptapEditor) => created.push(editor);
    const { rerender } = render(<Editor content="<p>글</p>" locale="ko" onCreate={onCreate} />);
    await waitFor(() => expect(created).toHaveLength(1));
    await act(async () => {});
    const onTransaction = vi.fn();
    created[0].on('transaction', onTransaction);

    rerender(<Editor content="<p>글</p>" locale="ko" onCreate={onCreate} />);
    await act(async () => {});

    expect(onTransaction).not.toHaveBeenCalled();
  });
});
