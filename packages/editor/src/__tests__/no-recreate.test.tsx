import { act, render, waitFor } from '@testing-library/react';
import { useState } from 'react';
import type { TiptapEditor } from '@inkio/core';
import { Markdown } from '@inkio/core/markdown';
import { Editor } from '../components/Editor';

/**
 * Regression test for the setOptions storm: a parent that re-renders with
 * new-but-identical inline option literals must not destroy/recreate the
 * tiptap instance (extensions stay referentially stable via useStableOptions).
 */
describe('@inkio/editor instance stability', () => {
  it('keeps a single tiptap instance across inline-literal re-renders', async () => {
    const instances: TiptapEditor[] = [];
    const onCreate = (editor: TiptapEditor) => {
      instances.push(editor);
    };
    const { rerender } = render(
      <Editor
        content="<p>hi</p>"
        onCreate={onCreate}
        extensions={[Markdown]}
        imageBlock={{}}
        mentionItems={() => []}
      />,
    );
    await waitFor(() => {
      expect(instances).toHaveLength(1);
    });

    // Inline closures must not rebuild the extension set either: the
    // wrapper forwards to the newest implementation under one identity.
    rerender(
      <Editor
        content="<p>hi</p>"
        onCreate={onCreate}
        extensions={[Markdown]}
        imageBlock={{}}
        mentionItems={() => []}
      />,
    );
    rerender(
      <Editor
        content="<p>hi</p>"
        onCreate={onCreate}
        extensions={{ items: [Markdown] }}
        imageBlock={{}}
        mentionItems={() => []}
      />,
    );

    expect(instances).toHaveLength(1);
    expect(instances[0]!.isDestroyed).toBe(false);
  });

  it('keeps the preset instance when callbacks update host state with inline options', async () => {
    const created = vi.fn();
    function Host() {
      const [preview, setPreview] = useState('');
      return <>
        <output>{preview}</output>
        <Editor content="<p>Initial</p>" extensions={[Markdown]} ui={{ bordered: true }}
          mentionItems={({ query }) => [{ id: query, label: query }]}
          onCreate={(editor) => { created(editor); setPreview(editor.markdown); }}
          onChange={(editor) => setPreview(editor.markdown)} />
      </>;
    }
    const { container } = render(<Host />);
    await waitFor(() => expect(container.querySelector('output')).toHaveTextContent('Initial'));
    const editor = created.mock.calls[0]![0];
    await act(async () => { editor.markdown = 'Changed'; });
    await waitFor(() => expect(container.querySelector('output')).toHaveTextContent('Changed'));
    expect(created).toHaveBeenCalledOnce();
    expect(editor.isDestroyed).toBe(false);
  });

  it('replaces the callback instance and keeps unsaved edits when Markdown is installed or removed', async () => {
    const created = vi.fn();
    const changed = vi.fn();
    const { rerender } = render(<Editor content="<p>Seed</p>" onCreate={created} />);
    await waitFor(() => expect(created).toHaveBeenCalledOnce());
    const first: TiptapEditor = created.mock.calls[0]![0];
    act(() => { first.commands.setContent('<p>Edited</p>'); });
    rerender(<Editor content="<p>Old seed</p>" extensions={[Markdown]}
      onCreate={(editor) => { created(editor, editor.markdown); }}
      onChange={(editor) => changed(editor.markdown)} />);
    await waitFor(() => expect(created).toHaveBeenLastCalledWith(expect.anything(), 'Edited'));
    const second = created.mock.calls[1]![0];
    await act(async () => { second.markdown = 'Assigned'; });
    expect(changed).toHaveBeenLastCalledWith('Assigned');
    rerender(<Editor content="" onCreate={created} />);
    await waitFor(() => expect(created).toHaveBeenCalledTimes(3));
    const third = created.mock.calls[2]![0];
    expect(third.text).toBe('Assigned');
    expect(third).not.toHaveProperty('markdown');
  });
});
