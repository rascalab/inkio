import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { history, undo } from '@tiptap/pm/history';
import { ImageBlock, type ImageBlockOptions, type ImageUploadContext } from '../ImageBlock';
import { rasterPngFile } from './image-fixtures';

const editors: Editor[] = [];
const original = '/images/original.png';
const abandoned = '/images/unused-upload.png';

function createEditor(options: Partial<ImageBlockOptions> = {}, content = `<img src="${original}">`) {
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: [Document, Paragraph, Text, ImageBlock.configure(options)],
    content,
  });
  editors.push(editor);
  return editor;
}

function pendingUpload() {
  let finish: (src: string) => void = () => { throw new Error('Upload has not started'); };
  const upload = new Promise<string>((resolve) => { finish = resolve; });
  return { finish, onUpload: vi.fn((_file: File, _context: ImageUploadContext) => upload) };
}

afterEach(() => {
  for (const editor of editors.splice(0)) {
    if (!editor.isDestroyed) editor.destroy();
  }
});

describe('ImageBlock cleanup', () => {
  it('defaults to manual cleanup', () => {
    expect(ImageBlock.options.cleanup).toBe('manual');
  });

  it.each(['manual', 'immediate'] as const)('never deletes files on replacement, cut/paste, undo or document load (%s)', async (cleanup) => {
    const onDelete = vi.fn();
    const editor = createEditor({ cleanup, onDelete });
    editor.registerPlugin(history());
    editor.commands.setNodeSelection(0);
    editor.commands.updateAttributes('imageBlock', { src: '/images/edited.png' });
    expect(undo(editor.state, editor.view.dispatch)).toBe(true);
    expect(editor.state.doc.firstChild?.attrs.src).toBe(original);

    editor.commands.setNodeSelection(0);
    editor.commands.deleteSelection();
    await Promise.resolve(); // A cut and paste can be separated by arbitrarily long periods.
    editor.commands.setImageBlock({ src: original });
    editor.commands.setContent('<p>A different document</p>');

    expect(onDelete).not.toHaveBeenCalled();
  });

  it.each([false, true])('immediate only cleans an upload that never entered the document (destroyed: %s)', async (destroy) => {
    const { onUpload, finish } = pendingUpload();
    const onDelete = vi.fn();
    const editor = createEditor({ cleanup: 'immediate', onUpload, onDelete }, '<p></p>');
    editor.commands.uploadImageBlock([rasterPngFile()]);
    await vi.waitFor(() => expect(onUpload).toHaveBeenCalledOnce());
    const { blockId, signal } = onUpload.mock.calls[0][1];
    expect(blockId).toBeTruthy();
    expect(signal.aborted).toBe(false);
    if (destroy) editor.destroy();
    else editor.commands.setContent('<p>A different document</p>');
    expect(signal.aborted).toBe(true);
    finish(abandoned);

    await vi.waitFor(() => expect(onDelete).toHaveBeenCalledExactlyOnceWith(abandoned));
  });

  it('does not resurrect a pending marker on remount when the host ignores abort', async () => {
    const { onUpload, finish } = pendingUpload();
    const onDelete = vi.fn();
    const editor = createEditor({ cleanup: 'immediate', onUpload, onDelete }, '<p></p>');
    editor.commands.uploadImageBlock([rasterPngFile()]);
    await vi.waitFor(() => expect(onUpload).toHaveBeenCalledOnce());
    editor.unmount();
    expect(onUpload.mock.calls[0][1].signal.aborted).toBe(true);
    editor.mount(document.createElement('div'));
    await vi.waitFor(() => expect(editor.view.dom.querySelector('.inkio-image-block-placeholder')).toBeNull());
    finish(abandoned);
    await vi.waitFor(() => expect(onDelete).toHaveBeenCalledExactlyOnceWith(abandoned));
    expect(editor.getHTML()).toBe('<p></p>');
  });

  it('abandons a read-only insertion even if the editor becomes editable again', async () => {
    const { onUpload, finish } = pendingUpload();
    const onDelete = vi.fn();
    const editor = createEditor({ cleanup: 'immediate', onUpload, onDelete }, '<p></p>');
    editor.commands.uploadImageBlock([rasterPngFile(), rasterPngFile()]);
    await vi.waitFor(() => expect(onUpload).toHaveBeenCalledOnce());

    editor.setEditable(false, false);
    editor.setEditable(true, false);
    expect(onUpload.mock.calls[0][1].signal.aborted).toBe(true);
    await vi.waitFor(() => expect(editor.view.dom.querySelector('.inkio-image-block-placeholder')).toBeNull());
    finish(abandoned);
    await vi.waitFor(() => expect(onDelete).toHaveBeenCalledExactlyOnceWith(abandoned));
    expect(onUpload).toHaveBeenCalledTimes(1);
    expect(editor.getHTML()).toBe('<p></p>');
  });

  it('never deletes a raw upload key when URL resolution aborts', async () => {
    const resolveFileUrl = vi.fn((_key: string, { signal }: ImageUploadContext) => new Promise<string>((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }));
    const onDelete = vi.fn();
    const onUploadError = vi.fn();
    const editor = createEditor({ cleanup: 'immediate', onDelete, onUploadError, onUpload: async () => '/raw-key', resolveFileUrl });
    editor.commands.uploadImageBlock([rasterPngFile()]);
    await vi.waitFor(() => expect(resolveFileUrl).toHaveBeenCalledOnce());
    editor.commands.setContent('<p>Replaced</p>');
    expect(resolveFileUrl.mock.calls[0][1].signal.aborted).toBe(true);
    await Promise.resolve();
    expect(onDelete).not.toHaveBeenCalled();
    expect(onUploadError).not.toHaveBeenCalled();
    expect(editor.getHTML()).toBe('<p>Replaced</p>');
  });

  it.each([
    { cleanup: 'manual', source: abandoned, content: '<p>A different document</p>' },
    { cleanup: 'immediate', source: original, content: `<img src="${original}">` },
    { cleanup: 'immediate', source: 'data:image/png;base64,iVBORw0KGgo=', content: '<p>A different document</p>' },
  ] as const)('keeps abandoned results that are manual, referenced, or data URLs ($cleanup, $source)', async ({ cleanup, source, content }) => {
    const { onUpload, finish } = pendingUpload();
    const resolveFileUrl = vi.fn(async (src: string) => src);
    const onDelete = vi.fn();
    const editor = createEditor({ cleanup, onUpload, onDelete, resolveFileUrl }, '<p></p>');
    editor.commands.uploadImageBlock([rasterPngFile()]);
    await vi.waitFor(() => expect(onUpload).toHaveBeenCalledOnce());
    editor.commands.setContent(content);
    finish(source);

    if (cleanup === 'manual') {
      await Promise.resolve();
      expect(resolveFileUrl).not.toHaveBeenCalled();
    } else {
      await vi.waitFor(() => expect(resolveFileUrl).toHaveBeenCalledExactlyOnceWith(source, onUpload.mock.calls[0][1]));
    }
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('reports an abandoned upload cleanup failure without modifying the document', async () => {
    const error = new Error('Storage deletion failed');
    const { onUpload, finish } = pendingUpload();
    const onError = vi.fn();
    const editor = createEditor({
      cleanup: 'immediate',
      onUpload,
      onDelete: async () => { throw error; },
      onError,
    }, '<p></p>');
    editor.commands.uploadImageBlock([rasterPngFile()]);
    await vi.waitFor(() => expect(onUpload).toHaveBeenCalledOnce());
    editor.commands.setContent('<p>A different document</p>');
    finish(abandoned);

    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(error, { source: 'imageBlock.cleanup', recoverable: true }));
    expect(editor.getHTML()).toBe('<p>A different document</p>');
  });
});
