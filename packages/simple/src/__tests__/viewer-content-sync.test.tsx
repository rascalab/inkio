import { act, render, waitFor } from '@testing-library/react';
import type { TiptapEditor } from '@inkio/core';
import { Markdown } from '@inkio/core/markdown';
import { Viewer } from '../components/Viewer';

describe('@inkio/simple Viewer content', () => {
  it('shows the new document when content changes after mount', async () => {
    let resolveCreated!: (editor: TiptapEditor) => void;
    const created = new Promise<TiptapEditor>((resolve) => {
      resolveCreated = resolve;
    });
    const onCreate = (editor: TiptapEditor) => resolveCreated(editor);
    const { rerender } = render(<Viewer content="<p>first</p>" onCreate={onCreate} />);
    let editor!: TiptapEditor;
    await act(async () => {
      editor = await created;
    });
    expect(editor.getText()).toBe('first');

    rerender(<Viewer content="<p>second</p>" onCreate={onCreate} />);

    await waitFor(() => expect(editor.getText()).toBe('second'));
  });

  it('creates the replacement viewer with its current content and matching extensions', async () => {
    const initial = vi.fn();
    const markdown = vi.fn();
    const plain = vi.fn();
    const { rerender, container } = render(<Viewer content="<p>First</p>" onCreate={initial} />);
    await waitFor(() => expect(initial).toHaveBeenCalledOnce());
    rerender(<Viewer content="<p>Second</p>" extensions={[Markdown]}
      onCreate={(editor) => markdown(editor, editor.markdown)} />);
    await waitFor(() => expect(markdown).toHaveBeenCalledWith(expect.anything(), 'Second'));
    const editor = markdown.mock.calls[0]![0];
    rerender(<Viewer content="<p>Third</p>" extensions={{ items: [Markdown] }}
      onCreate={(instance) => markdown(instance, instance.markdown)} />);
    await waitFor(() => expect(editor.markdown).toBe('Third'));
    expect(markdown).toHaveBeenCalledOnce();
    rerender(<Viewer content="<p>Third</p>" extensions={[]} onCreate={plain} />);
    await waitFor(() => expect(plain).toHaveBeenCalledOnce());
    expect(plain.mock.calls[0]![0]).not.toHaveProperty('markdown');
    expect(plain.mock.calls[0]![0].text).toBe('Third');
    expect(container.querySelector('.inkio-content')?.textContent).toBe('Third');
  });
});
