import { act, render } from '@testing-library/react';
import type { TiptapEditor } from '@inkio/core';
import { Editor } from '../components/Editor';

describe('@inkio/editor defaults', () => {
  it('does not show the persistent toolbar by default', () => {
    const { container } = render(<Editor content="<p>Hello</p>" />);

    expect(container.querySelector('.inkio-toolbar')).not.toBeInTheDocument();
  });

  it('forwards image cleanup failures to the editor onError callback', async () => {
    const error = new Error('Storage deletion failed');
    let created: (editor: TiptapEditor) => void = () => { throw new Error('Editor signal is missing'); };
    let reported: () => void = () => { throw new Error('Error signal is missing'); };
    const ready = new Promise<TiptapEditor>((resolve) => { created = resolve; });
    const failure = new Promise<void>((resolve) => { reported = resolve; });
    const onError = vi.fn(() => { reported(); });
    render(
      <Editor
        content={{ type: 'doc', content: [{ type: 'imageBlock', attrs: { src: '/image.png' } }] }}
        onCreate={created}
        onError={onError}
        imageBlock={{ onDelete: async () => { throw error; } }}
      />,
    );
    const editor = await ready;
    act(() => { editor.commands.setNodeSelection(0); });

    await act(async () => {
      editor.commands.deleteSelection();
      await failure;
    });

    expect(onError).toHaveBeenCalledWith(error, { source: 'imageBlock.cleanup', recoverable: true });
  });
});
