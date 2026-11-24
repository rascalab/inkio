// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { NodeViewProps } from '@tiptap/react';
import { describe, expect, it, vi } from 'vitest';
import { ImageBlockView } from '../ImageBlockView';
import type { ImageBlockOptions, ImageEditorComponentProps, ImageUploadContext } from '../ImageBlock';
import { pngBase64 } from './image-fixtures';

let capturedSave: ImageEditorComponentProps['onSave'] | null = null;
let capturedBlobSave: ImageEditorComponentProps['onSaveBlob'];
let capturedClose: ImageEditorComponentProps['onClose'];
let capturedTheme: ImageEditorComponentProps['theme'];
let capturedLocale: ImageEditorComponentProps['locale'];

function StubImageEditor(props: ImageEditorComponentProps) {
  capturedSave = props.onSave;
  capturedBlobSave = props.onSaveBlob;
  capturedClose = props.onClose;
  capturedTheme = props.theme;
  capturedLocale = props.locale;
  return <div data-testid="image-editor-stub" />;
}

type ViewProps = NodeViewProps & { updateAttributes: ReturnType<typeof vi.fn> };

function createProps(src: string, options: Partial<ImageBlockOptions> = {}): ViewProps {
  capturedSave = null;
  capturedBlobSave = undefined;
  const node = { type: { name: 'imageBlock' }, attrs: { caption: '', width: '100%', src, alt: 'a', align: 'center' } };
  return {
    node,
    getPos: () => 0,
    updateAttributes: vi.fn(),
    selected: false,
    editor: {
      isEditable: true,
      state: { doc: { nodeAt: () => node, descendants: vi.fn() } },
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
  const editedImage = `data:image/png;base64,${pngBase64}`;

  it.each(['data URL', 'Blob'])('uploads edited bytes from a %s and persists the resolved URL', async (representation) => {
    const onUpload = vi.fn(async (_file: File, _context: ImageUploadContext) => ({ src: '/files/edited.png', title: 'Edited' }));
    const resolveFileUrl = vi.fn(async () => 'https://example.com/edited.png');
    const props = createProps('https://example.com/a.png', { onUpload, resolveFileUrl });
    render(<ImageBlockView {...props} />);
    fireEvent.click(screen.getByTestId('inkio-image-block-edit'));

    await act(async () => {
      if (representation === 'Blob') {
        const bytes = Uint8Array.from(atob(pngBase64), (char) => char.charCodeAt(0));
        expect(capturedBlobSave).toBeDefined();
        await capturedBlobSave!(new Blob([bytes], { type: 'image/png' }));
      } else {
        await capturedSave?.(editedImage);
      }
    });

    const file = onUpload.mock.calls[0]?.[0];
    expect(file).toBeInstanceOf(File);
    expect(file).toMatchObject({ type: 'image/png', size: atob(pngBase64).length });
    const uploaded = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file!);
    });
    expect(Array.from(new Uint8Array(uploaded))).toEqual(
      Array.from(atob(pngBase64), (char) => char.charCodeAt(0)),
    );
    const context = onUpload.mock.calls[0][1];
    expect(context.signal.aborted).toBe(false);
    expect(resolveFileUrl).toHaveBeenCalledWith('/files/edited.png', context);
    expect(props.updateAttributes).toHaveBeenCalledWith({
      src: 'https://example.com/edited.png',
      title: 'Edited',
    });
  });

  it.each(['data URL', 'Blob'])('cancels a %s save without applying a late upload or swallowing a newer save', async (format) => {
    let finish!: (src: string) => void;
    const first = new Promise<string>((resolve) => { finish = resolve; });
    const onUpload = vi.fn<NonNullable<ImageBlockOptions['onUpload']>>()
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce('/new.png');
    const onDelete = vi.fn();
    const props = createProps('/original.png', { onUpload, cleanup: 'immediate', onDelete });
    render(<ImageBlockView {...props} />);
    fireEvent.click(screen.getByTestId('inkio-image-block-edit'));
    const controller = new AbortController();
    let stale: void | Promise<void>;
    await act(async () => {
      stale = format === 'Blob'
        ? capturedBlobSave!(new Blob([Uint8Array.from(atob(pngBase64), c => c.charCodeAt(0))], { type: 'image/png' }), undefined, controller.signal)
        : capturedSave!(editedImage, controller.signal);
      await vi.waitFor(() => expect(onUpload).toHaveBeenCalledOnce());
      controller.abort();
    });
    expect(onUpload.mock.calls[0][1].signal.aborted).toBe(true);
    await act(async () => { await capturedSave!(editedImage); });
    await act(async () => { finish('/abandoned.png'); await stale; });
    expect(onDelete).toHaveBeenCalledExactlyOnceWith('/abandoned.png');
    expect(props.updateAttributes).toHaveBeenCalledExactlyOnceWith({ src: '/new.png' });
  });

  it.each(['close', 'source change'])('aborts a legacy editor save on %s before it settles', async (cause) => {
    const onUpload = vi.fn((_file: File, { signal }: ImageUploadContext) => new Promise<string>((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }));
    const onUploadError = vi.fn();
    const props = createProps('/original.png', { onUpload, onUploadError });
    const { rerender } = render(<ImageBlockView {...props} />);
    fireEvent.click(screen.getByTestId('inkio-image-block-edit'));
    let saving: void | Promise<void>;
    await act(async () => {
      saving = capturedSave!(editedImage);
      await vi.waitFor(() => expect(onUpload).toHaveBeenCalledOnce());
    });
    if (cause === 'close') act(() => capturedClose());
    else rerender(<ImageBlockView {...props} node={createProps('/replacement.png').node} />);
    expect(onUpload.mock.calls[0][1].signal.aborted).toBe(true);
    await act(async () => { await saving; });
    expect(onUploadError).not.toHaveBeenCalled();
    expect(props.updateAttributes).not.toHaveBeenCalled();
  });

  it('ignores already-aborted and closed callbacks, including direct URL writes', async () => {
    const onUpload = vi.fn(async () => '/uploaded.png');
    const props = createProps('/original.png', { onUpload });
    render(<ImageBlockView {...props} />);
    fireEvent.click(screen.getByTestId('inkio-image-block-edit'));
    const stale = capturedSave!;
    const controller = new AbortController();
    controller.abort();
    await act(async () => {
      await stale(editedImage, controller.signal);
      await stale('/changed.png', controller.signal);
      capturedClose();
    });
    fireEvent.click(screen.getByTestId('inkio-image-block-edit'));
    await act(async () => { await stale('/late.png'); });
    expect(onUpload).not.toHaveBeenCalled();
    expect(props.updateAttributes).not.toHaveBeenCalled();
  });

  it('rejects a Blob with an invalid image signature before uploading', async () => {
    const onUpload = vi.fn(async (_file: File) => '/edited.png');
    const props = createProps('/original.png', { onUpload });
    render(<ImageBlockView {...props} />);
    fireEvent.click(screen.getByTestId('inkio-image-block-edit'));

    await act(async () => {
      await expect(capturedBlobSave?.(new Blob(['not a PNG'], { type: 'image/png' })))
        .rejects.toThrow('File content is not a supported image.');
    });
    expect(onUpload).not.toHaveBeenCalled();
    expect(props.updateAttributes).not.toHaveBeenCalled();
    expect(screen.queryByTestId('image-editor-stub')).not.toBeNull();
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
    expect(screen.getByRole('img', { name: 'a' }).getAttribute('src')).toBe('https://example.com/a.png');
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

  it('keeps the original image on error and retries the same edited file', async () => {
    const error = new Error('Upload failed');
    const onUploadError = vi.fn();
    const onUpload = vi.fn<(file: File) => Promise<string>>()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('https://example.com/edited.png');
    const props = createProps('https://example.com/a.png', {
      onUpload,
      onUploadError,
    });
    render(<ImageBlockView {...props} />);
    fireEvent.click(screen.getByTestId('inkio-image-block-edit'));

    await act(async () => { await expect(capturedSave?.(editedImage)).rejects.toBe(error); });

    expect(props.updateAttributes).not.toHaveBeenCalled();
    expect(onUploadError).toHaveBeenCalledWith(error);
    expect(screen.queryByTestId('image-editor-stub')).not.toBeNull();

    await act(async () => { await capturedSave?.(editedImage); });
    expect(onUpload.mock.calls[0][0].name).toBe(onUpload.mock.calls[1][0].name);
    expect(props.updateAttributes).toHaveBeenCalledExactlyOnceWith({ src: 'https://example.com/edited.png' });
    expect(screen.queryByTestId('image-editor-stub')).toBeNull();
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
    let startUpload: () => void = () => { throw new Error('Upload signal is missing'); };
    const started = new Promise<void>((resolve) => { startUpload = resolve; });
    const upload = new Promise<string>((resolve) => { finishUpload = resolve; });
    const onDelete = vi.fn();
    const props = createProps('https://example.com/a.png', {
      onUpload: () => { startUpload(); return upload; },
      cleanup: 'immediate',
      onDelete,
    });
    const { unmount } = render(<ImageBlockView {...props} />);
    fireEvent.click(screen.getByTestId('inkio-image-block-edit'));

    await act(async () => {
      const saving = capturedSave?.(editedImage);
      await started;
      unmount();
      finishUpload('https://example.com/edited.png');
      await saving;
    });

    expect(props.updateAttributes).not.toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalledExactlyOnceWith('https://example.com/edited.png');
  });

  it('keeps data URL storage when no upload callback is configured', async () => {
    const props = createProps('https://example.com/a.png');
    render(<ImageBlockView {...props} />);
    fireEvent.click(screen.getByTestId('inkio-image-block-edit'));
    expect(capturedBlobSave).toBeUndefined();

    await act(async () => { await capturedSave?.(editedImage); });

    expect(props.updateAttributes).toHaveBeenCalledWith({ src: editedImage });
  });
});
