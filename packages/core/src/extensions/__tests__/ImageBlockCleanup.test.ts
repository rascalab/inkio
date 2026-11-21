import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { history, undo } from '@tiptap/pm/history';
import { ImageBlock, type ImageBlockOptions } from '../ImageBlock';
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
  return { finish, onUpload: vi.fn(() => upload) };
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
    if (destroy) editor.destroy();
    else editor.commands.setContent('<p>A different document</p>');
    finish(abandoned);

    await vi.waitFor(() => expect(onDelete).toHaveBeenCalledExactlyOnceWith(abandoned));
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

    await vi.waitFor(() => expect(resolveFileUrl).toHaveBeenCalledExactlyOnceWith(source));
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
