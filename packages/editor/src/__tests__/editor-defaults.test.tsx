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
    let started: () => void = () => { throw new Error('Upload signal is missing'); };
    let finish: (src: string) => void = () => { throw new Error('Upload has not started'); };
    const uploading = new Promise<void>((resolve) => { started = resolve; });
    const upload = new Promise<string>((resolve) => { finish = resolve; });
    const onUpload = () => { started(); return upload; };
    const bytes = Uint8Array.from(atob(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=',
    ), (char) => char.charCodeAt(0));
    render(
      <Editor
        content="<p></p>"
        onImageUpload={onUpload}
        onCreate={created}
        onError={onError}
        imageBlock={{ cleanup: 'immediate', onDelete: async () => { throw error; } }}
      />,
    );
    const editor = await ready;
    act(() => { editor.commands.uploadImageBlock([new File([bytes], 'pixel.png', { type: 'image/png' })]); });
    await uploading;

    await act(async () => {
      editor.commands.setContent('<p>A different document</p>');
      finish('/unused-upload.png');
      await failure;
    });

    expect(onError).toHaveBeenCalledWith(error, { source: 'imageBlock.cleanup', recoverable: true });
  });
});
