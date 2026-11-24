import { Component } from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { getExtensions, type ImageEditorComponentProps, type TiptapEditor } from '@inkio/core';
import { Editor } from '../components/Editor';

describe('@inkio/simple defaults', () => {
  it('shows the persistent toolbar by default', async () => {
    const { container } = render(<Editor content="<p>Hello</p>" />);

    await waitFor(() => {
      expect(container.querySelector('.inkio-toolbar')).toBeInTheDocument();
    });
  });

  it('forwards an exact schema to core without restoring excluded nodes', async () => {
    const onCreate = vi.fn();
    render(<Editor
      extensions={{ items: getExtensions({ heading: false }), replace: true }}
      onCreate={editor => onCreate(editor.schema.nodes.heading)}
    />);
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(undefined));
  });

  it('opens a class-based image editor supplied by the host', async () => {
    class CustomImageEditor extends Component<ImageEditorComponentProps> {
      render() {
        return <div role="dialog" aria-label="Custom image editor">{this.props.imageSrc}</div>;
      }
    }
    const { findByRole } = render(<Editor
      content={{ type: 'doc', content: [{ type: 'imageBlock', attrs: { src: '/photo.jpg' } }] }}
      imageBlock={{ imageEditor: CustomImageEditor }}
    />);
    fireEvent.click(await findByRole('button', { name: 'Edit image' }));
    expect(await findByRole('dialog', { name: 'Custom image editor' })).toHaveTextContent('/photo.jpg');
  });

  it.each(['editor signal', 'read-only'])('cancels the preset edit upload on %s', async (cause) => {
    const source = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
    const controller = new AbortController();
    let editor!: TiptapEditor;
    let started!: (signal: AbortSignal) => void;
    const uploading = new Promise<AbortSignal>(resolve => { started = resolve; });
    const { findByRole } = render(<Editor
      content='<img src="/original.png">'
      onCreate={created => { editor = created; }}
      imageBlock={{ imageEditor: ({ onSave }: ImageEditorComponentProps) => (
        <button onClick={() => { void onSave(source, controller.signal); }}>Save changes</button>
      ) }}
      onImageUpload={(_file, { signal }) => {
        started(signal);
        return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
      }}
    />);
    fireEvent.click(await findByRole('button', { name: 'Edit image' }));
    fireEvent.click(await findByRole('button', { name: 'Save changes' }));
    const signal = await uploading;
    expect(signal.aborted).toBe(false);
    await act(async () => {
      if (cause === 'editor signal') controller.abort();
      else editor.setEditable(false, false);
    });
    expect(signal.aborted).toBe(true);
  });
});
