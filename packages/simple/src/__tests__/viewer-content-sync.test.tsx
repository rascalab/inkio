import { act, render } from '@testing-library/react';
import type { TiptapEditor } from '@inkio/core';
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

    expect(editor.getText()).toBe('second');
  });
});
