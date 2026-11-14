import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { Plugin } from '@tiptap/pm/state';
import { ImageBlock, UPLOAD_PLACEHOLDER_PREFIX, type ImageBlockOptions } from '../ImageBlock';

const editors: Editor[] = [];

function createEditor(options: Partial<ImageBlockOptions> = {}, sources = ['/images/original.png']) {
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: [Document, Paragraph, Text, ImageBlock.configure(options)],
    content: {
      type: 'doc',
      content: sources.length
        ? sources.map((src) => ({ type: 'imageBlock', attrs: { src } }))
        : [{ type: 'paragraph' }],
    },
  });
  editors.push(editor);
  return editor;
}

async function commit(editor: Editor, action: () => void) {
  const committed = new Promise<void>((resolve) => { editor.once('transaction', () => resolve()); });
  action();
  await committed;
}

afterEach(() => {
  for (const editor of editors.splice(0)) {
    if (!editor.isDestroyed) editor.destroy();
  }
});

describe('ImageBlock cleanup', () => {
  it('defaults to immediate cleanup', () => {
    expect(ImageBlock.options.cleanup).toBe('immediate');
  });

  it('deletes an image after its last document reference is removed', async () => {
    const onDelete = vi.fn();
    const editor = createEditor({ onDelete });
    editor.commands.setNodeSelection(0);

    await commit(editor, () => { editor.commands.deleteSelection(); });

    expect(onDelete).toHaveBeenCalledExactlyOnceWith('/images/original.png');
  });

  it('cleans the previous image only after the replacement is committed', async () => {
    const onDelete = vi.fn(() => {
      expect(editor.state.doc.firstChild?.attrs.src).toBe('/images/edited.png');
    });
    const editor = createEditor({ onDelete });
    editor.commands.setNodeSelection(0);

    await commit(editor, () => { editor.commands.updateAttributes('imageBlock', { src: '/images/edited.png' }); });

    expect(onDelete).toHaveBeenCalledExactlyOnceWith('/images/original.png');
  });

  it('leaves cleanup to the application in manual mode', async () => {
    const onDelete = vi.fn();
    const editor = createEditor({ cleanup: 'manual', onDelete });
    editor.commands.setNodeSelection(0);

    await commit(editor, () => { editor.commands.deleteSelection(); });

    expect(onDelete).not.toHaveBeenCalled();
  });

  it('keeps a file that another image in the document still references', async () => {
    const onDelete = vi.fn();
    const editor = createEditor({ onDelete }, ['/images/shared.png', '/images/shared.png']);
    editor.commands.setNodeSelection(0);

    await commit(editor, () => { editor.commands.deleteSelection(); });

    expect(onDelete).not.toHaveBeenCalled();
  });

  it.each([false, true])('deletes a shared file once across removals (reconfigure: %s)', async (reconfigure) => {
    const onDelete = vi.fn();
    const editor = createEditor({ onDelete }, ['/images/shared.png', '/images/shared.png']);
    editor.commands.selectAll();

    await commit(editor, () => {
      editor.commands.deleteSelection();
      if (reconfigure) {
        editor.registerPlugin(new Plugin({}));
        editor.commands.setImageBlock({ src: '/images/shared.png' });
        editor.commands.selectAll();
        editor.commands.deleteSelection();
      }
    });

    expect(onDelete).toHaveBeenCalledExactlyOnceWith('/images/shared.png');
  });

  it('does not clean an image for caption or width changes', async () => {
    const onDelete = vi.fn();
    const editor = createEditor({ onDelete });
    editor.commands.setNodeSelection(0);

    await commit(editor, () => { editor.commands.updateAttributes('imageBlock', { width: '50%', caption: 'Caption' }); });

    expect(onDelete).not.toHaveBeenCalled();
  });

  it.each([false, true])('rechecks references before cleanup (reconfigure: %s)', async (reconfigure) => {
    const onDelete = vi.fn();
    const editor = createEditor({ onDelete });
    editor.commands.setNodeSelection(0);

    await commit(editor, () => {
      editor.commands.deleteSelection();
      if (reconfigure) editor.registerPlugin(new Plugin({}));
      editor.commands.setImageBlock({ src: '/images/original.png' });
    });

    expect(onDelete).not.toHaveBeenCalled();
  });

  it('cleans a source removed again after its pending cleanup was canceled', async () => {
    const onDelete = vi.fn();
    const editor = createEditor({ onDelete });
    editor.commands.setNodeSelection(0);
    editor.commands.deleteSelection();
    editor.commands.setImageBlock({ src: '/images/original.png' });
    await Promise.resolve();
    editor.commands.setNodeSelection(0);

    await commit(editor, () => { editor.commands.deleteSelection(); });

    expect(onDelete).toHaveBeenCalledExactlyOnceWith('/images/original.png');
  });

  it('does not delete files when setContent loads another document', async () => {
    const onDelete = vi.fn();
    const editor = createEditor({ onDelete });

    await commit(editor, () => {
      editor.commands.setContent({
        type: 'doc',
        content: [{ type: 'imageBlock', attrs: { src: '/images/another-document.png' } }],
      });
    });

    expect(onDelete).not.toHaveBeenCalled();
  });

  it('tracks the newly loaded document for subsequent user deletions', async () => {
    const onDelete = vi.fn();
    const editor = createEditor({ onDelete });
    editor.commands.setContent({
      type: 'doc',
      content: [{ type: 'imageBlock', attrs: { src: '/images/another-document.png' } }],
    });
    editor.commands.setNodeSelection(0);

    await commit(editor, () => { editor.commands.deleteSelection(); });

    expect(onDelete).toHaveBeenCalledExactlyOnceWith('/images/another-document.png');
  });

  it('does not delete files when a read-only editor receives changes', async () => {
    const onDelete = vi.fn();
    const editor = createEditor({ onDelete });
    editor.setEditable(false);
    editor.commands.setNodeSelection(0);

    await commit(editor, () => { editor.commands.deleteSelection(); });

    expect(onDelete).not.toHaveBeenCalled();
  });

  it('does not delete document images when the editor is destroyed', async () => {
    const onDelete = vi.fn();
    const editor = createEditor({ onDelete });

    editor.destroy();
    await Promise.resolve();

    expect(onDelete).not.toHaveBeenCalled();
  });

  it('does not send data URLs or upload placeholders to the storage adapter', async () => {
    const onDelete = vi.fn();
    const editor = createEditor({ onDelete }, [
      'data:image/png;base64,iVBORw0KGgo=',
      `${UPLOAD_PLACEHOLDER_PREFIX}pending`,
    ]);
    editor.commands.selectAll();

    await commit(editor, () => { editor.commands.deleteSelection(); });

    expect(onDelete).not.toHaveBeenCalled();
  });

  it('reports cleanup failures without rolling back the replacement', async () => {
    const error = new Error('Storage deletion failed');
    let report: () => void = () => { throw new Error('Error signal is missing'); };
    const reported = new Promise<void>((resolve) => { report = resolve; });
    const onError = vi.fn(() => { report(); });
    const editor = createEditor({
      onDelete: async () => { throw error; },
      onError,
    });
    editor.commands.setNodeSelection(0);

    editor.commands.updateAttributes('imageBlock', { src: '/images/edited.png' });
    await reported;

    expect(editor.state.doc.firstChild?.attrs.src).toBe('/images/edited.png');
    expect(onError).toHaveBeenCalledWith(error, { source: 'imageBlock.cleanup', recoverable: true });
  });

  it.each([false, true])('cleans an upload whose target disappears (destroyed: %s)', async (destroy) => {
    let start: () => void = () => { throw new Error('Upload signal is missing'); };
    let finish: (src: string) => void = () => { throw new Error('Upload has not started'); };
    let deleted: () => void = () => { throw new Error('Cleanup signal is missing'); };
    const started = new Promise<void>((resolve) => { start = resolve; });
    const upload = new Promise<string>((resolve) => { finish = resolve; });
    const cleaned = new Promise<void>((resolve) => { deleted = resolve; });
    const onDelete = vi.fn(() => { deleted(); });
    const editor = createEditor({
      onUpload: () => { start(); return upload; },
      onDelete,
    }, []);
    editor.commands.uploadImageBlock([new File(['image'], 'image.png', { type: 'image/png' })], 0);
    await started;
    if (destroy) editor.destroy();
    else {
      editor.commands.setNodeSelection(0);
      editor.commands.deleteSelection();
    }

    finish('/images/unused-upload.png');
    await cleaned;

    expect(onDelete).toHaveBeenCalledExactlyOnceWith('/images/unused-upload.png');
  });
});
