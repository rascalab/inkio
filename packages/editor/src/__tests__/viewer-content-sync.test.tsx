import { act, render } from '@testing-library/react';
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

    expect(editor.getText()).toBe('second');
    expect(container.querySelector('.inkio-content')?.textContent).toBe('second');
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
