import { describe, expect, it, vi } from 'vitest';
import { Editor } from '@tiptap/core';
import { history, redo, undo } from '@tiptap/pm/history';
import { Fragment, Slice } from '@tiptap/pm/model';
import { Plugin } from '@tiptap/pm/state';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { ImageBlock, type ImageBlockOptions, type ImageUploadContext } from '../ImageBlock';
import { uploadImageFile } from '../image-block-upload';
import { rasterPngFile } from './image-fixtures';

function createEditor(options: Pick<ImageBlockOptions, 'onUpload' | 'resolveFileUrl' | 'onUploadError'>) {
  return new Editor({
    element: document.createElement('div'),
    extensions: [
      Document,
      Paragraph,
      Text,
      ImageBlock.configure({
        onUpload: options.onUpload,
        resolveFileUrl: options.resolveFileUrl,
        onUploadError: options.onUploadError,
      }),
    ],
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
  });
}

function pasteImage(editor: Editor, file: File, html = '', slice = Slice.empty) {
  const clipboardData = { files: [file], getData: (type: string) => type === 'text/html' ? html : '' };
  const event = { clipboardData, preventDefault: vi.fn() } as unknown as ClipboardEvent;
  return editor.view.someProp('handlePaste', (handlePaste) => handlePaste(editor.view, event, slice));
}

function makeFile(content: string, name: string, type: string) {
  return new File([content], name, { type });
}

async function flushUploads(rounds = 10) {
  for (let i = 0; i < rounds; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => { setTimeout(resolve, 10); });
  }
}

function docText(editor: Editor) {
  return JSON.stringify(editor.getJSON());
}

/**
 * Validate storage callback URLs before inserting them, and raster bytes
 * before calling the storage adapter.
 */
describe('ImageBlock upload URL validation', () => {
  it('rejects a javascript: URL returned by onUpload', async () => {
    const onUploadError = vi.fn();
    const onUpload = vi.fn(async () => 'javascript:alert(1)');
    const editor = createEditor({
      onUpload,
      onUploadError,
    });

    editor.commands.uploadImageBlock([rasterPngFile()]);
    await flushUploads();
    expect(onUpload).toHaveBeenCalledOnce();

    expect(docText(editor)).not.toContain('javascript:');
    expect(onUploadError).toHaveBeenCalled();
    editor.destroy();
  });

  it('rejects an unsafe URL returned by resolveFileUrl', async () => {
    const resolveFileUrl = vi.fn(async () => 'data:text/html,<script>alert(1)</script>');
    const onUploadError = vi.fn();
    const editor = createEditor({
      onUpload: async () => 'https://example.com/a.png',
      resolveFileUrl,
      onUploadError,
    });

    editor.commands.uploadImageBlock([rasterPngFile()]);
    await flushUploads();
    expect(resolveFileUrl).toHaveBeenCalledOnce();

    expect(docText(editor)).not.toContain('data:text/html');
    expect(onUploadError).toHaveBeenCalled();
    editor.destroy();
  });

  it('stores safe upload results', async () => {
    const editor = createEditor({
      onUpload: async () => 'https://example.com/a.png',
    });

    editor.commands.uploadImageBlock([rasterPngFile()]);
    await flushUploads();

    expect(docText(editor)).toContain('https://example.com/a.png');
    editor.destroy();
  });

  it('does not start a FileReader for an already-aborted local upload', async () => {
    const controller = new AbortController();
    controller.abort();
    const read = vi.spyOn(FileReader.prototype, 'readAsDataURL');
    try {
      await expect(uploadImageFile(rasterPngFile(), {}, { signal: controller.signal })).rejects.toBe(controller.signal.reason);
      expect(read).not.toHaveBeenCalled();
    } finally {
      read.mockRestore();
    }
  });

  it('keeps a live upload when an unrelated plugin is registered', async () => {
    let finish!: (src: string) => void;
    const upload = new Promise<string>((resolve) => { finish = resolve; });
    const onUpload = vi.fn((_file: File, _context: ImageUploadContext) => upload);
    const editor = createEditor({ onUpload });
    editor.commands.uploadImageBlock([rasterPngFile()]);
    await vi.waitFor(() => expect(onUpload).toHaveBeenCalledOnce());
    editor.registerPlugin(new Plugin({}));
    finish('/still-live.png');
    await vi.waitFor(() => expect(docText(editor)).toContain('/still-live.png'));
    expect(onUpload.mock.calls[0][1].signal.aborted).toBe(false);
    editor.destroy();
  });

  it.each(['paste', 'drop'])('aborts an in-flight %s resolver when its target is removed', async (input) => {
    const file = rasterPngFile();
    const onUpload = vi.fn(async (_file: File, _context: ImageUploadContext) => '/uploaded.png');
    const resolveFileUrl = vi.fn((_url: string, { signal }: ImageUploadContext) => new Promise<string>((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }));
    const onUploadError = vi.fn();
    const editor = createEditor({ onUpload, resolveFileUrl, onUploadError });
    if (input === 'paste') {
      pasteImage(editor, file);
    } else {
      vi.spyOn(editor.view, 'posAtCoords').mockReturnValue({ pos: 1, inside: 0 });
      const event = { dataTransfer: { files: [file] }, preventDefault: vi.fn() } as unknown as DragEvent;
      editor.view.someProp('handleDrop', (drop) => drop(editor.view, event, Slice.empty, false));
    }
    await vi.waitFor(() => expect(resolveFileUrl).toHaveBeenCalledOnce());
    const context = onUpload.mock.calls[0][1];
    expect(context.blockId).toBeTruthy();
    expect(context.signal.aborted).toBe(false);
    expect(resolveFileUrl).toHaveBeenCalledWith('/uploaded.png', context);

    editor.commands.setContent('<p>Replacement</p>');
    expect(context.signal.aborted).toBe(true);
    await flushUploads(1);
    expect(onUploadError).not.toHaveBeenCalled();
    expect(editor.getHTML()).toBe('<p>Replacement</p>');
    editor.destroy();
  });

  it('rejects plain text mislabeled as an image without calling the uploader', async () => {
    const onUploadError = vi.fn();
    const onUpload = vi.fn(async () => 'https://example.com/a.png');
    const editor = createEditor({
      onUpload,
      onUploadError,
    });

    editor.commands.uploadImageBlock([
      makeFile('A note from the clipboard', 'note.png', 'image/png'),
    ]);
    await flushUploads();

    expect(onUpload).not.toHaveBeenCalled();
    expect(docText(editor)).not.toContain('https://example.com/a.png');
    expect(onUploadError).toHaveBeenCalled();
    editor.destroy();
  });

  it.each([
    ['an empty file', () => makeFile('', 'empty.png', 'image/png')],
    ['a mismatched raster type', () => rasterPngFile('mislabeled.gif', 'image/gif')],
    ['a file whose bytes cannot be read', () => {
      const file = rasterPngFile();
      vi.spyOn(file, 'slice').mockImplementation(() => { throw new Error('Cannot read file'); });
      return file;
    }],
  ])('rejects %s', async (_label, getFile) => {
    const onUploadError = vi.fn();
    const onUpload = vi.fn(async () => 'https://example.com/a.png');
    const editor = createEditor({
      onUpload,
      onUploadError,
    });

    editor.commands.uploadImageBlock([getFile()]);
    await flushUploads();

    expect(onUpload).not.toHaveBeenCalled();
    expect(docText(editor)).not.toContain('https://example.com/a.png');
    expect(onUploadError).toHaveBeenCalled();
    editor.destroy();
  });

  it('clamps a negative upload pos to 0 instead of throwing', async () => {
    const onUploadError = vi.fn();
    const editor = createEditor({
      onUpload: async () => 'https://example.com/a.png',
      onUploadError,
    });

    expect(() =>
      editor.commands.uploadImageBlock([rasterPngFile()], -50),
    ).not.toThrow();
    await flushUploads();

    expect(docText(editor)).toContain('https://example.com/a.png');
    expect(onUploadError).not.toHaveBeenCalled();
    editor.destroy();
  });

  it('replaces the empty paragraph with the caret and continues below the image', async () => {
    const editor = createEditor({ onUpload: async () => 'https://example.com/a.png' });
    editor.commands.focus('end');

    editor.commands.uploadImageBlock([rasterPngFile()]);
    await flushUploads();

    expect(editor.getJSON().content?.map((node) => node.type)).toEqual(['imageBlock', 'paragraph']);
    expect(editor.state.selection.$from.parent.type.name).toBe('paragraph');
    expect(editor.state.selection.from).toBe(2);
    editor.destroy();
  });

  it('keeps several files in order', async () => {
    const urls = ['https://example.com/1.png', 'https://example.com/2.png'];
    const editor = createEditor({ onUpload: async () => urls.shift() as string });
    editor.commands.focus('end');

    editor.commands.uploadImageBlock([
      rasterPngFile('1.png'),
      rasterPngFile('2.png'),
    ]);
    await flushUploads();

    const nodes = editor.getJSON().content ?? [];
    expect(nodes.map((node) => node.type)).toEqual(['imageBlock', 'imageBlock', 'paragraph']);
    expect(nodes.map((node) => node.attrs?.src).slice(0, 2)).toEqual([
      'https://example.com/1.png',
      'https://example.com/2.png',
    ]);
    editor.destroy();
  });

  it('leaves the caret alone when an image lands elsewhere', async () => {
    const editor = createEditor({ onUpload: async () => 'https://example.com/a.png' });
    editor.commands.setContent({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'keep' }] },
        { type: 'paragraph' },
      ],
    });
    editor.commands.setTextSelection(3);

    editor.commands.uploadImageBlock([rasterPngFile()], 7);
    await flushUploads();

    expect(editor.getJSON().content?.map((node) => node.type)).toEqual(['paragraph', 'imageBlock']);
    expect(editor.state.selection.from).toBe(3);
    editor.destroy();
  });

  it('keeps placeholders out of history and redoes the completed image', async () => {
    const editor = createEditor({ onUpload: async () => '/completed.png' });
    editor.registerPlugin(history());
    editor.commands.uploadImageBlock([rasterPngFile()]);
    expect(editor.getJSON().content?.map((node) => node.type)).toEqual(['paragraph']);
    expect(editor.view.dom.querySelector('.inkio-image-block-placeholder')).not.toBeNull();
    await vi.waitFor(() => expect(docText(editor)).toContain('/completed.png'));

    expect(undo(editor.state, editor.view.dispatch)).toBe(true);
    expect(editor.getJSON().content?.map((node) => node.type)).toEqual(['paragraph']);
    expect(redo(editor.state, editor.view.dispatch)).toBe(true);
    expect(editor.state.doc.firstChild?.attrs.src).toBe('/completed.png');
    expect(editor.view.dom.querySelector('.inkio-image-block-placeholder')).toBeNull();
    editor.destroy();
  });

  it('maps the batch position through edits before validation and during upload', async () => {
    let finish: (src: string) => void = () => { throw new Error('Upload has not started'); };
    const onUpload = vi.fn()
      .mockImplementationOnce(() => new Promise<string>((resolve) => { finish = resolve; }))
      .mockResolvedValueOnce('/second.png');
    const editor = createEditor({ onUpload });
    editor.commands.setContent('<p>before</p><p></p><p>after</p>');
    editor.commands.setTextSelection(9);
    editor.commands.uploadImageBlock([rasterPngFile('first.png'), rasterPngFile('second.png')]);
    editor.commands.insertContentAt(1, 'new ');
    await vi.waitFor(() => expect(onUpload).toHaveBeenCalledOnce());
    editor.commands.insertContentAt(1, 'more ');
    finish('/first.png');

    await vi.waitFor(() => expect(docText(editor)).toContain('/second.png'));
    const blocks: string[] = [];
    editor.state.doc.forEach((node) => blocks.push(node.attrs.src ?? node.textContent));
    expect(blocks).toEqual(['more new before', '/first.png', '/second.png', 'after']);
    editor.destroy();
  });

  it('does not start an upload while checking command availability', async () => {
    const onUpload = vi.fn(async () => '/completed.png');
    const editor = createEditor({ onUpload });
    expect(editor.can().uploadImageBlock([rasterPngFile()])).toBe(true);
    await Promise.resolve();
    expect(onUpload).not.toHaveBeenCalled();
    expect(editor.view.dom.querySelector('.inkio-image-block-placeholder')).toBeNull();
    editor.destroy();
  });

  it('lets normal paste preserve meaningful parsed HTML when there is also an image file', () => {
    const onUpload = vi.fn(async () => '/file.png');
    const editor = createEditor({ onUpload });
    const normalPaste = vi.fn(() => true);
    editor.registerPlugin(new Plugin({ props: { handlePaste: normalPaste } }));
    const formattedContent = editor.schema.nodes.paragraph.create(null, editor.schema.text('A real caption'));
    const slice = new Slice(Fragment.from(formattedContent), 1, 1);

    expect(pasteImage(editor, rasterPngFile(), '<p>A real caption</p>', slice)).toBe(true);
    expect(normalPaste).toHaveBeenCalledWith(editor.view, expect.anything(), slice);
    expect(onUpload).not.toHaveBeenCalled();
    editor.destroy();
  });

  it.each([null, 'data:image/png;base64,iVBORw0KGgo='])('uploads the clipboard file when HTML has no reusable image (%s)', async (src) => {
    const onUpload = vi.fn(async () => '/clipboard.png');
    const editor = createEditor({ onUpload });
    const unusableImage = editor.schema.nodes.imageBlock.create({ src });
    const slice = new Slice(Fragment.from(unusableImage), 0, 0);

    expect(pasteImage(editor, rasterPngFile(), '<img alt="">', slice)).toBe(true);
    await vi.waitFor(() => expect(docText(editor)).toContain('/clipboard.png'));
    expect(onUpload).toHaveBeenCalledOnce();
    editor.destroy();
  });

  it('setImageBlock command rejects unsafe src', () => {
    const editor = createEditor({});
    const result = editor.commands.setImageBlock({ src: 'javascript:alert(1)' });
    expect(result).toBe(false);
    expect(docText(editor)).not.toContain('javascript:');
    editor.destroy();
  });
});
