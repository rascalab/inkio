import { act, render, waitFor } from '@testing-library/react';
import type { TiptapEditor } from '@inkio/core';
import { Editor } from '../components/Editor';

describe('@inkio/editor defaults', () => {
  it('does not show the persistent toolbar by default', () => {
    const { container } = render(<Editor content="<p>Hello</p>" />);

    expect(container.querySelector('.inkio-toolbar')).not.toBeInTheDocument();
  });

  it('does not restore disabled preset nodes when forwarding to core', async () => {
    const onCreate = vi.fn();
    render(<Editor table={false} onCreate={editor => onCreate(editor.schema.nodes.table)} />);
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(undefined));
  });

  it('forwards image cleanup failures to the editor onError callback', async () => {
    const error = new Error('Storage deletion failed');
    let created: (editor: TiptapEditor) => void = () => { throw new Error('Editor signal is missing'); };
    let reported: () => void = () => { throw new Error('Error signal is missing'); };
    const ready = new Promise<TiptapEditor>((resolve) => { created = resolve; });
    const failure = new Promise<void>((resolve) => { reported = resolve; });
    const onError = vi.fn(() => { reported(); });
    let started!: (signal: AbortSignal) => void;
    let finish: (src: string) => void = () => { throw new Error('Upload has not started'); };
    const uploading = new Promise<AbortSignal>((resolve) => { started = resolve; });
    const upload = new Promise<string>((resolve) => { finish = resolve; });
    const bytes = Uint8Array.from(atob(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=',
    ), (char) => char.charCodeAt(0));
    render(
      <Editor
        content="<p></p>"
        onImageUpload={(_file, { signal }) => { started(signal); return upload; }}
        onCreate={created}
        onError={onError}
        imageBlock={{ cleanup: 'immediate', onDelete: async () => { throw error; } }}
      />,
    );
    const editor = await ready;
    act(() => { editor.commands.uploadImageBlock([new File([bytes], 'pixel.png', { type: 'image/png' })]); });
    const signal = await uploading;
    expect(signal.aborted).toBe(false);

    await act(async () => {
      editor.commands.setContent('<p>A different document</p>');
      expect(signal.aborted).toBe(true);
      finish('/unused-upload.png');
      await failure;
    });

    expect(onError).toHaveBeenCalledWith(error, { source: 'imageBlock.cleanup', recoverable: true });
  });
});
