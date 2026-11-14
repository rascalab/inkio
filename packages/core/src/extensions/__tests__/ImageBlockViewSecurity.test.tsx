// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { NodeViewProps } from '@tiptap/react';
import { describe, expect, it, vi } from 'vitest';
import { ImageBlockView } from '../ImageBlockView';
import type { ImageBlockOptions, ImageEditorComponentProps } from '../ImageBlock';

let capturedSave: ImageEditorComponentProps['onSave'] | null = null;
let capturedTheme: ImageEditorComponentProps['theme'];
let capturedLocale: ImageEditorComponentProps['locale'];

function StubImageEditor(props: ImageEditorComponentProps) {
  capturedSave = props.onSave;
  capturedTheme = props.theme;
  capturedLocale = props.locale;
  return <div data-testid="image-editor-stub" />;
}

type ViewProps = NodeViewProps & { updateAttributes: ReturnType<typeof vi.fn> };

function createProps(src: string, options: Partial<ImageBlockOptions> = {}): ViewProps {
  capturedSave = null;
  return {
    node: {
      attrs: { caption: '', width: '100%', src, alt: 'a', align: 'center' },
    },
    updateAttributes: vi.fn(),
    selected: false,
    editor: {
      isEditable: true,
      on: vi.fn(),
      off: vi.fn(),
    },
    extension: { options: { imageEditor: StubImageEditor, ...options } },
  } as unknown as ViewProps;
}

/**
 * The image editor component is a trust boundary (it may be third-party):
 * its output must pass isSafeUrl before reaching the document, and an
 * already-persisted unsafe src must never reach the DOM.
 */
describe('ImageBlockView image editor theme', () => {
  it('opens the image editor with the theme of its own editor', () => {
    const page = document.createElement('div');
    page.className = 'inkio';
    const editorRoot = document.createElement('div');
    editorRoot.className = 'inkio dark';
    const editorDom = document.createElement('div');
    editorRoot.appendChild(editorDom);
    document.body.append(page, editorRoot);
    try {
      const props = createProps('https://example.com/a.png');
      (props.editor as unknown as { view: { dom: Element } }).view = { dom: editorDom };
      render(<ImageBlockView {...props} />);
      fireEvent.click(screen.getByTestId('inkio-image-block-edit'));
      // Not the first `.inkio` on the page: the editor that opened it.
      expect(capturedTheme).toBe('dark');
    } finally {
      page.remove();
      editorRoot.remove();
    }
  });

  it('opens the image editor in the locale of its editor', () => {
    const props = createProps('https://example.com/a.png');
    (props.editor as unknown as { storage: unknown }).storage = { inkioUi: { locale: 'ko' } };
    render(<ImageBlockView {...props} />);
    fireEvent.click(screen.getByTestId('inkio-image-block-edit'));
    expect(capturedLocale).toBe('ko');
  });
});

describe('ImageBlockView src safety', () => {
  it('renders a safe src as an <img>', () => {
    const props = createProps('https://example.com/a.png');
    const { container } = render(<ImageBlockView {...props} />);
    const img = container.querySelector('img.inkio-image-block-img');
    expect(img?.getAttribute('src')).toBe('https://example.com/a.png');
  });

  it('renders a placeholder instead of an <img> for a persisted unsafe src', () => {
    const props = createProps('javascript:alert(1)');
    const { container } = render(<ImageBlockView {...props} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.inkio-image-block-placeholder')).not.toBeNull();
  });

  it('persists editor output that passes validation', () => {
    const props = createProps('https://example.com/a.png');
    render(<ImageBlockView {...props} />);
    fireEvent.click(screen.getByTestId('inkio-image-block-edit'));
    expect(capturedSave).not.toBeNull();
    act(() => {
      capturedSave?.('https://example.com/edited.png');
    });
    expect(props.updateAttributes).toHaveBeenCalledWith({ src: 'https://example.com/edited.png' });
  });

  it('refuses editor output that fails validation', () => {
    const props = createProps('https://example.com/a.png');
    render(<ImageBlockView {...props} />);
    fireEvent.click(screen.getByTestId('inkio-image-block-edit'));
    expect(capturedSave).not.toBeNull();
    act(() => {
      capturedSave?.('javascript:alert(1)');
    });
    expect(props.updateAttributes).not.toHaveBeenCalled();
  });
});

describe('ImageBlockView edited image upload', () => {
  const editedImage = 'data:image/png;base64,iVBORw0KGgo=';

  it('uploads the edited bytes and persists the resolved URL without changing the image metadata', async () => {
    const onUpload = vi.fn(async (_file: File) => ({ src: '/files/edited.png', title: 'Edited' }));
    const resolveFileUrl = vi.fn(async () => 'https://example.com/edited.png');
    const props = createProps('https://example.com/a.png', { onUpload, resolveFileUrl });
    render(<ImageBlockView {...props} />);
    fireEvent.click(screen.getByTestId('inkio-image-block-edit'));

    await act(async () => { await capturedSave?.(editedImage); });

    const file = onUpload.mock.calls[0]?.[0];
    expect(file).toBeInstanceOf(File);
    expect(file).toMatchObject({ type: 'image/png', size: 8 });
    expect(resolveFileUrl).toHaveBeenCalledWith('/files/edited.png');
    expect(props.updateAttributes).toHaveBeenCalledWith({
      src: 'https://example.com/edited.png',
      title: 'Edited',
    });
  });

  it('uses a different file name for edits of different image blocks', async () => {
    const onUpload = vi.fn(async (_file: File) => 'https://example.com/edited.png');
    const first = render(<ImageBlockView {...createProps('https://example.com/a.png', { onUpload })} />);
    fireEvent.click(first.getByTestId('inkio-image-block-edit'));
    const saveFirst = capturedSave;
    const second = render(<ImageBlockView {...createProps('https://example.com/b.png', { onUpload })} />);
    fireEvent.click(within(second.container).getByTestId('inkio-image-block-edit'));
    const saveSecond = capturedSave;

    await act(async () => { await saveFirst?.(editedImage); await saveSecond?.(editedImage); });

    const files = onUpload.mock.calls.map(([file]) => file);
    expect(files).toHaveLength(2);
    expect(files[0].name).not.toBe(files[1].name);
    expect(files.every((file) => file.name.endsWith('.png'))).toBe(true);
  });

  it('keeps the image editor mounted until the upload succeeds', async () => {
    let finishUpload: (url: string) => void = () => { throw new Error('Upload has not started'); };
    let started: () => void = () => { throw new Error('Upload signal is missing'); };
    const uploadStarted = new Promise<void>((resolve) => { started = resolve; });
    const upload = new Promise<string>((resolve) => { finishUpload = resolve; });
    const props = createProps('https://example.com/a.png', {
      onUpload: () => { started(); return upload; },
    });
    render(<ImageBlockView {...props} />);
    fireEvent.click(screen.getByTestId('inkio-image-block-edit'));
    let saving: void | Promise<void>;

    await act(async () => { saving = capturedSave?.(editedImage); await uploadStarted; });

    expect(screen.queryByTestId('image-editor-stub')).not.toBeNull();
    expect(props.updateAttributes).not.toHaveBeenCalled();
    await act(async () => { finishUpload('https://example.com/edited.png'); await saving; });
    expect(screen.queryByTestId('image-editor-stub')).toBeNull();
  });

  it('keeps the original image until the upload completes and ignores duplicate saves', async () => {
    let finishUpload: (url: string) => void = () => { throw new Error('Upload has not started'); };
    const upload = new Promise<string>((resolve) => { finishUpload = resolve; });
    const onUpload = vi.fn((_file: File) => upload);
    const props = createProps('https://example.com/a.png', { onUpload });
    render(<ImageBlockView {...props} />);
    fireEvent.click(screen.getByTestId('inkio-image-block-edit'));

    await act(async () => {
      const saving = capturedSave?.(editedImage);
      capturedSave?.(editedImage);
      expect(props.updateAttributes).not.toHaveBeenCalled();
      finishUpload('https://example.com/edited.png');
      await saving;
    });

    expect(onUpload).toHaveBeenCalledTimes(1);
    expect(props.updateAttributes).toHaveBeenCalledWith({ src: 'https://example.com/edited.png' });
  });

  it('keeps the original image and reports an upload failure', async () => {
    const error = new Error('Upload failed');
    const onUploadError = vi.fn();
    const props = createProps('https://example.com/a.png', {
      onUpload: async () => { throw error; },
      onUploadError,
    });
    render(<ImageBlockView {...props} />);
    fireEvent.click(screen.getByTestId('inkio-image-block-edit'));

    await act(async () => { await expect(capturedSave?.(editedImage)).rejects.toBe(error); });

    expect(props.updateAttributes).not.toHaveBeenCalled();
    expect(onUploadError).toHaveBeenCalledWith(error);
    expect(screen.queryByTestId('image-editor-stub')).not.toBeNull();
  });

  it('rejects an unsafe resolved upload URL through the generic error callback', async () => {
    const onError = vi.fn();
    const props = createProps('https://example.com/a.png', {
      onUpload: async () => '/files/edited.png',
      resolveFileUrl: async () => 'javascript:alert(1)',
      onError,
    });
    render(<ImageBlockView {...props} />);
    fireEvent.click(screen.getByTestId('inkio-image-block-edit'));

    await act(async () => { await expect(capturedSave?.(editedImage)).rejects.toBeInstanceOf(Error); });

    expect(props.updateAttributes).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.any(Error), {
      source: 'imageBlock.upload',
      recoverable: true,
    });
  });

  it('applies the upload file size limit to edited images', async () => {
    const onUpload = vi.fn(async (_file: File) => 'https://example.com/edited.png');
    const onUploadError = vi.fn();
    const props = createProps('https://example.com/a.png', { onUpload, maxFileSize: 1, onUploadError });
    render(<ImageBlockView {...props} />);
    fireEvent.click(screen.getByTestId('inkio-image-block-edit'));

    await act(async () => { await expect(capturedSave?.(editedImage)).rejects.toBeInstanceOf(Error); });

    expect(onUpload).not.toHaveBeenCalled();
    expect(props.updateAttributes).not.toHaveBeenCalled();
    expect(onUploadError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('does not update a deleted image when its upload completes', async () => {
    let finishUpload: (url: string) => void = () => { throw new Error('Upload has not started'); };
    const upload = new Promise<string>((resolve) => { finishUpload = resolve; });
    const props = createProps('https://example.com/a.png', { onUpload: () => upload });
    const { unmount } = render(<ImageBlockView {...props} />);
    fireEvent.click(screen.getByTestId('inkio-image-block-edit'));

    await act(async () => {
      const saving = capturedSave?.(editedImage);
      unmount();
      finishUpload('https://example.com/edited.png');
      await saving;
    });

    expect(props.updateAttributes).not.toHaveBeenCalled();
  });

  it('keeps data URL storage when no upload callback is configured', async () => {
    const props = createProps('https://example.com/a.png');
    render(<ImageBlockView {...props} />);
    fireEvent.click(screen.getByTestId('inkio-image-block-edit'));

    await act(async () => { await capturedSave?.(editedImage); });

    expect(props.updateAttributes).toHaveBeenCalledWith({ src: editedImage });
  });
});
