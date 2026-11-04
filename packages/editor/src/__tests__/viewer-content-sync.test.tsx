import { act, render, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import type { TiptapEditor } from '@inkio/core';
import { Viewer } from '../components/Viewer';

async function mountViewer(content: string | object) {
  let resolveCreated!: (editor: TiptapEditor) => void;
  const created = new Promise<TiptapEditor>((resolve) => {
    resolveCreated = resolve;
  });
  const onCreate = (editor: TiptapEditor) => resolveCreated(editor);
  const view = render(<Viewer content={content as string} onCreate={onCreate} />);
  let editor!: TiptapEditor;
  await act(async () => {
    editor = await created;
  });
  return { ...view, editor, onCreate };
}

const doc = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

describe('@inkio/editor Viewer content', () => {
  it('shows the new document when content changes after mount', async () => {
    const { editor, rerender, onCreate, container } = await mountViewer('<p>first</p>');
    expect(editor.getText()).toBe('first');

    rerender(<Viewer content="<p>second</p>" onCreate={onCreate} />);

    await waitFor(() => expect(editor.getText()).toBe('second'));
    expect(container.querySelector('.inkio-content')?.textContent).toBe('second');
  });

  it('shows a document with a comment, hashtag or bookmark when the app configured none', async () => {
    const paragraph = (...content: unknown[]) => ({ type: 'paragraph', content });
    const { editor } = await mountViewer({
      type: 'doc',
      content: [
        paragraph({ type: 'text', text: '댓글 단 글', marks: [{ type: 'comment', attrs: { commentId: 'c1' } }] }),
        paragraph({ type: 'hashTag', attrs: { id: 'a', label: 'a' } }),
        { type: 'bookmark', attrs: { url: 'https://example.com', title: '북마크' } },
      ],
    } as unknown as string);
    expect(editor.getText()).toContain('댓글 단 글');
    expect(editor.getJSON().content?.map((node) => node.type)).toEqual(['paragraph', 'paragraph', 'bookmark']);
  });

  it('keeps the rest of a document when part of it is unknown', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { editor } = await mountViewer({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '남는 글', marks: [{ type: 'gone' }] }] }],
    } as unknown as string);
    expect(editor.getText()).toBe('남는 글');
    editor.commands.setContent({ type: 'doc', content: [{ type: 'gone', content: [{ type: 'paragraph', content: [{ type: 'text', text: '다음 글' }] }] }] });
    expect(editor.getText()).toBe('다음 글');
    warn.mockRestore();
  });

  it('does not reset the document when the parent passes an equal value again', async () => {
    const { editor, rerender, onCreate } = await mountViewer(doc('same') as unknown as string);
    const updates = vi.fn();
    editor.on('update', updates);

    rerender(<Viewer content={doc('same') as unknown as string} onCreate={onCreate} />);

    expect(updates).not.toHaveBeenCalled();
    expect(editor.getText()).toBe('same');
  });
});
