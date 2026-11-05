import { act, render, waitFor } from '@testing-library/react';
import type { TiptapEditor } from '@inkio/core';
import { Editor } from '../components/Editor';

describe('@inkio/editor locale change', () => {
  it('gives every part of the editor the new locale and keeps what was written', async () => {
    const created: TiptapEditor[] = [];
    const onCreate = (editor: TiptapEditor) => created.push(editor);
    const { rerender } = render(<Editor content="<p>처음</p>" locale="ko" onCreate={onCreate} />);
    await waitFor(() => expect(created).toHaveLength(1));

    act(() => {
      created[0].commands.insertContent(' 쓴 글');
    });
    rerender(<Editor content="<p>처음</p>" locale="en" onCreate={onCreate} />);
    await waitFor(() => expect(created).toHaveLength(2));

    expect(created[1].getText()).toContain('쓴 글');
    expect((created[1].storage as unknown as { inkioUi: { locale: string } }).inkioUi.locale).toBe('en');
    const slash = created[1].extensionManager.extensions.find((extension) => extension.name === 'slashCommand');
    expect((slash?.options as { locale?: string }).locale).toBe('en');
  });

  it('keeps the same editor when the locale stays the same', async () => {
    const created: TiptapEditor[] = [];
    const onCreate = (editor: TiptapEditor) => created.push(editor);
    const { rerender } = render(<Editor content="<p>글</p>" locale="ko" onCreate={onCreate} />);
    await waitFor(() => expect(created).toHaveLength(1));

    rerender(<Editor content="<p>글</p>" locale="ko" onCreate={onCreate} />);
    await act(async () => {});

    expect(created).toHaveLength(1);
  });
});
